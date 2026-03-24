type Variant = "pwa" | "favicon" | "maskable";

type Point = {
  x: number;
  y: number;
};

type Rgba = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type OutputSpec = {
  path: string;
  size: number;
  variant: Variant;
};

const outputs: OutputSpec[] = [
  { path: "assets/icons/icon-48.png", size: 48, variant: "pwa" },
  { path: "assets/icons/icon-72.png", size: 72, variant: "pwa" },
  { path: "assets/icons/icon-96.png", size: 96, variant: "pwa" },
  { path: "assets/icons/icon-144.png", size: 144, variant: "pwa" },
  { path: "assets/icons/icon-192.png", size: 192, variant: "pwa" },
  { path: "assets/icons/icon-512.png", size: 512, variant: "pwa" },
  { path: "assets/icons/icon-1024.png", size: 1024, variant: "pwa" },
  {
    path: "assets/icons/icon-maskable-192.png",
    size: 192,
    variant: "maskable",
  },
  {
    path: "assets/icons/icon-maskable-512.png",
    size: 512,
    variant: "maskable",
  },
  { path: "public/favicon/favicon-16x16.png", size: 16, variant: "favicon" },
  { path: "public/favicon/favicon-32x32.png", size: 32, variant: "favicon" },
  { path: "public/favicon/favicon-96x96.png", size: 96, variant: "favicon" },
  { path: "public/favicon/apple-touch-icon.png", size: 180, variant: "pwa" },
  {
    path: "public/favicon/web-app-manifest-192x192.png",
    size: 192,
    variant: "maskable",
  },
  {
    path: "public/favicon/web-app-manifest-512x512.png",
    size: 512,
    variant: "maskable",
  },
];

const ROOT = new URL("../", import.meta.url);

function clamp(value: number, min = 0, max = 1): number {
  return Math.min(max, Math.max(min, value));
}

function mix(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

function length(x: number, y: number): number {
  return Math.hypot(x, y);
}

function quadPoint(p0: Point, p1: Point, p2: Point, t: number): Point {
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

function sampleQuadratic(p0: Point, p1: Point, p2: Point, steps = 24): Point[] {
  const points: Point[] = [];
  for (let index = 0; index <= steps; index += 1) {
    points.push(quadPoint(p0, p1, p2, index / steps));
  }
  return points;
}

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const abx = bx - ax;
  const aby = by - ay;
  const apx = px - ax;
  const apy = py - ay;
  const denom = abx * abx + aby * aby;

  if (denom <= Number.EPSILON) {
    return length(apx, apy);
  }

  const t = clamp((apx * abx + apy * aby) / denom);
  return length(px - (ax + abx * t), py - (ay + aby * t));
}

function minDistanceToPolyline(
  px: number,
  py: number,
  points: Point[],
): number {
  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]!;
    const b = points[index + 1]!;
    minDistance = Math.min(
      minDistance,
      distanceToSegment(px, py, a.x, a.y, b.x, b.y),
    );
  }
  return minDistance;
}

function blend(base: Rgba, overlay: Rgba): Rgba {
  const alpha = overlay.a + base.a * (1 - overlay.a);
  if (alpha <= Number.EPSILON) {
    return { r: 0, g: 0, b: 0, a: 0 };
  }

  return {
    r: (overlay.r * overlay.a + base.r * base.a * (1 - overlay.a)) / alpha,
    g: (overlay.g * overlay.a + base.g * base.a * (1 - overlay.a)) / alpha,
    b: (overlay.b * overlay.a + base.b * base.a * (1 - overlay.a)) / alpha,
    a: alpha,
  };
}

function addGlow(base: Rgba, glow: Rgba, strength: number): Rgba {
  return {
    r: clamp(base.r + glow.r * strength, 0, 1),
    g: clamp(base.g + glow.g * strength, 0, 1),
    b: clamp(base.b + glow.b * strength, 0, 1),
    a: clamp(base.a + glow.a * strength, 0, 1),
  };
}

function createBackground(nx: number, ny: number): Rgba {
  const topLeftGlow = Math.exp(
    -Math.pow(length(nx - 0.22, ny - 0.12) / 0.54, 2.4),
  );
  const bottomBloom = Math.exp(
    -Math.pow(length(nx - 0.18, ny - 0.82) / 0.42, 2.6),
  );
  const centerVignette = Math.exp(
    -Math.pow(length(nx - 0.5, ny - 0.52) / 0.82, 2.1),
  );

  const deep = { r: 0.027, g: 0.07, b: 0.109, a: 1 };
  const mid = { r: 0.051, g: 0.112, b: 0.172, a: 1 };
  const accent = { r: 0.059, g: 0.267, b: 0.525, a: 0.32 };

  let color: Rgba = {
    r: mix(deep.r, mid.r, clamp(centerVignette * 0.58 + topLeftGlow * 0.18)),
    g: mix(deep.g, mid.g, clamp(centerVignette * 0.58 + topLeftGlow * 0.18)),
    b: mix(deep.b, mid.b, clamp(centerVignette * 0.58 + topLeftGlow * 0.18)),
    a: 1,
  };

  color = addGlow(color, accent, bottomBloom * 0.55);
  color = addGlow(color, accent, topLeftGlow * 0.22);
  return color;
}

function createMarkPaths(size: number, variant: Variant): Point[][] {
  const centerX = size * 0.5;
  const centerY = size * (variant === "favicon" ? 0.535 : 0.53);
  const scale = size * (variant === "favicon" ? 0.42 : 0.36);

  const toPoint = (x: number, y: number): Point => ({
    x: centerX + x * scale,
    y: centerY + y * scale,
  });

  const centerBase = toPoint(0, 0.36);
  const centerTip = toPoint(0, -0.48);

  const leftBase = toPoint(-0.05, 0.34);
  const leftTip = toPoint(-0.48, -0.11);

  const rightBase = toPoint(0.05, 0.34);
  const rightTip = toPoint(0.48, -0.11);

  return [
    sampleQuadratic(centerBase, toPoint(-0.26, -0.04), centerTip),
    sampleQuadratic(centerBase, toPoint(0.26, -0.04), centerTip),
    sampleQuadratic(leftBase, toPoint(-0.6, 0.12), leftTip),
    sampleQuadratic(leftBase, toPoint(-0.17, -0.25), leftTip),
    sampleQuadratic(rightBase, toPoint(0.6, 0.12), rightTip),
    sampleQuadratic(rightBase, toPoint(0.17, -0.25), rightTip),
  ];
}

function renderIcon(size: number, variant: Variant): Uint8Array {
  const data = new Uint8Array(size * size * 4);
  const aa = 1.25;
  const centerX = size * 0.5;
  const centerY = size * 0.5;
  const diskRadius = size *
    (variant === "maskable" ? 0.31 : variant === "favicon" ? 0.34 : 0.33);
  const ringWidth = Math.max(
    1.5,
    size * (variant === "favicon" ? 0.018 : 0.012),
  );
  const echoRings = size >= 96
    ? [diskRadius + size * 0.055, diskRadius + size * 0.108]
    : size >= 48
    ? [diskRadius + size * 0.06]
    : [];
  const markPaths = createMarkPaths(size, variant);
  const markStroke = Math.max(
    1.7,
    size * (variant === "favicon" ? 0.06 : 0.038),
  );
  const markGlow = markStroke * 2.1;
  const markBounds = {
    left: centerX - size * 0.22,
    right: centerX + size * 0.22,
    top: centerY - size * 0.22,
    bottom: centerY + size * 0.2,
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = (x + 0.5) / size;
      const ny = (y + 0.5) / size;
      let color = createBackground(nx, ny);

      const dx = x + 0.5 - centerX;
      const dy = y + 0.5 - centerY;
      const dist = Math.hypot(dx, dy);

      const diskAlpha = 1 - smoothstep(diskRadius - aa, diskRadius + aa, dist);
      if (diskAlpha > 0) {
        const localGlow = Math.exp(
          -Math.pow(Math.hypot(nx - 0.42, ny - 0.38) / 0.52, 2.4),
        );
        const diskColor: Rgba = {
          r: mix(0.046, 0.081, localGlow * 0.65),
          g: mix(0.09, 0.147, localGlow * 0.65),
          b: mix(0.133, 0.205, localGlow * 0.65),
          a: diskAlpha,
        };
        color = blend(color, diskColor);
      }

      const ringAlpha = 1 -
        smoothstep(
          ringWidth * 0.5,
          ringWidth * 0.5 + aa,
          Math.abs(dist - diskRadius),
        );
      if (ringAlpha > 0) {
        color = addGlow(
          color,
          { r: 0.19, g: 0.46, b: 0.92, a: 0.75 },
          ringAlpha * 0.34,
        );
        color = blend(color, {
          r: 0.34,
          g: 0.49,
          b: 0.72,
          a: ringAlpha * 0.36,
        });
      }

      const haloAlpha = 1 -
        smoothstep(
          size * 0.012,
          size * 0.048 + aa,
          Math.abs(dist - diskRadius),
        );
      if (haloAlpha > 0) {
        color = addGlow(
          color,
          { r: 0.05, g: 0.34, b: 0.88, a: 0.42 },
          haloAlpha * 0.22,
        );
      }

      for (const ringRadius of echoRings) {
        const echoAlpha = 1 -
          smoothstep(
            Math.max(0.8, size * 0.004),
            size * 0.01 + aa,
            Math.abs(dist - ringRadius),
          );
        if (echoAlpha > 0) {
          color = blend(color, {
            r: 0.168,
            g: 0.286,
            b: 0.435,
            a: echoAlpha * 0.18,
          });
        }
      }

      if (
        x >= markBounds.left &&
        x <= markBounds.right &&
        y >= markBounds.top &&
        y <= markBounds.bottom
      ) {
        let minDistance = Number.POSITIVE_INFINITY;
        for (const path of markPaths) {
          minDistance = Math.min(
            minDistance,
            minDistanceToPolyline(x + 0.5, y + 0.5, path),
          );
        }

        const glowAlpha = 1 -
          smoothstep(markGlow * 0.5, markGlow + aa, minDistance);
        if (glowAlpha > 0) {
          color = addGlow(
            color,
            { r: 0.06, g: 0.45, b: 0.96, a: 0.42 },
            glowAlpha * 0.36,
          );
        }

        const strokeAlpha = 1 -
          smoothstep(markStroke * 0.5, markStroke * 0.5 + aa, minDistance);
        if (strokeAlpha > 0) {
          const highlight = clamp(1 - (y / size - 0.35) / 0.45);
          color = blend(color, {
            r: mix(0.05, 0.36, highlight),
            g: mix(0.58, 0.78, highlight),
            b: mix(0.91, 1, highlight),
            a: strokeAlpha * 0.98,
          });
        }
      }

      const index = (y * size + x) * 4;
      data[index] = Math.round(color.r * 255);
      data[index + 1] = Math.round(color.g * 255);
      data[index + 2] = Math.round(color.b * 255);
      data[index + 3] = Math.round(color.a * 255);
    }
  }

  return data;
}

function uint32(value: number): Uint8Array {
  return new Uint8Array([
    (value >>> 24) & 0xff,
    (value >>> 16) & 0xff,
    (value >>> 8) & 0xff,
    value & 0xff,
  ]);
}

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) {
      const mask = -(crc & 1);
      crc = (crc >>> 1) ^ (0xedb88320 & mask);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type);
  const chunk = new Uint8Array(12 + data.length);
  chunk.set(uint32(data.length), 0);
  chunk.set(typeBytes, 4);
  chunk.set(data, 8);

  const crcInput = new Uint8Array(typeBytes.length + data.length);
  crcInput.set(typeBytes, 0);
  crcInput.set(data, typeBytes.length);
  chunk.set(uint32(crc32(crcInput)), 8 + data.length);
  return chunk;
}

async function encodePng(size: number, rgba: Uint8Array): Promise<Uint8Array> {
  const rows = new Uint8Array(size * (size * 4 + 1));

  for (let y = 0; y < size; y += 1) {
    const rowStart = y * (size * 4 + 1);
    rows[rowStart] = 0;
    rows.set(
      rgba.subarray(y * size * 4, (y + 1) * size * 4),
      rowStart + 1,
    );
  }

  const compressed = await new Response(
    new Blob([rows]).stream().pipeThrough(new CompressionStream("deflate")),
  ).arrayBuffer();

  const header = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = new Uint8Array(13);
  ihdr.set(uint32(size), 0);
  ihdr.set(uint32(size), 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return concat([
    header,
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", new Uint8Array(compressed)),
    pngChunk("IEND", new Uint8Array()),
  ]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;

  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }

  return output;
}

function createIco(entries: { size: number; png: Uint8Array }[]): Uint8Array {
  const header = new Uint8Array(6);
  header[2] = 1;
  header[4] = entries.length & 0xff;
  header[5] = (entries.length >>> 8) & 0xff;

  const directory = new Uint8Array(entries.length * 16);
  let offset = header.length + directory.length;

  entries.forEach((entry, index) => {
    const cursor = index * 16;
    directory[cursor] = entry.size >= 256 ? 0 : entry.size;
    directory[cursor + 1] = entry.size >= 256 ? 0 : entry.size;
    directory[cursor + 2] = 0;
    directory[cursor + 3] = 0;
    directory[cursor + 4] = 1;
    directory[cursor + 5] = 0;
    directory[cursor + 6] = 32;
    directory[cursor + 7] = 0;
    directory.set(uint32(entry.png.length), cursor + 8);
    directory.set(uint32(offset), cursor + 12);
    offset += entry.png.length;
  });

  return concat([header, directory, ...entries.map((entry) => entry.png)]);
}

for (const output of outputs) {
  const rgba = renderIcon(output.size, output.variant);
  const png = await encodePng(output.size, rgba);
  const destination = new URL(output.path, ROOT);
  await Deno.mkdir(new URL(".", destination), { recursive: true });
  await Deno.writeFile(destination, png);
  console.log(`wrote ${output.path}`);
}

const ico = createIco([
  {
    size: 16,
    png: await encodePng(16, renderIcon(16, "favicon")),
  },
  {
    size: 32,
    png: await encodePng(32, renderIcon(32, "favicon")),
  },
  {
    size: 48,
    png: await encodePng(48, renderIcon(48, "favicon")),
  },
]);

await Deno.writeFile(new URL("./public/favicon/favicon.ico", ROOT), ico);
console.log("wrote public/favicon/favicon.ico");
