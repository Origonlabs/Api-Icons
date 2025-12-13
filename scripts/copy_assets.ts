import { cp, mkdir, stat } from "fs/promises";
import path from "path";

async function copyAssetsDirectory() {
  const projectRoot = process.cwd();
  const sourceDir = path.resolve(projectRoot, "assets");
  const destinationDir = path.resolve(projectRoot, "dist", "assets");

  try {
    await stat(sourceDir);
  } catch (error) {
    console.warn(
      `[copy-assets] No assets directory found at ${sourceDir}. Skipping copy.`,
    );
    return;
  }

  await mkdir(path.dirname(destinationDir), { recursive: true });
  await cp(sourceDir, destinationDir, { recursive: true });
  console.info(
    `[copy-assets] Copied assets directory to ${destinationDir} successfully.`,
  );
}

copyAssetsDirectory().catch((error) => {
  console.error("[copy-assets] Failed to copy assets directory.", error);
  process.exit(1);
});
