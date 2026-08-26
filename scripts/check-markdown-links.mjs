import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";

const root = resolve(import.meta.dirname, "..");
const markdownFiles = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "*.md"], {
  cwd: root,
  encoding: "utf8"
}).split(/\r?\n/).filter((file) => file && existsSync(resolve(root, file)));
const broken = [];

for (const file of markdownFiles) {
  const source = readFileSync(resolve(root, file), "utf8");
  for (const match of source.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
    let target = match[1].trim().replace(/^<|>$/g, "");
    target = target.split(/\s+["']/)[0];
    if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) continue;
    const path = decodeURIComponent(target.split("#")[0].split("?")[0]);
    const absolute = resolve(dirname(resolve(root, file)), path);
    if (!existsSync(absolute)) broken.push(`${file}: ${target}`);
  }
}

if (broken.length > 0) {
  console.error("Broken local Markdown links:\n" + broken.map((item) => `- ${item}`).join("\n"));
  process.exit(1);
}

console.log(`Markdown links OK (${markdownFiles.length} tracked documents checked).`);
