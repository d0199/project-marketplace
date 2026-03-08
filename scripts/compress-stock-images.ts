/**
 * Compresses all stock images in public/stock/ to web-appropriate sizes.
 * Run with: npx tsx scripts/compress-stock-images.ts
 */
import sharp from "sharp";
import { readdirSync, statSync } from "fs";
import { join, extname, basename } from "path";

const STOCK_DIR = join(process.cwd(), "public", "stock");
const HERO_MAX_WIDTH = 1920;
const HERO_QUALITY = 82;
const CARD_MAX_WIDTH = 1200;
const CARD_QUALITY = 80;

async function compress(file: string) {
  const ext = extname(file).toLowerCase();
  if (![".jpg", ".jpeg", ".png"].includes(ext)) return;

  const fullPath = join(STOCK_DIR, file);
  const isHero = basename(file, ext).toLowerCase() === "hero";
  const maxWidth = isHero ? HERO_MAX_WIDTH : CARD_MAX_WIDTH;
  const quality = isHero ? HERO_QUALITY : CARD_QUALITY;
  const beforeKb = Math.round(statSync(fullPath).size / 1024);

  const img = sharp(fullPath).resize({ width: maxWidth, withoutEnlargement: true });

  // Convert PNGs to JPEG for much smaller file sizes (gym photos, not logos)
  const outExt = ext === ".png" ? ".jpg" : ext;
  const outFile = join(STOCK_DIR, basename(file, ext) + outExt);

  await img.jpeg({ quality, mozjpeg: true }).toFile(outFile + ".tmp");

  // Replace original
  const { renameSync, unlinkSync } = await import("fs");
  if (outFile !== fullPath) unlinkSync(fullPath); // remove .png original
  renameSync(outFile + ".tmp", outFile);

  const afterKb = Math.round(statSync(outFile).size / 1024);
  console.log(`${file.padEnd(20)} ${beforeKb} KB → ${afterKb} KB  (${Math.round((1 - afterKb / beforeKb) * 100)}% smaller)`);
}

const files = readdirSync(STOCK_DIR);
console.log(`Compressing ${files.length} files in public/stock/...\n`);
for (const file of files) {
  await compress(file);
}
console.log("\nDone.");
