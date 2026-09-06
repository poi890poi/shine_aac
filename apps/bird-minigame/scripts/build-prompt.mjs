import { pathToFileURL } from "node:url";
import { loadRules, readText } from "./rule-loader.mjs";

function replaceAll(template, replacements) {
  return Object.entries(replacements).reduce(
    (result, [key, value]) => result.replaceAll(`{{${key}}}`, String(value)),
    template
  );
}

export async function buildPrompt(speciesId, mode = "anchor", phase = "power_downstroke") {
  const rules = await loadRules();
  const bird = rules.species.species.find((candidate) => candidate.id === speciesId);
  if (!bird) {
    throw new Error(`Unknown species '${speciesId}'.`);
  }

  const common = {
    ZH_TW: bird.zhTw,
    SCIENTIFIC: bird.scientific,
    TORSO_DEPTH: bird.ratios.torsoDepth,
    HEAD_DIAMETER: bird.ratios.headDiameter,
    BILL_LENGTH: bird.ratios.billLength,
    WING_LENGTH: bird.ratios.wingLength,
    TAIL_LENGTH: bird.ratios.tailLength,
    TAIL_WIDTH: bird.ratios.tailWidth,
    HEAD_SCALE: rules.style.sharedExaggeration.headDiameter,
    EYE_SCALE: rules.style.sharedExaggeration.eyeDiameter,
    TORSO_SCALE: rules.style.sharedExaggeration.torsoDepth,
    SUBJECT_FILL: rules.style.canonicalCanvas.subjectFillPercent,
    MAX_COLORS: rules.style.rendering.maximumColorsPerCharacter,
    IDENTITY: bird.identity.join("; ")
  };
  const pixel=rules.pixelStyle;
  const styleBrief=`\n\nGlobal pixel-art specification ${pixel.ruleVersion}: author directly on one native square-pixel grid. All bird, flower, cloud and grass sprites share ${pixel.outline.width}-pixel outlines. Use deliberate connected clusters of at least ${pixel.clusters.minimumArea} pixels except eyes, bill tips and liquid tips. Use ${pixel.shading.bands} shading bands, light direction ${JSON.stringify(pixel.shading.lightDirection)}, and semantic color ramps ${JSON.stringify(pixel.ramps)}. Palette: ${JSON.stringify(pixel.palette)}. No bitmap downsampling, stretched stems, smooth rotation, random dithering, isolated feather speckle, pillow shading or whole-image color reduction. For this game's native bird scale the torso axis is ${pixel.bird.torsoPixels} pixels; derive every component from the species ratios and shared exaggeration. Review native scale alongside the other objects, then at integer zoom. Pixel compliance does not imply visual approval.`;

  if (mode === "anchor") {
    return replaceAll(await readText("prompts/character-anchor.md"), common).trim()+styleBrief;
  }
  if (mode !== "pose") {
    throw new Error(`Mode must be 'anchor' or 'pose', received '${mode}'.`);
  }

  const rig = rules.rigs.rigs[bird.rig];
  const tailCurve = rules.feathers.species[bird.id];
  const pose = rig?.phases?.[phase];
  if (!pose) {
    throw new Error(`Rig '${bird.rig}' does not define phase '${phase}'.`);
  }
  return replaceAll(await readText("prompts/flight-pose-edit.md"), {
    ...common,
    PHASE: phase,
    RIG: bird.rig,
    BODY_PITCH: rig.bodyPitch,
    NEAR_WING_ANGLE: pose.nearWingAngle,
    NEAR_WING_SPREAD: pose.nearWingSpread,
    FAR_WING_ANGLE: pose.farWingAngle,
    FAR_WING_SCALE: rules.rigs.globalPoseInvariants.farWingScale,
    TAIL_FAN: rig.tailFan,
    TAIL_CURVE_MODEL: rules.feathers.curveModel,
    TAIL_BEND_START: tailCurve.bendStartRatio,
    TAIL_TIP_DROP: tailCurve.tipDropRatio,
    TAIL_TIP_TANGENT: tailCurve.tipTangentDegrees,
    TAIL_BUNDLE_COHERENCE: tailCurve.bundleCoherence
  }).trim()+styleBrief;
}

async function main() {
  const [speciesId, mode = "anchor", phase = "power_downstroke"] = process.argv.slice(2);
  if (!speciesId) {
    throw new Error("Usage: node scripts/build-prompt.mjs <species-id> [anchor|pose] [phase]");
  }
  process.stdout.write(`${await buildPrompt(speciesId, mode, phase)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
