// Procedural sound for SKY LEGENDS: no audio files, everything is synthesised.
// One job: engine hum, wind, chimes and thuds from the Web Audio API.
// Every call is guarded — sound must never break the game.

export function makeAudio() {
  return {
    ctx: null, engineOsc: null, engineOsc2: null, engineGain: null,
    windSrc: null, windGain: null, windFilter: null,
    muted: false, started: false,
  };
}

export function ensureAudio(a) {
  if (a.started || a.muted) return;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    a.ctx = ctx;
    // Engine: two detuned saws through a lowpass, pitch follows throttle.
    a.engineOsc = ctx.createOscillator();
    a.engineOsc.type = 'sawtooth';
    a.engineOsc.frequency.value = 55;
    a.engineOsc2 = ctx.createOscillator();
    a.engineOsc2.type = 'sawtooth';
    a.engineOsc2.frequency.value = 55.7;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.2;
    a.engineGain = ctx.createGain();
    a.engineGain.gain.value = 0.0;
    a.engineOsc.connect(lp); a.engineOsc2.connect(lp);
    lp.connect(a.engineGain); a.engineGain.connect(ctx.destination);
    a.engineOsc.start(); a.engineOsc2.start();
    // Wind: looped noise buffer through a bandpass, gain follows speed.
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    a.windSrc = ctx.createBufferSource();
    a.windSrc.buffer = buf; a.windSrc.loop = true;
    a.windFilter = ctx.createBiquadFilter();
    a.windFilter.type = 'bandpass'; a.windFilter.frequency.value = 700; a.windFilter.Q.value = 0.6;
    a.windGain = ctx.createGain();
    a.windGain.gain.value = 0;
    a.windSrc.connect(a.windFilter); a.windFilter.connect(a.windGain);
    a.windGain.connect(ctx.destination);
    a.windSrc.start();
    a.started = true;
  } catch (err) {
    a.started = false;
  }
}

export function updateAudio(a, plane, dt) {
  if (!a.started || !a.ctx || a.muted) return;
  try {
    if (a.ctx.state === 'suspended') a.ctx.resume();
    const target = plane.onGround && plane.speed < 2 ? 0 : 0.05 + plane.throttle * 0.11;
    a.engineGain.gain.setTargetAtTime(target, a.ctx.currentTime, 0.1);
    const freq = 48 + plane.throttle * 90 + plane.speed * 0.35;
    a.engineOsc.frequency.setTargetAtTime(freq, a.ctx.currentTime, 0.08);
    a.engineOsc2.frequency.setTargetAtTime(freq * 1.012, a.ctx.currentTime, 0.08);
    const wind = Math.min(0.16, (plane.speed / 122) * 0.16);
    a.windGain.gain.setTargetAtTime(plane.onGround ? 0 : wind, a.ctx.currentTime, 0.15);
    a.windFilter.frequency.setTargetAtTime(500 + plane.speed * 9, a.ctx.currentTime, 0.1);
  } catch (err) { /* sound is best-effort */ }
}

function blip(a, freq, dur, type = 'sine', gain = 0.18, when = 0) {
  if (!a.started || !a.ctx || a.muted) return;
  try {
    const t0 = a.ctx.currentTime + when;
    const o = a.ctx.createOscillator();
    o.type = type; o.frequency.value = freq;
    const g = a.ctx.createGain();
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(a.ctx.destination);
    o.start(t0); o.stop(t0 + dur + 0.05);
  } catch (err) { /* sound is best-effort */ }
}

export function playRingChime(a) {
  blip(a, 880, 0.5); blip(a, 1318, 0.6, 'sine', 0.14, 0.08); blip(a, 1760, 0.7, 'sine', 0.1, 0.16);
}

export function playThud(a) {
  blip(a, 70, 0.35, 'sine', 0.3); blip(a, 45, 0.5, 'triangle', 0.22, 0.02);
}

export function playCrash(a) {
  blip(a, 55, 0.8, 'sawtooth', 0.25); blip(a, 38, 1.0, 'sine', 0.28, 0.05);
}

export function playWarning(a) {
  blip(a, 1180, 0.12, 'square', 0.07);
}

export function setMuted(a, muted) {
  a.muted = muted;
  if (a.ctx && a.engineGain) a.engineGain.gain.value = 0;
  if (a.ctx && a.windGain) a.windGain.gain.value = 0;
}
