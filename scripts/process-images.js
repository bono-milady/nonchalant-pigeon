#!/usr/bin/env node
/**
 * Procesează PNG-urile din src/assets/raw/ și scoate WebP la 400px și 1000px.
 * Generează și public/images/pigeon/manifest.json cu lista sortată.
 *
 * Utilizare: node scripts/process-images.js
 * Opțional:  node scripts/process-images.js --quality 80
 */

import sharp from "sharp";
import { readdir, mkdir, writeFile } from "fs/promises";
import { existsSync } from "fs";
import { join, basename, extname } from "path";
import { fileURLToPath } from "url";

const __dir = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dir, "..");
const INPUT_DIR = join(ROOT, "src/assets/raw");
const OUTPUT_DIR = join(ROOT, "public/images/pigeon");

const SIZES = [
  { suffix: "400w", width: 400, quality: 82 },
  { suffix: "1000w", width: 1000, quality: 78 },
];

// Parsează --quality din argv
const qArg = process.argv.indexOf("--quality");
const overrideQuality = qArg !== -1 ? parseInt(process.argv[qArg + 1]) : null;

async function main() {
  if (!existsSync(INPUT_DIR)) {
    console.error(`❌  Input dir not found: ${INPUT_DIR}`);
    console.error(`    Pune PNG-urile în ./src/assets/raw/ și rulează din nou.`);
    process.exit(1);
  }

  await mkdir(OUTPUT_DIR, { recursive: true });

  const all = await readdir(INPUT_DIR);
  const pngs = all
    .filter((f) => [".png", ".PNG", ".jpg", ".jpeg"].includes(extname(f)))
    .sort();

  if (pngs.length === 0) {
    console.log("⚠️  Niciun fișier PNG/JPG găsit în src/assets/raw/");
    console.log("   Generez placeholder manifest gol...");
    await writeFile(
      join(OUTPUT_DIR, "manifest.json"),
      JSON.stringify([], null, 2)
    );
    return;
  }

  console.log(`🐦 Procesez ${pngs.length} imagini...`);

  const manifest = [];
  let totalBytes = 0;

  for (let i = 0; i < pngs.length; i++) {
    const file = pngs[i];
    const slug = String(i + 1).padStart(3, "0");
    const base = basename(file, extname(file));
    const record = { index: i, slug, originalName: file, sizes: {} };

    for (const { suffix, width, quality: baseQ } of SIZES) {
      const q = overrideQuality ?? baseQ;
      const outName = `pigeon-${slug}-${suffix}.webp`;
      const outPath = join(OUTPUT_DIR, outName);

      try {
        const info = await sharp(join(INPUT_DIR, file))
          .resize({ width, withoutEnlargement: true })
          .webp({ quality: q, effort: 4 })
          .toFile(outPath);

        totalBytes += info.size;
        record.sizes[suffix] = `/images/pigeon/${outName}`;
        process.stdout.write(
          `  [${i + 1}/${pngs.length}] ${base} → ${suffix} (${(info.size / 1024).toFixed(0)}KB)\n`
        );
      } catch (err) {
        console.error(`  ❌ Eroare la ${file} → ${suffix}: ${err.message}`);
      }
    }

    manifest.push(record);
  }

  await writeFile(
    join(OUTPUT_DIR, "manifest.json"),
    JSON.stringify(manifest, null, 2)
  );

  console.log(
    `\n✅ Gata! ${pngs.length} imagini × ${SIZES.length} formate = ${(totalBytes / 1024 / 1024).toFixed(2)}MB total`
  );
  console.log(`   Manifest scris în public/images/pigeon/manifest.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
