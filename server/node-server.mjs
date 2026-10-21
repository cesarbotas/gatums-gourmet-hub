/**
 * Adaptador Node para o build SSR do TanStack Start (alvo Node, não Cloudflare).
 *
 * O build gera:
 *   - dist/server/server.js  -> `export default { fetch(request, env, ctx) }` (handler Fetch/Web)
 *   - dist/client/assets/*   -> assets estáticos com hash (JS/CSS/imagens)
 *
 * Este processo sobe um servidor HTTP Node que:
 *   1. Serve GET/HEAD de /assets/* a partir de dist/client/assets com cache imutável.
 *   2. Encaminha qualquer outra rota para o handler fetch() (SSR).
 *
 * Uso: node server/node-server.mjs   (PORT e HOST via env, defaults 3000 / 0.0.0.0)
 */
import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Readable } from "node:stream";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const DIST = resolve(__dirname, "..", "dist");
const CLIENT_DIR = join(DIST, "client");
const SERVER_ENTRY = pathToFileURL(join(DIST, "server", "server.js")).href;

const PORT = Number.parseInt(process.env.PORT ?? "3000", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

const MIME = {
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
};

// Importa o handler SSR uma única vez.
const ssrModule = await import(SERVER_ENTRY);
const ssrHandler = ssrModule.default ?? ssrModule;
if (typeof ssrHandler?.fetch !== "function") {
  throw new Error("dist/server/server.js não exporta um handler com fetch(). Rode o build antes.");
}

/** Resolve com segurança um caminho de asset dentro de dist/client (sem path traversal). */
function safeClientPath(urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const normalized = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  const full = join(CLIENT_DIR, normalized);
  if (full !== CLIENT_DIR && !full.startsWith(CLIENT_DIR + sep)) return null;
  return full;
}

async function tryServeStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;
  const urlPath = req.url ?? "/";
  // Só servimos estáticos sob /assets/ — o resto é SSR.
  if (!urlPath.startsWith("/assets/")) return false;

  const filePath = safeClientPath(urlPath);
  if (!filePath) return false;

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  const type = MIME[extname(filePath).toLowerCase()] ?? "application/octet-stream";
  res.statusCode = 200;
  res.setHeader("content-type", type);
  res.setHeader("content-length", info.size);
  // Assets têm hash no nome -> cache longo e imutável.
  res.setHeader("cache-control", "public, max-age=31536000, immutable");
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  await new Promise((resolveStream, rejectStream) => {
    const stream = createReadStream(filePath);
    stream.on("error", rejectStream);
    stream.on("end", resolveStream);
    stream.pipe(res);
  });
  return true;
}

/** Converte o IncomingMessage do Node em um Request (Fetch API). */
function toFetchRequest(req) {
  const proto =
    (req.headers["x-forwarded-proto"]?.toString().split(",")[0].trim()) || "http";
  const host = req.headers.host ?? `${HOST}:${PORT}`;
  const url = new URL(req.url ?? "/", `${proto}://${host}`);

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value === undefined) continue;
    if (Array.isArray(value)) {
      for (const v of value) headers.append(key, v);
    } else {
      headers.set(key, value);
    }
  }

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function writeFetchResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    res.setHeader(key, value);
  });
  if (!response.body) {
    res.end();
    return;
  }
  const nodeStream = Readable.fromWeb(response.body);
  await new Promise((resolveStream, rejectStream) => {
    nodeStream.on("error", rejectStream);
    nodeStream.on("end", resolveStream);
    nodeStream.pipe(res);
  });
}

const httpServer = createServer(async (req, res) => {
  try {
    if (await tryServeStatic(req, res)) return;
    const request = toFetchRequest(req);
    const response = await ssrHandler.fetch(request, {}, {});
    await writeFetchResponse(res, response);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("content-type", "text/plain; charset=utf-8");
    }
    res.end("Internal Server Error");
  }
});

httpServer.listen(PORT, HOST, () => {
  console.log(`[node-server] SSR ativo em http://${HOST}:${PORT}`);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    httpServer.close(() => process.exit(0));
  });
}
