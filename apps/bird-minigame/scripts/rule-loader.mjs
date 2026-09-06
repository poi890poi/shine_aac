import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const moduleRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

export async function readJson(relativePath) {
  return JSON.parse(await readFile(join(moduleRoot, relativePath), "utf8"));
}

export async function readText(relativePath) {
  return readFile(join(moduleRoot, relativePath), "utf8");
}

export async function loadRules() {
  const [species, style, rigs, feathers, validation, sources, pixelStyle] = await Promise.all([
    readJson("rules/species-proportions.json"),
    readJson("rules/cartoon-style.json"),
    readJson("rules/flight-rigs.json"),
    readJson("rules/feather-dynamics.json"),
    readJson("rules/image-validation.json"),
    readJson("research/sources.json"),
    readJson("rules/pixel-style.json")
  ]);
  return { species, style, rigs, feathers, validation, sources, pixelStyle };
}
