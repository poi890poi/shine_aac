export function createGameAudio() {
  let context = null;
  let muted = false;
  const active = new Set();
  const notes = { drop: [480, 240], hit: [170, 410], cleared: [520, 690], collision: [130, 190, 310, 520], won: [440, 550, 660, 880] };
  function stop() {
    for (const node of active) { try { node.stop(); } catch {} }
    active.clear();
  }
  return {
    unlock() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!context && Audio) context = new Audio();
      if (context?.state === "suspended") void context.resume().catch(() => {});
    },
    play(type) {
      if (muted || !context || !notes[type]) return;
      stop();
      notes[type].forEach((frequency, index) => {
        const start = context.currentTime + index * 0.08;
        const tone = context.createOscillator(), gain = context.createGain();
        tone.type = "triangle"; tone.frequency.value = frequency;
        gain.gain.setValueAtTime(0.035, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
        tone.connect(gain); gain.connect(context.destination);
        active.add(tone); tone.onended = () => { active.delete(tone); tone.disconnect(); gain.disconnect(); };
        tone.start(start); tone.stop(start + 0.1);
      });
    },
    setMuted(value) { muted = value; if (muted) stop(); },
    stop,
    destroy() { stop(); if (context) void context.close().catch(() => {}); }
  };
}
