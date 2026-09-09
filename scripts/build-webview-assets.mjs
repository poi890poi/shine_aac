import { cpSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
// The game remains an ES module document so relative artwork URLs and its CSS
// stay independent of the AAC bundle. Copy runtime assets, not source photos.
cpSync(join(repoRoot,'apps/web/garden.html'),join(outRoot,'garden.html'));
cpSync(join(repoRoot,'apps/web/src/garden-page.js'),join(outSrc,'garden-page.js'));
const birdRoot = join(repoRoot,'apps/bird-minigame');
const birdOut = join(outRoot,'../bird-minigame');
for (const folder of ['src','rules','assets/scenery','assets/native']) cpSync(join(birdRoot,folder),join(birdOut,folder),{recursive:true});
for (const folder of ['shape-preserving-20260905','second-bird-20260906','all-birds-20260906']) {
  const source = join(birdRoot,'assets/candidates',folder), target = join(birdOut,'assets/candidates',folder);
  mkdirSync(target,{recursive:true});
  for (const file of readdirSync(source)) if (file.endsWith('.png')) cpSync(join(source,file),join(target,file));
}
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
