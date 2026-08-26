import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const trackedFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], {
  cwd: root,
  encoding: "utf8"
}).split(/\r?\n/).filter((file) => file && existsSync(resolve(root, file)));

const violations = [];
const pureKotlinFiles = trackedFiles.filter((file) => file.startsWith("optical-core/") && file.endsWith(".kt"));
for (const file of pureKotlinFiles) {
  const source = readFileSync(resolve(root, file), "utf8");
  for (const match of source.matchAll(/^import\s+([^\s]+)/gm)) {
    if (/^(android|androidx|com\.google|com\.jiangdg)\./.test(match[1])) {
      violations.push(`${file}: platform import ${match[1]}`);
    }
  }
}

for (const file of trackedFiles.filter((name) => /\.(?:js|mjs)$/.test(name))) {
  if (
    file === "packages/aac-core/src/index.js" ||
    file.startsWith("packages/aac-core/src/core/") ||
    file === "scripts/check-architecture.mjs"
  ) continue;
  const source = readFileSync(resolve(root, file), "utf8");
  if (/packages\/aac-core\/src\/core|@shine-aac\/core\/src/.test(source)) {
    violations.push(`${file}: bypasses the @shine-aac/core public facade`);
  }
}

if (violations.length > 0) {
  console.error("Architecture boundary violations:\n" + violations.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Architecture boundaries OK (${pureKotlinFiles.length} optical-core Kotlin files checked).`);
