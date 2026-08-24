function clampChannel(value) {
  return Math.max(0, Math.min(255, Number(value) || 0));
}

export function parseCssColor(value) {
  const input = String(value ?? "").trim().toLowerCase();
  if (input === "transparent") return { red: 0, green: 0, blue: 0, alpha: 0 };

  const hex = input.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    const expanded = hex.length === 3 || hex.length === 4
      ? [...hex].map((digit) => `${digit}${digit}`).join("")
      : hex;
    if (expanded.length === 6 || expanded.length === 8) {
      return {
        red: parseInt(expanded.slice(0, 2), 16),
        green: parseInt(expanded.slice(2, 4), 16),
        blue: parseInt(expanded.slice(4, 6), 16),
        alpha: expanded.length === 8 ? parseInt(expanded.slice(6, 8), 16) / 255 : 1,
      };
    }
  }

  const functional = input.match(/^rgba?\((.*)\)$/i)?.[1];
  if (!functional) throw new TypeError(`Unsupported CSS color: ${value}`);
  const parts = functional
    .replace(/\s*\/\s*/, " ")
    .replace(/,/g, " ")
    .trim()
    .split(/\s+/);
  if (parts.length < 3) throw new TypeError(`Unsupported CSS color: ${value}`);
  const channel = (part) => part.endsWith("%")
    ? clampChannel(parseFloat(part) * 2.55)
    : clampChannel(parseFloat(part));
  const alphaPart = parts[3] ?? "1";
  const alpha = alphaPart.endsWith("%")
    ? parseFloat(alphaPart) / 100
    : parseFloat(alphaPart);
  return {
    red: channel(parts[0]),
    green: channel(parts[1]),
    blue: channel(parts[2]),
    alpha: Math.max(0, Math.min(1, Number.isFinite(alpha) ? alpha : 1)),
  };
}

export function compositeColors(foreground, background) {
  const front = typeof foreground === "string" ? parseCssColor(foreground) : foreground;
  const back = typeof background === "string" ? parseCssColor(background) : background;
  const outputAlpha = front.alpha + back.alpha * (1 - front.alpha);
  if (outputAlpha <= 0) return { red: 0, green: 0, blue: 0, alpha: 0 };
  const mix = (frontChannel, backChannel) => (
    (frontChannel * front.alpha + backChannel * back.alpha * (1 - front.alpha)) / outputAlpha
  );
  return {
    red: mix(front.red, back.red),
    green: mix(front.green, back.green),
    blue: mix(front.blue, back.blue),
    alpha: outputAlpha,
  };
}

export function relativeLuminance(color) {
  const parsed = typeof color === "string" ? parseCssColor(color) : color;
  const linear = (channel) => {
    const value = channel / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(parsed.red) + 0.7152 * linear(parsed.green) + 0.0722 * linear(parsed.blue);
}

export function contrastRatio(first, second) {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

const round = (value) => Math.round(value * 100) / 100;

export function analyzeScanContrastMatrix(rawThemes, {
  textThreshold = 4.5,
  nonTextThreshold = 3,
} = {}) {
  const themes = rawThemes.map((theme) => {
    const neutral = theme.states.find((state) => state.name === "neutral");
    if (!neutral) throw new TypeError(`${theme.name} has no neutral scan state`);
    const neutralBackground = parseCssColor(neutral.background);
    const states = theme.states.map((state) => {
      const text = parseCssColor(state.text);
      const background = parseCssColor(state.background);
      const border = parseCssColor(state.border);
      const progressSurface = compositeColors(state.progressFill, background);
      const progressEdge = state.progressEdge ? parseCssColor(state.progressEdge) : null;
      const progressEdgeWidth = Number(state.progressEdgeWidth) || 0;
      const baseTextContrast = contrastRatio(text, background);
      const filledTextContrast = contrastRatio(text, progressSurface);
      const backgroundContrast = contrastRatio(background, neutralBackground);
      const borderContrast = contrastRatio(border, neutralBackground);
      const progressContrast = contrastRatio(progressSurface, background);
      const progressEdgeContrast = progressEdge
        ? Math.min(contrastRatio(progressEdge, background), contrastRatio(progressEdge, progressSurface))
        : 1;
      const effectiveProgressIndicatorContrast = progressEdgeWidth >= 6
        ? Math.max(progressContrast, progressEdgeContrast)
        : progressContrast;
      const progress = [
        { percent: 0, minimumTextContrast: baseTextContrast },
        { percent: 50, minimumTextContrast: Math.min(baseTextContrast, filledTextContrast) },
        { percent: 100, minimumTextContrast: filledTextContrast },
      ].map((sample) => ({ ...sample, minimumTextContrast: round(sample.minimumTextContrast) }));
      return {
        ...state,
        baseTextContrast: round(baseTextContrast),
        filledTextContrast: round(filledTextContrast),
        minimumTextContrast: round(Math.min(baseTextContrast, filledTextContrast)),
        backgroundContrastFromNeutral: round(backgroundContrast),
        borderContrastFromNeutral: round(borderContrast),
        activeIndicatorContrast: round(Math.max(backgroundContrast, borderContrast)),
        progressFillContrast: round(progressContrast),
        progressEdgeContrast: round(progressEdgeContrast),
        progressEdgeWidth,
        progressIndicatorContrast: round(effectiveProgressIndicatorContrast),
        progress,
      };
    });
    return { ...theme, states };
  });

  const textFailures = [];
  const activeIndicatorFailures = [];
  const progressFailures = [];
  for (const theme of themes) {
    for (const state of theme.states) {
      if (state.minimumTextContrast < textThreshold) {
        textFailures.push({ theme: theme.name, state: state.name, ratio: state.minimumTextContrast });
      }
      if (state.name !== "neutral" && state.activeIndicatorContrast < nonTextThreshold) {
        activeIndicatorFailures.push({ theme: theme.name, state: state.name, ratio: state.activeIndicatorContrast });
      }
      if (state.progressIndicatorContrast < nonTextThreshold) {
        progressFailures.push({ theme: theme.name, state: state.name, ratio: state.progressIndicatorContrast });
      }
    }
  }

  return {
    thresholds: { text: textThreshold, nonText: nonTextThreshold },
    themes,
    failures: { text: textFailures, activeIndicator: activeIndicatorFailures, progress: progressFailures },
  };
}
