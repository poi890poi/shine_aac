function round(value) {
  return Math.round(Number(value) * 100) / 100;
}

export function findRepeatedRowGaps(rows, maximumGapPx = 4) {
  const findings = [];
  for (const run of rows ?? []) {
    const items = [...(run.items ?? [])].sort((left, right) => left.top - right.top);
    for (let index = 1; index < items.length; index += 1) {
      const previous = items[index - 1];
      const current = items[index];
      const gap = current.top - previous.bottom;
      if (gap > maximumGapPx + 0.5) {
        findings.push({
          role: run.role,
          previous: previous.name,
          current: current.name,
          gapPx: round(gap),
          previousHeightPx: round(previous.bottom - previous.top),
          currentHeightPx: round(current.bottom - current.top),
        });
      }
    }
  }
  return findings;
}

export function findLooseLineHeights(samples, maximumRatio = 1.6) {
  return (samples ?? []).filter((sample) => {
    if (!(sample.fontSizePx > 0) || !(sample.lineHeightPx > 0)) return false;
    return sample.lineHeightPx / sample.fontSizePx > maximumRatio;
  }).map((sample) => ({
    text: sample.text,
    fontSizePx: round(sample.fontSizePx),
    lineHeightPx: round(sample.lineHeightPx),
    ratio: round(sample.lineHeightPx / sample.fontSizePx),
  }));
}

export function findExcessiveCellPadding(samples, options = {}) {
  const minimumVerticalPx = options.minimumVerticalPx ?? 24;
  const minimumHorizontalPx = options.minimumHorizontalPx ?? 40;
  return (samples ?? []).filter((sample) => {
    const vertical = sample.paddingTopPx + sample.paddingBottomPx;
    const horizontal = sample.paddingLeftPx + sample.paddingRightPx;
    const verticalLimit = Math.max(minimumVerticalPx, sample.fontSizePx * 1.5);
    const horizontalLimit = Math.max(minimumHorizontalPx, sample.fontSizePx * 2.5);
    return vertical > verticalLimit || horizontal > horizontalLimit;
  }).map((sample) => ({
    selector: sample.selector,
    text: sample.text,
    verticalPaddingPx: round(sample.paddingTopPx + sample.paddingBottomPx),
    horizontalPaddingPx: round(sample.paddingLeftPx + sample.paddingRightPx),
    fontSizePx: round(sample.fontSizePx),
  }));
}

export function findRepeatedRowAlignmentDrift(rows, tolerancePx = 2) {
  const findings = [];
  for (const run of rows ?? []) {
    const items = run.items ?? [];
    if (items.length < 2) continue;
    const left = items[0].left;
    const right = items[0].right;
    for (const item of items.slice(1)) {
      if (Math.abs(item.left - left) > tolerancePx || Math.abs(item.right - right) > tolerancePx) {
        findings.push({
          role: run.role,
          name: item.name,
          leftDriftPx: round(item.left - left),
          rightDriftPx: round(item.right - right),
        });
      }
    }
  }
  return findings;
}

function relativeLuminance(red, green, blue) {
  const channels = [red, green, blue].map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function findBrightDarkThemeSurfaces(samples, rootArea, options = {}) {
  const minimumAreaFraction = options.minimumAreaFraction ?? 0.01;
  const maximumLuminance = options.maximumLuminance ?? 0.55;
  if (!(rootArea > 0)) return [];
  return (samples ?? []).filter((sample) => {
    if (!(sample.alpha >= 0.9) || !(sample.area > 0)) return false;
    const areaFraction = sample.area / rootArea;
    const luminance = relativeLuminance(sample.red, sample.green, sample.blue);
    return areaFraction >= minimumAreaFraction && luminance > maximumLuminance;
  }).map((sample) => ({
    selector: sample.selector,
    color: sample.color,
    areaFraction: round(sample.area / rootArea),
    luminance: round(relativeLuminance(sample.red, sample.green, sample.blue)),
  }));
}

export function findControlOverlaps(controls, minimumOverlapAreaPx = 4) {
  const findings = [];
  for (let leftIndex = 0; leftIndex < (controls ?? []).length; leftIndex += 1) {
    const left = controls[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < controls.length; rightIndex += 1) {
      const right = controls[rightIndex];
      const width = Math.min(left.right, right.right) - Math.max(left.left, right.left);
      const height = Math.min(left.bottom, right.bottom) - Math.max(left.top, right.top);
      if (width > 0 && height > 0 && width * height > minimumOverlapAreaPx) {
        findings.push({ left: left.name, right: right.name, overlapAreaPx: round(width * height) });
      }
    }
  }
  return findings;
}

export function findExcessiveRelatedGaps(relationships, maximumGapPx = 20) {
  return (relationships ?? []).filter((relationship) => {
    const gap = relationship.targetStartPx - relationship.sourceEndPx;
    return Number.isFinite(gap) && gap > maximumGapPx;
  }).map((relationship) => ({
    ...relationship,
    gapPx: round(relationship.targetStartPx - relationship.sourceEndPx),
  }));
}

export function findGeometryDrift(snapshots, tolerancePx = 1) {
  const grouped = new Map();
  for (const snapshot of snapshots ?? []) {
    if (!snapshot?.name || !snapshot?.bounds) continue;
    if (!grouped.has(snapshot.name)) grouped.set(snapshot.name, []);
    grouped.get(snapshot.name).push(snapshot);
  }
  const findings = [];
  for (const [name, samples] of grouped) {
    const baseline = samples[0];
    for (const sample of samples.slice(1)) {
      const delta = baseline.bounds.map((value, index) => sample.bounds[index] - value);
      if (delta.some((value) => Math.abs(value) > tolerancePx)) {
        findings.push({
          name,
          baselineState: baseline.state,
          state: sample.state,
          baselineBounds: baseline.bounds,
          bounds: sample.bounds,
          delta,
        });
      }
    }
  }
  return findings;
}

export function findRegionAllocationViolations(regions) {
  return (regions ?? []).filter((region) => {
    if (!Number.isFinite(region.fraction)) return false;
    return (Number.isFinite(region.minimumFraction) && region.fraction < region.minimumFraction)
      || (Number.isFinite(region.maximumFraction) && region.fraction > region.maximumFraction);
  }).map((region) => ({
    name: region.name,
    role: region.role,
    fraction: round(region.fraction),
    minimumFraction: region.minimumFraction,
    maximumFraction: region.maximumFraction,
  }));
}

export function cameraPreviewFraction(previewHeightPx, screenHeightPx) {
  if (!(screenHeightPx > 0) || !(previewHeightPx >= 0)) return null;
  return previewHeightPx / screenHeightPx;
}

export function cameraPreviewIsTooSmall(previewHeightPx, screenHeightPx, minimumFraction = 0.4) {
  const fraction = cameraPreviewFraction(previewHeightPx, screenHeightPx);
  return fraction != null && fraction < minimumFraction;
}
