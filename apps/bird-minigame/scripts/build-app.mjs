import { mkdir, open, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { moduleRoot } from "./rule-loader.mjs";

const output = join(moduleRoot, "dist");
await mkdir(join(output, "src"), { recursive: true });
await mkdir(join(output, "rules"), { recursive: true });
await mkdir(join(output, "assets", "pilots"), { recursive: true });

async function copyInPlace(source, destination) {
  await mkdir(dirname(destination), { recursive: true });
  const contents = await readFile(source);
  try {
    if ((await readFile(destination)).equals(contents)) return;
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
  }
  try {
    const handle = await open(destination, "r+");
    try {
      await handle.truncate(0);
      await handle.writeFile(contents);
    } finally {
      await handle.close();
    }
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    await writeFile(destination, contents, { flag: "wx" });
  }
}

async function copyDirectoryInPlace(sourceRoot, destinationRoot) {
  for (const entry of await readdir(sourceRoot, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const source = join(entry.parentPath, entry.name);
    await copyInPlace(source, join(destinationRoot, relative(sourceRoot, source)));
  }
}

await copyInPlace(join(moduleRoot, "index.html"), join(output, "index.html"));
await copyInPlace(join(moduleRoot, "art-lab.html"), join(output, "art-lab.html"));
await copyDirectoryInPlace(join(moduleRoot, "src"), join(output, "src"));
await copyDirectoryInPlace(join(moduleRoot, "rules"), join(output, "rules"));
for(const name of ['magpie-v1.png','flower-v1.png']) await copyInPlace(
  join(moduleRoot,'assets','candidates','shape-preserving-20260905',name),
  join(output,'assets','candidates','shape-preserving-20260905',name));
await copyDirectoryInPlace(join(moduleRoot, "assets", "concepts"), join(output, "assets", "concepts"));
await copyInPlace(
  join(moduleRoot, "assets", "pilots", "bird-flight-pilot-taiwan-blue-magpie-transparent.png"),
  join(output, "assets", "pilots", "bird-flight-pilot-taiwan-blue-magpie-transparent.png")
);
console.log(`Built standalone bird mini-game at ${output}`);
