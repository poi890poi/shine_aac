// Original synthesized effects, shared by live play and event-synced demo audio.
// Voice: delay, duration, start pitch, end pitch, waveform, peak gain.
export const SOUND_EFFECTS=Object.freeze({
  drop:[[0,.24,900,140,'triangle',.07]],
  miss:[[0,.16,115,48,'sawtooth',.035],[.10,.12,85,42,'triangle',.045]],
  hit:[[0,.13,130,520,'sine',.10],[.09,.12,360,85,'triangle',.06]],
  cleared:[[0,.1,480,620,'triangle',.055],[.1,.13,720,960,'triangle',.055]],
  collision:[[0,.16,110,520,'triangle',.08],[.14,.2,420,100,'triangle',.07],[.33,.13,100,280,'triangle',.05]],
  landing:[[0,.18,740,400,'triangle',.045],[.17,.18,570,300,'triangle',.045]],
  won:[[0,.12,440,440,'triangle',.06],[.13,.12,550,550,'triangle',.06],[.26,.12,660,660,'triangle',.06],[.39,.28,880,1040,'triangle',.06]]
});
export function scheduleEffect(context,type,time=context.currentTime,active=new Set()){
  for(const [delay,duration,from,to,wave,level] of SOUND_EFFECTS[type]??[]){
    const start=time+delay,tone=context.createOscillator(),gain=context.createGain();
    tone.type=wave;tone.frequency.setValueAtTime(from,start);
    tone.frequency.exponentialRampToValueAtTime(to,start+duration);
    gain.gain.setValueAtTime(.0001,start);gain.gain.exponentialRampToValueAtTime(level,start+.008);
    gain.gain.exponentialRampToValueAtTime(.0001,start+duration);
    tone.connect(gain);gain.connect(context.destination);active.add(tone);
    tone.onended=()=>{active.delete(tone);tone.disconnect();gain.disconnect();};
    tone.start(start);tone.stop(start+duration+.01);
  }
  return active;
}
export function createGameAudio() {
  let context = null;
  let muted = false;
  const active = new Set();
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
      if (muted || !context || !SOUND_EFFECTS[type]) return;
      if(active.size>16)stop();
      scheduleEffect(context,type,context.currentTime,active);
    },
    setMuted(value) { muted = value; if (muted) stop(); },
    stop,
    destroy() { stop(); if (context) void context.close().catch(() => {}); }
  };
}
