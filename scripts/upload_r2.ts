import { readFile, readdir, stat } from "fs/promises";
import path from "path";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

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
) {
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

  await client.send(command);
  console.log(`Uploaded ${relativePath} -> ${key}`);
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

  console.log(
    `Uploading ${files.length} files to bucket "${config.bucketName}"...`,
  );

  for (const relativePath of files) {
    // eslint-disable-next-line no-await-in-loop
    await uploadFile(client, config, relativePath);
  }

  console.log("Upload complete.");
}

main().catch((error) => {
  console.error("[upload-r2] Failed to upload assets.", error);
  process.exit(1);
});
