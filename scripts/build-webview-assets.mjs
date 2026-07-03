import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(repoRoot, "app", "build", "generated", "assets", "shineWeb", "www", "apps", "web");
const outSrc = join(outRoot, "src");

rmSync(join(repoRoot, "app", "build", "generated", "assets", "shineWeb"), { recursive: true, force: true });
mkdirSync(outSrc, { recursive: true });

const index = readFileSync(join(repoRoot, "apps", "web", "index.html"), "utf8")
  .replace('<script type="module" src="./src/app.js"></script>', '<script src="./src/bundle.js"></script>');
const styles = readFileSync(join(repoRoot, "apps", "web", "src", "styles.css"), "utf8");
const core = readFileSync(join(repoRoot, "packages", "aac-core", "src", "index.js"), "utf8")
  .replace(/\bexport\s+(?=(const|function|class)\b)/g, "");
const app = readFileSync(join(repoRoot, "apps", "web", "src", "app.js"), "utf8")
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+["'][^"']+["'];\s*/, "");

writeFileSync(join(outRoot, "index.html"), index);
writeFileSync(join(outSrc, "styles.css"), styles);
writeFileSync(join(outSrc, "bundle.js"), `${core}\n\n${app}\n`);

console.log(`Built WebView assets at ${outRoot}`);
