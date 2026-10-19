/* Shared guitar audio: plucked-string synth plus mobile-safe Web Audio.
   Exposes window.GuitarAudio = { ensure(), pluck(stringIndex, midi) }.
   String index 0 is the 6th string (low E) ... 5 is the 1st string (high E). */
(function () {
  'use strict';

  // ---- synth start ----
  // Karplus-Strong plucked string. Returns samples plus a playback rate that
  // corrects the small tuning error caused by the whole-number delay line.
  function synthPluck(freq, sr) {
    const N = Math.max(2, Math.round(sr / freq + 0.5));
    const actual = sr / (N - 0.5);
    const decay = Math.pow(0.001, 1 / (freq * 2.6));
    const len = Math.floor(sr * 3);

    const line = new Float32Array(N);
    let soft = 0;
    for (let i = 0; i < N; i++) {
      soft = soft * 0.35 + (Math.random() * 2 - 1) * 0.65;
      line[i] = soft;
    }

    const out = new Float32Array(len);
    let idx = 0, peak = 0;
    for (let n = 0; n < len; n++) {
      const a = line[idx];
      const b = line[(idx + 1) % N];
      out[n] = a;
      if (Math.abs(a) > peak) peak = Math.abs(a);
      line[idx] = (a + b) * 0.5 * decay;
      idx = (idx + 1) % N;
    }

    const gain = 0.85 / (peak || 1);
    const fade = 2400;
    for (let n = 0; n < len; n++) {
      out[n] *= gain * (n > len - fade ? (len - n) / fade : 1);
    }
    return { data: out, rate: freq / actual };
  }
  // ---- synth end ----

  const midiToFreq = m => 440 * Math.pow(2, (m - 69) / 12);
  let ctx = null, master = null, unlocked = false;
  const buffers = new Map();
  const voices = Array(6).fill(null);

  function ensure() {
    if (!ctx) {
      // iOS 17+: treat the page as media playback so the silent switch doesn't mute it.
      if (navigator.audioSession) {
        try { navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false; // no Web Audio support: stay silent instead of failing
      ctx = new AC();
      const tone = ctx.createBiquadFilter();
      tone.type = 'lowpass';
      tone.frequency.value = 4500;
      const comp = ctx.createDynamicsCompressor();
      master = ctx.createGain();
      master.gain.value = 0.85;
      master.connect(tone);
      tone.connect(comp);
      comp.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // Mobile browsers only let audio start from certain gestures (iOS Safari
  // ignores pointerdown), so unlock on the events they do accept.
  function unlock() {
    if (unlocked) return;
    if (!ensure()) return;
    const silent = ctx.createBufferSource();
    silent.buffer = ctx.createBuffer(1, 1, 22050);
    silent.connect(ctx.destination);
    silent.start(0);
    const p = ctx.resume();
    if (p && p.then) {
      p.then(() => { if (ctx.state === 'running') unlocked = true; }).catch(() => {});
    } else if (ctx.state === 'running') {
      unlocked = true;
    }
  }
  ['touchend', 'pointerup', 'click', 'keydown'].forEach(ev =>
    document.addEventListener(ev, unlock, { passive: true }));

  function getBuffer(midi) {
    let entry = buffers.get(midi);
    if (!entry) {
      const { data, rate } = synthPluck(midiToFreq(midi), ctx.sampleRate);
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data, 0);
      entry = { buf, rate };
      buffers.set(midi, entry);
    }
    return entry;
  }

  function pluck(s, midi) {
    if (!ensure()) return;
    const { buf, rate } = getBuffer(midi);
    const now = ctx.currentTime;

    // A new note on a string silences the previous one on that string.
    const prev = voices[s];
    if (prev) {
      prev.g.gain.cancelScheduledValues(now);
      prev.g.gain.setTargetAtTime(0, now, 0.025);
      try { prev.src.stop(now + 0.2); } catch (e) { /* already stopped */ }
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    src.connect(g);
    g.connect(master);
    src.start(now);
    voices[s] = { src, g };
  }

  window.GuitarAudio = { ensure, pluck };
})();
