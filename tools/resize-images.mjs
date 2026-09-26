/* Makes the smaller copies of each photo that the pages offer through
   srcset, so a phone downloads a 400px image instead of the 800px original
   and the basket's 72px thumbnails a 200px one.

     npm install --no-save sharp
     node tools/resize-images.mjs

   Re-run after adding or replacing a photo in images/. For every
   images/<name>.webp it writes images/<name>-200.webp, -400.webp and -600.webp;
   the original stays as the largest size. tests/build.test.mjs fails if a
   photo is missing its copies. */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const ROOT = path.join(import.meta.dirname, "..");
const sharp = createRequire(path.join(ROOT, "package.json"))("sharp");
const WIDTHS = [200, 400, 600];
const DIR = path.join(ROOT, "images");

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".webp") && !/-\d+\.webp$/.test(f)).sort()) {
  const src = path.join(DIR, file);
  const { width } = await sharp(src).metadata();
  const made = [];
  for (const w of WIDTHS.filter((w) => w < width)) {
    const out = src.replace(/\.webp$/, `-${w}.webp`);
    await sharp(src).resize({ width: w }).webp({ quality: 78, effort: 6 }).toFile(out);
    made.push(`${w}px ${(fs.statSync(out).size / 1024).toFixed(0)} KB`);
  }
  console.log(`${file} (${width}px ${(fs.statSync(src).size / 1024).toFixed(0)} KB) -> ${made.join(", ")}`);
}
