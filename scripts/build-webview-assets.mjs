import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(repoRoot, "app", "build", "generated", "assets", "shineWeb", "www", "apps", "web");
const outSrc = join(outRoot, "src");

rmSync(join(repoRoot, "app", "build", "generated", "assets", "shineWeb"), { recursive: true, force: true });
mkdirSync(outSrc, { recursive: true });

const index = readFileSync(join(repoRoot, "apps", "web", "index.html"), "utf8")
  .replace('<script type="module" src="./src/app.js"></script>', '<script src="./src/bundle.js"></script>');
const styles = readFileSync(join(repoRoot, "apps", "web", "src", "styles.css"), "utf8");

writeFileSync(join(outRoot, "index.html"), index);
writeFileSync(join(outSrc, "styles.css"), styles);
await build({
  entryPoints: [join(repoRoot, "apps", "web", "src", "app.js")],
  outfile: join(outSrc, "bundle.js"),
  bundle: true,
  platform: "browser",
  format: "iife",
  charset: "utf8",
  legalComments: "none",
  sourcemap: false,
  minify: false
});

console.log(`Built WebView assets at ${outRoot}`);
