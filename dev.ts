import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import {
  extname,
  join,
  normalize,
} from "https://deno.land/std@0.224.0/path/mod.ts";
import { bundle } from "jsr:@deno/emit@0.45.0";

const PORT = Number(Deno.env.get("PORT") ?? 8000);
const ROOT = Deno.cwd();

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".ts": "application/typescript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

async function bundleApp(): Promise<string> {
  const entry = new URL("./src/app/bootstrap.ts", import.meta.url);
  const result = await bundle(entry, { type: "module" });
  const bundled = result.code;
  if (!bundled) {
    throw new Error("Bundle output missing.");
  }
  return bundled;
}

function contentTypeFor(path: string): string {
  const ext = extname(path).toLowerCase();
  return MIME[ext] ?? "application/octet-stream";
}

function safePath(urlPath: string): string {
  const clean = urlPath.split("?")[0].split("#")[0];
  const normalized = normalize(clean).replace(/^(\.\.(\/|\\|$))+/, "");
  return normalized.startsWith("/") ? normalized.slice(1) : normalized;
}

async function fileResponse(filePath: string): Promise<Response> {
  try {
    const data = await Deno.readFile(filePath);
    const headers = new Headers();
    headers.set("Content-Type", contentTypeFor(filePath));
    headers.set("Cache-Control", "no-cache");
    return new Response(data, { status: 200, headers });
  } catch {
    return new Response("Not Found", { status: 404 });
  }
}

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = safePath(url.pathname);

  if (path === "" || path.endsWith("/")) {
    return fileResponse(join(ROOT, "public", "index.html"));
  }

  if (path === "app.js") {
    try {
      const code = await bundleApp();
      const headers = new Headers();
      headers.set("Content-Type", "application/javascript; charset=utf-8");
      headers.set("Cache-Control", "no-cache");
      return new Response(code, { status: 200, headers });
    } catch (error) {
      return new Response(`Build failed: ${String(error)}`, { status: 500 });
    }
  }

  const publicPath = join(ROOT, "public", path);
  const publicResp = await fileResponse(publicPath);
  if (publicResp.status !== 404) return publicResp;

  const assetPath = join(ROOT, "assets", path);
  const assetResp = await fileResponse(assetPath);
  if (assetResp.status !== 404) return assetResp;

  return new Response("Not Found", { status: 404 });
}

console.log(`Dev server running at http://localhost:${PORT}`);
await serve(handler, { port: PORT });
