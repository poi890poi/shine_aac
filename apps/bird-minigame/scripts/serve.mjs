import { createReadStream, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { moduleRoot } from "./rule-loader.mjs";

const root = process.argv.includes("--dist") ? join(moduleRoot, "dist") : moduleRoot;
const requestedPort = Number(process.env.BIRD_GAME_PORT || 4177);
const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png"
};

const server = createServer((request, response) => {
  const url = new URL(request.url, "http://localhost");
  const relative = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
  const file = normalize(join(root, relative));
  if (!file.toLowerCase().startsWith(root.toLowerCase())) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    if (!statSync(file).isFile()) throw new Error("Not a file");
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    createReadStream(file).pipe(response);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
  }
});

server.listen(requestedPort, "127.0.0.1", () => {
  console.log(`Bird mini-game: http://127.0.0.1:${requestedPort}`);
});
