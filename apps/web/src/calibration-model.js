/** State and statistics for helper-facing input testing. */
export function createCalibrationState(inputClass = "reliable") {
  return {
    inputClass,
    events: [],
    lastEventAt: 0,
    rest: {
      running: false,
      startedAt: 0,
      durationMs: 10000,
      events: []
    },
    trials: {
      running: false,
      total: 5,
      index: 0,
      awaitingNext: false,
      results: []
    }
  };
}

export function duplicateCalibrationEvents(events) {
  return events.filter((event) => event.deltaMs !== null && event.deltaMs < 300);
}

export function medianCalibrationInterval(events) {
  const intervals = events
    .map((event) => event.deltaMs)
    .filter((value) => value !== null && value >= 300)
    .sort((left, right) => left - right);
  if (intervals.length === 0) return null;
  return intervals[Math.floor(intervals.length / 2)];
}
