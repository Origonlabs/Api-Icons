import { readdir, readFile, writeFile, stat } from "fs/promises";
import path from "path";

type IconMetadata = {
  name?: string;
  size?: number[];
  style?: string[];
  keyword?: string;
  description?: string;
  metaphor?: string[];
};

type IconRecord = {
  id: string;
  category: string;
  categorySlug: string;
  name: string;
  description?: string;
  keyword?: string;
  tags: string[];
  size?: number;
  style?: string;
  file: string;
  relativePath: string;
  cdnUrl: string | null;
};

const ASSETS_DIR = path.resolve(process.cwd(), "assets");
const OUTPUT_FILE = path.resolve(process.cwd(), "assets_manifest.json");
const ICON_CDN_BASE_URL = process.env.ICON_CDN_BASE_URL
  ? process.env.ICON_CDN_BASE_URL.replace(/\/+$/, "")
  : undefined;

async function readJsonFile(filePath: string): Promise<IconMetadata | null> {
  try {
    const buffer = await readFile(filePath, "utf-8");
    return JSON.parse(buffer);
  } catch {
    return null;
  }
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseFileDetails(fileName: string): {
  size?: number;
  style?: string;
  baseName: string;
} {
  const withoutExtension = fileName.replace(/\.svg$/i, "");
  const sizeMatch = withoutExtension.match(/_(\d+)_/);
  const styleMatch = withoutExtension.match(
    /_(regular|filled|light|bold|outline)$/i,
  );

  const size = sizeMatch?.[1] ? Number(sizeMatch[1]) : undefined;
  const style = styleMatch?.[1]?.toLowerCase();

  return {
    size,
    style,
    baseName: withoutExtension,
  };
}

async function generateManifest() {
  const entries = await readdir(ASSETS_DIR, { withFileTypes: true });
  const icons: IconRecord[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const categoryDir = path.join(ASSETS_DIR, entry.name);
    const metadataPath = path.join(categoryDir, "metadata.json");
    const svgDir = path.join(categoryDir, "SVG");

    try {
      const svgStats = await stat(svgDir);
      if (!svgStats.isDirectory()) {
        continue;
      }
    } catch {
      continue;
    }

    const metadata = (await readJsonFile(metadataPath)) ?? {};
    const svgFiles = await readdir(svgDir);
    const categorySlug = slugify(entry.name);

    for (const svgFile of svgFiles) {
      if (!svgFile.toLowerCase().endsWith(".svg")) {
        continue;
      }

      const { baseName, size, style } = parseFileDetails(svgFile);
      const relativePath = path.join("assets", entry.name, "SVG", svgFile);
      const id = `${categorySlug}-${baseName}`.replace(/--+/g, "-");
      const cdnUrl = ICON_CDN_BASE_URL
        ? `${ICON_CDN_BASE_URL}/${encodeURIComponent(entry.name)}/SVG/${encodeURIComponent(svgFile)}`
        : null;

      icons.push({
        id,
        category: entry.name,
        categorySlug,
        name: metadata.name ?? entry.name,
        description: metadata.description,
        keyword: metadata.keyword,
        tags: metadata.metaphor ?? [],
        size,
        style,
        file: svgFile,
        relativePath,
        cdnUrl,
      });
    }
  }

  await writeFile(
    OUTPUT_FILE,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        count: icons.length,
        icons,
      },
      null,
      2,
    ),
  );

  console.log(
    `[icon-manifest] Generated manifest with ${icons.length} icons at ${OUTPUT_FILE}`,
  );
}

generateManifest().catch((error) => {
  console.error("[icon-manifest] Failed to generate manifest.", error);
  process.exit(1);
});
