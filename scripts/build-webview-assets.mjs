import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const outRoot = join(repoRoot, "app", "build", "generated", "assets", "shineWeb", "www", "apps", "web");
const outSrc = join(outRoot, "src");

rmSync(join(repoRoot, "app", "build", "generated", "assets", "shineWeb"), { recursive: true, force: true });
mkdirSync(outSrc, { recursive: true });

const index = readFileSync(join(repoRoot, "apps", "web", "index.html"), "utf8")
  .replace('<script type="module" src="./src/app.js"></script>', '<script src="./src/bundle.js"></script>');
const styles = readFileSync(join(repoRoot, "apps", "web", "src", "styles.css"), "utf8");
const zhTwChewingData = readFileSync(join(repoRoot, "packages", "aac-core", "src", "data", "zh-tw-chewing.generated.js"), "utf8")
  .replace(/\bexport\s+(?=const\b)/g, "");
const core = readFileSync(join(repoRoot, "packages", "aac-core", "src", "index.js"), "utf8")
  .replace(/^import\s+\{[\s\S]*?\}\s+from\s+["']\.\/data\/zh-tw-chewing\.generated\.js["'];\s*/, "")
  .replace(/\bexport\s+(?=(const|function|class)\b)/g, "");
const app = bundleWebModule("apps/web/src/app.js");

function bundleWebModule(relativePath, seen = new Set()) {
  const normalizedPath = relativePath.replaceAll("\\", "/");
  if (seen.has(normalizedPath)) return "";
  seen.add(normalizedPath);

  const absolutePath = join(repoRoot, normalizedPath);
  let source = readFileSync(absolutePath, "utf8");
  const dependencies = [];
  source = source.replace(/^import\s+[\s\S]*?\s+from\s+["']([^"']+)["'];\s*/gm, (statement, specifier) => {
    const dependencyPath = relative(repoRoot, resolve(dirname(absolutePath), specifier)).replaceAll("\\", "/");
    if (dependencyPath.startsWith("packages/aac-core/")) return "";
    dependencies.push(bundleWebModule(dependencyPath, seen));
    return "";
  });
  source = source.replace(/\bexport\s+(?=(const|function|class)\b)/g, "");
  return `${dependencies.join("\n")}\n${source}`;
}

writeFileSync(join(outRoot, "index.html"), index);
writeFileSync(join(outSrc, "styles.css"), styles);
writeFileSync(join(outSrc, "bundle.js"), `${zhTwChewingData}\n\n${core}\n\n${app}\n`);

console.log(`Built WebView assets at ${outRoot}`);
