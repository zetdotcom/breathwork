// build.ts
// Deno-based build script using deno_emit (no npm/esbuild).
// Bundles src/app/bootstrap.ts to public/app.js and copies static assets into /public.

import { bundle } from "@deno/emit";

const assetsDir = new URL("./assets/", import.meta.url);
const publicDir = new URL("./public/", import.meta.url);
const publicAssetsDir = new URL("./public/assets/", import.meta.url);

async function ensureDir(path: URL): Promise<void> {
  await Deno.mkdir(path, { recursive: true });
}

async function copyDir(src: URL, dest: URL): Promise<void> {
  await ensureDir(dest);
  for await (const entry of Deno.readDir(src)) {
    const srcUrl = new URL(entry.name + (entry.isDirectory ? "/" : ""), src);
    const destUrl = new URL(entry.name + (entry.isDirectory ? "/" : ""), dest);

    if (entry.isDirectory) {
      await copyDir(srcUrl, destUrl);
      continue;
    }

    if (entry.isFile) {
      await ensureDir(dest);
      await Deno.copyFile(srcUrl, destUrl);
    }
  }
}

async function copyStaticAssets(): Promise<void> {
  try {
    await copyDir(assetsDir, publicAssetsDir);
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      console.warn("Assets directory not found, skipping copy.");
      return;
    }
    throw error;
  }
}

const entry = new URL("./src/app/bootstrap.ts", import.meta.url);
const outFile = new URL("./public/app.js", import.meta.url);

const result = await bundle(entry, {
  minify: false,
});

const bundled = result.code;
if (!bundled) {
  console.error("Build failed: no bundle output produced.");
  Deno.exit(1);
}

await Deno.mkdir(publicDir, { recursive: true });
await Deno.writeTextFile(outFile, bundled);
await copyStaticAssets();

console.log("Built:", outFile.pathname);
