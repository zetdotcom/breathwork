// build.ts
// Deno-based build script using deno_emit (no npm/esbuild).
// Bundles src/app/bootstrap.ts to public/app.js.

import { bundle } from "@deno/emit";

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

await Deno.mkdir(new URL("./public/", import.meta.url), { recursive: true });
await Deno.writeTextFile(outFile, bundled);

console.log("Built:", outFile.pathname);
