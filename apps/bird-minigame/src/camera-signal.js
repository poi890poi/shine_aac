// Presentation only: the host supplies detector status, never camera images.
export function cameraSignal(input = {}) {
  if (!input.enabled) return { visible: false, state: 'off', level: 0 };
  const live = ['live', 'analysis', 'blink'].includes(input.state);
  const waiting = ['active', 'starting', 'restarting', 'powerSaving'].includes(input.state);
  const finite = value => typeof value === 'number' && Number.isFinite(value);
  const level = live && finite(input.score) && finite(input.threshold) && input.threshold > 0
    ? Math.max(0, Math.min(1, input.score / input.threshold)) : 0;
  return { visible: true, state: live ? 'live' : waiting ? 'waiting' : 'unavailable', level };
}
