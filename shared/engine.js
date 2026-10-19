/* Guitar scale trainer engine — vanilla JavaScript, no dependencies.
   Each scale page defines a global SCALE object (see a-minor/scale.js) before loading this file. */
'use strict';

// ---- synth start -----------------------------------------------------------
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
// ---- synth end -------------------------------------------------------------

if (typeof document !== 'undefined') {
  // ----- Guitar data -----
  const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  // Top to bottom: 6th string (low E) first, like tab.
  const STRINGS = [
    { num: 6, label: 'E', open: 40, wound: true,  t: 4.6 },
    { num: 5, label: 'A', open: 45, wound: true,  t: 3.8 },
    { num: 4, label: 'D', open: 50, wound: true,  t: 3.1 },
    { num: 3, label: 'G', open: 55, wound: false, t: 2.4 },
    { num: 2, label: 'B', open: 59, wound: false, t: 1.9 },
    { num: 1, label: 'E', open: 64, wound: false, t: 1.5 }
  ];
  const ORDINAL = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th' };
  const FIRST_FRET = SCALE.firstFret, LAST_FRET = SCALE.lastFret;
  const SCALE_PCS = new Set(SCALE.pitchClasses);
  const ROOT_PC = SCALE.rootPitchClass;
  const PATH = SCALE.path; // [string index, fret] pairs, in playing order

  const midiOf = (s, f) => STRINGS[s].open + f;
  const nameOf = m => NOTE_NAMES[m % 12];
  const freqOf = m => 440 * Math.pow(2, (m - 69) / 12);
  const PATH_MIDI = PATH.map(([s, f]) => midiOf(s, f));

  // ----- Audio -----
  let ctx = null, master = null;
  const buffers = new Map();
  const voices = Array(STRINGS.length).fill(null);

  function ensureAudio() {
    if (!ctx) {
      // iOS 17+: treat this page as media playback so the silent switch doesn't mute it.
      if (navigator.audioSession) {
        try { navigator.audioSession.type = 'playback'; } catch (e) { /* not supported */ }
      }
      const AC = window.AudioContext || window.webkitAudioContext;
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
  }

  // Mobile browsers only let audio start from certain gestures (iOS Safari
  // ignores pointerdown), so unlock on the events they do accept.
  let unlocked = false;
  function unlockAudio() {
    if (unlocked) return;
    ensureAudio();
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
    document.addEventListener(ev, unlockAudio, { passive: true }));

  function getBuffer(midi) {
    let entry = buffers.get(midi);
    if (!entry) {
      const { data, rate } = synthPluck(freqOf(midi), ctx.sampleRate);
      const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
      buf.copyToChannel(data, 0);
      entry = { buf, rate };
      buffers.set(midi, entry);
    }
    return entry;
  }

  function pluck(s, midi) {
    ensureAudio();
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

  // ----- DOM helpers -----
  const $ = id => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const restart = (node, cls, ms) => {
    node.classList.remove(cls);
    void node.offsetWidth;
    node.classList.add(cls);
    setTimeout(() => node.classList.remove(cls), ms);
  };

  const neck = $('neck'), strip = $('strip'), status = $('status');
  const bpmInput = $('bpm'), bpmOut = $('bpmOut');
  const showOut = $('showOut'), showHint = $('showHint'), practiceBtn = $('practice');

  const noteBtns = STRINGS.map(() => []);
  const stringLines = [];
  const chips = [];

  // ----- Build the fretboard -----
  function buildNeck() {
    const frets = LAST_FRET - FIRST_FRET + 1;
    neck.style.setProperty('--cols', frets);

    const nums = el('div', 'fret-nums');
    nums.append(el('span', 'lbl', 'Fret'));
    for (let f = FIRST_FRET; f <= LAST_FRET; f++) nums.append(el('span', '', f));
    neck.append(nums);

    const rows = el('div', 'rows');
    rows.append(el('div', 'wood'));

    STRINGS.forEach((st, s) => {
      const row = el('div', 'row ' + (st.wound ? 'wound' : 'plain'));
      row.style.setProperty('--t', st.t + 'px');

      const name = el('div', 'string-name');
      name.append(el('b', '', st.label), el('small', '', ORDINAL[st.num]));
      const line = el('div', 'string-line');
      stringLines.push(line);
      row.append(name, line);

      for (let f = FIRST_FRET; f <= LAST_FRET; f++) {
        const midi = midiOf(s, f);
        const pc = midi % 12;
        const cell = el('div', 'cell');
        const btn = el('button', 'note', nameOf(midi));
        btn.type = 'button';
        btn.classList.add(SCALE_PCS.has(pc) ? 'in' : 'out');
        if (pc === ROOT_PC) btn.classList.add('root');
        btn.dataset.midi = midi;
        btn.setAttribute('aria-label', `${nameOf(midi)}, ${ORDINAL[st.num]} string, fret ${f}`);

        btn.addEventListener('pointerdown', e => { if (e.button <= 0) hit(s, f); });
        btn.addEventListener('click', e => { if (e.detail === 0) hit(s, f); }); // keyboard

        cell.append(btn);
        row.append(cell);
        noteBtns[s].push(btn);
      }
      rows.append(row);
    });
    neck.append(rows);

    const inlays = el('div', 'inlays');
    inlays.append(el('span'));
    for (let f = FIRST_FRET; f <= LAST_FRET; f++) {
      const sp = el('span');
      if ([3, 5, 7, 9, 15, 17, 19, 21].includes(f)) sp.append(el('i'));
      if (f === 12 || f === 24) sp.append(el('i'), el('i'));
      inlays.append(sp);
    }
    neck.append(inlays);
  }

  function buildStrip() {
    PATH_MIDI.forEach(m => {
      const li = el('li', m % 12 === ROOT_PC ? 'root' : '', nameOf(m));
      strip.append(li);
      chips.push(li);
    });
  }

  // ----- Visual feedback -----
  const btnAt = (s, f) => noteBtns[s][f - FIRST_FRET];

  function sound(s, f) {
    pluck(s, midiOf(s, f));
    restart(btnAt(s, f), 'now', 450);
    restart(stringLines[s], 'vib', 750);
  }

  function renderChips(nowIndex) {
    chips.forEach((c, i) => {
      c.classList.toggle('done', !!practice && i < practice.i);
      c.classList.toggle('next', !!practice && i === practice.i);
      c.classList.toggle('now', i === nowIndex);
    });
  }

  function renderTargets() {
    document.querySelectorAll('.note.target').forEach(b => b.classList.remove('target'));
    if (!practice || !showHint.checked) return;
    const want = PATH_MIDI[practice.i];
    document.querySelectorAll('.note').forEach(b => {
      if (+b.dataset.midi === want) b.classList.add('target');
    });
  }

  // ----- Playing the scale -----
  let timers = [];
  let practice = null; // { i }

  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const idleText = 'Listen with Play up, then press Practice and find each note yourself.' +
    (isIOS ? ' No sound? Turn off silent mode (the switch on the side of your phone).' : '');

  function stopAll() {
    timers.forEach(clearTimeout);
    timers = [];
    practice = null;
    practiceBtn.setAttribute('aria-pressed', 'false');
    practiceBtn.textContent = 'Practice';
    renderChips(-1);
    renderTargets();
  }

  function playScale(reverse) {
    ensureAudio();
    stopAll();
    const order = PATH.map((_, i) => i);
    if (reverse) order.reverse();
    const gap = 60000 / +bpmInput.value;
    const firstName = nameOf(PATH_MIDI[0]), lastName = nameOf(PATH_MIDI[PATH_MIDI.length - 1]);
    status.textContent = reverse
      ? `Playing ${SCALE.name}, ${lastName} down to ${firstName}.`
      : `Playing ${SCALE.name}, ${firstName} up to ${lastName}.`;

    order.forEach((pi, k) => {
      timers.push(setTimeout(() => {
        sound(PATH[pi][0], PATH[pi][1]);
        renderChips(pi);
        if (k === order.length - 1) {
          timers.push(setTimeout(() => { renderChips(-1); status.textContent = idleText; }, gap));
        }
      }, k * gap));
    });
  }

  // ----- Practice mode -----
  function startPractice() {
    ensureAudio();
    stopAll();
    practice = { i: 0 };
    practiceBtn.setAttribute('aria-pressed', 'true');
    practiceBtn.textContent = 'Practicing…';
    announceTarget();
  }

  function announceTarget() {
    const m = PATH_MIDI[practice.i];
    status.textContent = `Play ${nameOf(m)} (note ${practice.i + 1} of ${PATH.length}).` +
      (showHint.checked ? ' The glowing dot shows where.' : '');
    renderChips(-1);
    renderTargets();
  }

  function judge(s, f) {
    const midi = midiOf(s, f);
    const want = PATH_MIDI[practice.i];
    if (midi === want) {
      practice.i++;
      if (practice.i >= PATH.length) {
        const all = chips.length;
        stopAll();
        chips.forEach(c => c.classList.add('done'));
        status.textContent = `Scale complete: all ${all} notes of ${SCALE.name}. Try it again at a higher speed with Play up.`;
      } else {
        announceTarget();
      }
    } else {
      restart(btnAt(s, f), 'wrong', 500);
      status.textContent = `That was ${nameOf(midi)}. You need ${nameOf(want)} (note ${practice.i + 1} of ${PATH.length}).`;
    }
  }

  function hit(s, f) {
    sound(s, f);
    if (practice) judge(s, f);
  }

  // ----- Controls -----
  $('playUp').addEventListener('click', () => playScale(false));
  $('playDown').addEventListener('click', () => playScale(true));
  practiceBtn.addEventListener('click', startPractice);
  $('stop').addEventListener('click', () => { stopAll(); status.textContent = idleText; });

  bpmInput.addEventListener('input', () => { bpmOut.textContent = `${bpmInput.value} BPM`; });
  showOut.addEventListener('change', () => neck.classList.toggle('only-scale', !showOut.checked));
  showHint.addEventListener('change', renderTargets);

  // ----- Start -----
  buildNeck();
  buildStrip();
  status.textContent = idleText;
}
