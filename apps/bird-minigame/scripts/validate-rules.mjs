import { existsSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { loadRules, moduleRoot } from "./rule-loader.mjs";
import { validatePixelStyle } from '../src/style-rules.js';

const ratioRanges = {
  torsoDepth: [30, 75],
  headDiameter: [20, 65],
  billLength: [8, 65],
  wingLength: [70, 140],
  tailLength: [30, 250],
  tailWidth: [10, 55]
};

export async function validateRules() {
  const { species, style, rigs, feathers, validation, sources, pixelStyle } = await loadRules();
  const errors = [];
  try {validatePixelStyle(pixelStyle);} catch(error) {errors.push(error.message);}
  const birds = species.species;

  if (birds.length !== 16) errors.push(`Expected 16 species, found ${birds.length}.`);
  const ids = birds.map((bird) => bird.id);
  if (new Set(ids).size !== ids.length) errors.push("Species IDs are not unique.");
  const labels = birds.map((bird) => bird.zhTw);
  if (new Set(labels).size !== labels.length) errors.push("Traditional Chinese labels are not unique.");

  for (const bird of birds) {
    if (!rigs.rigs[bird.rig]) errors.push(`${bird.id}: missing rig '${bird.rig}'.`);
    if (!sources.species[bird.id]) errors.push(`${bird.id}: missing research source mapping.`);
    if (!Array.isArray(bird.identity) || bird.identity.length < 2) {
      errors.push(`${bird.id}: needs at least two identity anchors.`);
    }
    for (const [name, [minimum, maximum]] of Object.entries(ratioRanges)) {
      const value = bird.ratios[name];
      if (!Number.isFinite(value) || value < minimum || value > maximum) {
        errors.push(`${bird.id}: ${name}=${value} is outside ${minimum}..${maximum}.`);
      }
    }
    const curve = feathers.species[bird.id];
    if (!curve) {
      errors.push(`${bird.id}: missing feather-dynamics parameters.`);
      continue;
    }
    for (const [name, minimum, maximum] of [
      ["bendStartRatio", 0.15, 0.8],
      ["tipDropRatio", 0, 0.3],
      ["tipTangentDegrees", 0, 35],
      ["bundleCoherence", 0.8, 1]
    ]) {
      const value = curve[name];
      if (!Number.isFinite(value) || value < minimum || value > maximum) {
        errors.push(`${bird.id}: ${name}=${value} is outside ${minimum}..${maximum}.`);
      }
    }
    if (bird.ratios.tailLength >= 90 && curve.tipDropRatio < 0.08) {
      errors.push(`${bird.id}: long tail needs tipDropRatio >= 0.08.`);
    }
  }

  for (const [id, rig] of Object.entries(rigs.rigs)) {
    for (const phase of ["power_downstroke", "recovery_upstroke"]) {
      if (!rig.phases?.[phase]) errors.push(`${id}: missing ${phase}.`);
    }
  }

  for (const component of ["billLength", "wingLength", "tailLength"]) {
    if (style.sharedExaggeration[component] !== 1) {
      errors.push(`Shared cartoon transform must preserve ${component}.`);
    }
  }
  if (rigs.globalPoseInvariants.componentResizeAllowed !== false) {
    errors.push("Flight rigs must forbid component resizing.");
  }
  if (feathers.globalInvariants.arcLengthPreserved !== true) {
    errors.push("Feather dynamics must preserve curved centerline arc length.");
  }
  if (feathers.globalInvariants.noRigidStraightLongFeathers !== true) {
    errors.push("Feather dynamics must forbid rigid straight long feathers.");
  }
  if (validation.ratioTolerancePercent > 6) {
    errors.push("Ratio tolerance must not exceed 6 percent.");
  }
  for (const file of [
    "prompts/character-anchor.md",
    "prompts/flight-pose-edit.md",
    "scripts/render-proportion-guide.ps1",
    "scripts/render-tail-curve-atlas.ps1",
    "assets/generated/manifest-template.json"
  ]) {
    if (!existsSync(join(moduleRoot, file))) errors.push(`Missing required file ${file}.`);
  }

  return errors;
}

async function main() {
  const errors = await validateRules();
  if (errors.length) {
    for (const error of errors) console.error(`FAIL ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log("PASS rule-file consistency only: 16 species, rig/source declarations, and numeric parameter constraints. Rendered shapes, asset approval, and visual quality are NOT checked.");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
