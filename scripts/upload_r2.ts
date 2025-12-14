import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { config } from "dotenv";

// Load environment variables from .env file
config();

type UploadConfig = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  prefix?: string;
};

const ASSETS_DIRECTORY = path.resolve(process.cwd(), "assets");

function getConfig(): UploadConfig {
  const {
    R2_ACCOUNT_ID,
    R2_ACCESS_KEY_ID,
    R2_SECRET_ACCESS_KEY,
    R2_BUCKET_NAME,
    R2_PREFIX,
  } = process.env;

  const missing: string[] = [];
  if (!R2_ACCOUNT_ID) missing.push("R2_ACCOUNT_ID");
  if (!R2_ACCESS_KEY_ID) missing.push("R2_ACCESS_KEY_ID");
  if (!R2_SECRET_ACCESS_KEY) missing.push("R2_SECRET_ACCESS_KEY");
  if (!R2_BUCKET_NAME) missing.push("R2_BUCKET_NAME");

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`,
    );
  }

  return {
    accountId: R2_ACCOUNT_ID!,
    accessKeyId: R2_ACCESS_KEY_ID!,
    secretAccessKey: R2_SECRET_ACCESS_KEY!,
    bucketName: R2_BUCKET_NAME!,
    prefix: R2_PREFIX?.replace(/^\/+|\/+$/g, ""),
  };
}

async function collectSvgFiles(dir: string, base = ""): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relative = path.join(base, entry.name);

    if (entry.isDirectory()) {
      const nested = await collectSvgFiles(fullPath, relative);
      files.push(...nested);
      continue;
    }

    if (entry.isFile() && entry.name.toLowerCase().endsWith(".svg")) {
      files.push(relative);
    }
  }

  return files;
}

async function uploadFile(
  client: S3Client,
  config: UploadConfig,
  relativePath: string,
  retries = 5,
): Promise<boolean> {
  const filePath = path.join(ASSETS_DIRECTORY, relativePath);
  const buffer = await readFile(filePath);

  const keySegments = [config.prefix, relativePath]
    .filter(Boolean)
    .map((segment) => segment!.replace(/\\/g, "/"));
  const key = keySegments.join("/");

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    Body: buffer,
    ContentType: "image/svg+xml",
  });

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      await client.send(command);
      return true;
    } catch (error) {
      if (attempt === retries) {
        console.error(`✗ Failed ${relativePath}: ${(error as Error).message}`);
        return false;
      }
      // Exponential backoff: 1s, 2s, 4s, 8s
      const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  return false;
}

async function uploadBatch(
  client: S3Client,
  config: UploadConfig,
  files: string[],
  batchNumber: number,
  totalBatches: number,
): Promise<{ success: number; failed: number }> {
  const results = await Promise.all(
    files.map((file) => uploadFile(client, config, file))
  );

  const success = results.filter((r) => r).length;
  const failed = results.length - success;

  console.log(
    `Batch ${batchNumber}/${totalBatches} complete: ${success} success, ${failed} failed`
  );

  return { success, failed };
}

async function main() {
  const config = getConfig();

  try {
    const stats = await stat(ASSETS_DIRECTORY);
    if (!stats.isDirectory()) {
      throw new Error(`Assets directory not found at ${ASSETS_DIRECTORY}`);
    }
  } catch (error) {
    throw new Error(
      `Could not read assets directory at ${ASSETS_DIRECTORY}: ${String(error)}`,
    );
  }

  const files = await collectSvgFiles(ASSETS_DIRECTORY);
  if (files.length === 0) {
    console.warn("No SVG files found to upload.");
    return;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  const BATCH_SIZE = 50; // Upload 50 files in parallel at a time
  const batches: string[][] = [];

  // Split files into batches
  for (let i = 0; i < files.length; i += BATCH_SIZE) {
    batches.push(files.slice(i, i + BATCH_SIZE));
  }

  console.log(
    `Uploading ${files.length} files to bucket "${config.bucketName}" in ${batches.length} batches...`,
  );

  let totalSuccess = 0;
  let totalFailed = 0;
  const startTime = Date.now();

  for (let i = 0; i < batches.length; i++) {
    // eslint-disable-next-line no-await-in-loop
    const { success, failed } = await uploadBatch(
      client,
      config,
      batches[i]!,
      i + 1,
      batches.length,
    );

    totalSuccess += success;
    totalFailed += failed;

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const processed = totalSuccess + totalFailed;
    const remaining = files.length - processed;
    const rate = processed / (Date.now() - startTime) * 1000;
    const eta = remaining > 0 ? (remaining / rate).toFixed(0) : 0;

    console.log(
      `Progress: ${processed}/${files.length} (${totalSuccess} ✓, ${totalFailed} ✗) | ${elapsed}s elapsed, ~${eta}s remaining`,
    );
  }

  const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `\n✅ Upload complete in ${totalTime}s: ${totalSuccess} successful, ${totalFailed} failed out of ${files.length} files.`,
  );
}

main().catch((error) => {
  console.error("[upload-r2] Failed to upload assets.", error);
  process.exit(1);
});
