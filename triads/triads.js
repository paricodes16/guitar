/* Triads on guitar. Needs ../shared/audio.js. Vanilla JavaScript, no dependencies. */
'use strict';

// ---- theory start ----------------------------------------------------------
const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
// Open-string pitches as MIDI numbers, top to bottom of the drawing: 6th string first.
const OPEN = [40, 45, 50, 55, 59, 64];
const FIRST_FRET = 0, LAST_FRET = 15;

const QUALITY = {
  major:      { label: 'major',      symbol: '',    intervals: [0, 4, 7], formula: '1 – 3 – 5',   thirds: [4, 3] },
  minor:      { label: 'minor',      symbol: 'm',   intervals: [0, 3, 7], formula: '1 – ♭3 – 5',  thirds: [3, 4] },
  diminished: { label: 'diminished', symbol: 'dim', intervals: [0, 3, 6], formula: '1 – ♭3 – ♭5', thirds: [3, 3] }
};
const THIRD_NAME = { 3: 'a minor third (3 semitones)', 4: 'a major third (4 semitones)' };

// The seven triads built on the C major scale. rootPc: C=0, D=2, E=4, F=5, G=7, A=9, B=11.
const CHORDS = [
  { rootPc: 0,  quality: 'major',      roman: 'I',    fn: 'Tonic' },
  { rootPc: 2,  quality: 'minor',      roman: 'ii',   fn: 'Supertonic' },
  { rootPc: 4,  quality: 'minor',      roman: 'iii',  fn: 'Mediant' },
  { rootPc: 5,  quality: 'major',      roman: 'IV',   fn: 'Subdominant' },
  { rootPc: 7,  quality: 'major',      roman: 'V',    fn: 'Dominant' },
  { rootPc: 9,  quality: 'minor',      roman: 'vi',   fn: 'Submediant' },
  { rootPc: 11, quality: 'diminished', roman: 'vii°', fn: 'Leading tone' }
];

const INVERSIONS = [
  { name: 'Root position', figured: '5/3', above: '3rd and 5th' },
  { name: '1st inversion', figured: '6',   above: '3rd and 6th' },
  { name: '2nd inversion', figured: '6/4', above: '4th and 6th' }
];

// Three neighbouring strings. `bass` is the lowest-pitched string of the set,
// numbered from the top of the drawing (0 = 6th string).
const SETS = [
  { bass: 3, label: 'Strings 3-2-1', notes: 'G B E' },
  { bass: 2, label: 'Strings 4-3-2', notes: 'D G B' },
  { bass: 1, label: 'Strings 5-4-3', notes: 'A D G' },
  { bass: 0, label: 'Strings 6-5-4', notes: 'E A D' }
];

const ROLES = ['R', '3', '5'];
const nameOf = m => NOTE_NAMES[((m % 12) + 12) % 12];
const chordPcs = c => QUALITY[c.quality].intervals.map(i => (c.rootPc + i) % 12);
const chordSymbol = c => NOTE_NAMES[c.rootPc] + QUALITY[c.quality].symbol;

// All close-position voicings of one inversion on one string set. The bass note
// goes on the lowest string, then each higher string gets the next chord tone up.
function findShapes(chord, inv, bass, maxFret) {
  const pcs = chordPcs(chord);
  const order = [pcs[inv % 3], pcs[(inv + 1) % 3], pcs[(inv + 2) % 3]];
  const roles = [ROLES[inv % 3], ROLES[(inv + 1) % 3], ROLES[(inv + 2) % 3]];
  const shapes = [];
  for (let f0 = 0; f0 <= maxFret; f0++) {
    let prev = OPEN[bass] + f0;
    if (prev % 12 !== order[0]) continue;
    const notes = [{ s: bass, f: f0, midi: prev, role: roles[0] }];
    let ok = true;
    for (let k = 1; k < 3; k++) {
      const s = bass + k;
      let found = -1;
      for (let f = 0; f <= maxFret; f++) {
        const m = OPEN[s] + f;
        if (m > prev && m % 12 === order[k]) { found = f; break; }
      }
      if (found < 0) { ok = false; break; }
      prev = OPEN[s] + found;
      notes.push({ s, f: found, midi: prev, role: roles[k] });
    }
    if (!ok) continue;
    const frets = notes.map(n => n.f);
    if (Math.max(...frets) - Math.min(...frets) > 5) continue; // too big a stretch
    shapes.push(notes);
  }
  return shapes;
}
// ---- theory end ------------------------------------------------------------

if (typeof document !== 'undefined') {
  const ORD = { 1: '1st', 2: '2nd', 3: '3rd', 4: '4th', 5: '5th', 6: '6th' };
  const STRING_LABEL = ['E', 'A', 'D', 'G', 'B', 'E'];

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

  const neck = $('neck'), cardsEl = $('cards');
  const state = { chord: 0, set: 0, focus: null, tones: false, showAll: false, shapes: [[], [], []] };

  const noteBtns = OPEN.map(() => []);
  const stringLines = [];
  const btnAt = (s, f) => noteBtns[s][f - FIRST_FRET];
  let timers = [];

  // ----- Fretboard -----
  function buildNeck() {
    neck.style.setProperty('--cols', LAST_FRET - FIRST_FRET + 1);

    const nums = el('div', 'fret-nums');
    nums.append(el('span', 'lbl', 'Fret'));
    for (let f = FIRST_FRET; f <= LAST_FRET; f++) nums.append(el('span', '', f === 0 ? 'Open' : f));
    neck.append(nums);

    const rows = el('div', 'rows');
    rows.append(el('div', 'wood'));
    const thickness = [4.6, 3.8, 3.1, 2.4, 1.9, 1.5];

    OPEN.forEach((open, s) => {
      const row = el('div', 'row ' + (s < 3 ? 'wound' : 'plain'));
      row.style.setProperty('--t', thickness[s] + 'px');

      const name = el('div', 'string-name');
      name.append(el('b', '', STRING_LABEL[s]), el('small', '', ORD[6 - s]));
      const line = el('div', 'string-line');
      stringLines.push(line);
      row.append(name, line);

      for (let f = FIRST_FRET; f <= LAST_FRET; f++) {
        const cell = el('div', 'cell' + (f === 0 ? ' open' : '') + (f === 1 ? ' after-nut' : ''));
        const btn = el('button', 'note out');
        btn.type = 'button';
        btn.dataset.midi = open + f;
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
      if ([3, 5, 7, 9, 15].includes(f)) sp.append(el('i'));
      if (f === 12) sp.append(el('i'), el('i'));
      inlays.append(sp);
    }
    neck.append(inlays);
  }

  // ----- Sound -----
  function sound(s, f) {
    GuitarAudio.pluck(s, OPEN[s] + f);
    restart(btnAt(s, f), 'now', 450);
    restart(stringLines[s], 'vib', 750);
  }
  function hit(s, f) { sound(s, f); }

  function stopTimers() { timers.forEach(clearTimeout); timers = []; }

  function playShape(shape, gap, startAt) {
    shape.forEach((n, i) => timers.push(setTimeout(() => sound(n.s, n.f), startAt + i * gap)));
  }
  function playInversion(inv, gap) {
    const shape = state.shapes[inv][0];
    if (!shape) return;
    GuitarAudio.ensure();
    stopTimers();
    playShape(shape, gap, 0);
  }
  function playAll() {
    GuitarAudio.ensure();
    stopTimers();
    state.shapes.forEach((shapes, inv) => {
      if (shapes[0]) playShape(shapes[0], 60, inv * 1300);
    });
  }

  // ----- Rendering -----
  function renderBoard() {
    const chord = CHORDS[state.chord];
    const set = SETS[state.set];
    const symbol = chordSymbol(chord);

    for (let s = 0; s < 6; s++) {
      for (let f = FIRST_FRET; f <= LAST_FRET; f++) {
        const b = btnAt(s, f);
        const m = OPEN[s] + f;
        b.className = 'note out';
        b.textContent = nameOf(m);
        delete b.dataset.inv;
        b.setAttribute('aria-label', `${nameOf(m)}, ${ORD[6 - s]} string, ${f === 0 ? 'open' : 'fret ' + f}`);
      }
    }

    for (let inv = 0; inv < 3; inv++) {
      state.shapes[inv] = findShapes(chord, inv, set.bass, LAST_FRET);
      state.shapes[inv].forEach(shape => shape.forEach(n => {
        const b = btnAt(n.s, n.f);
        let cls = 'note inv' + inv + (n.role === 'R' ? ' rt' : '');
        if (state.focus !== null && state.focus !== inv) cls += ' dim';
        b.className = cls;
        b.dataset.inv = inv;
        if (state.tones) b.textContent = n.role;
        b.setAttribute('aria-label',
          `${nameOf(n.midi)}, ${ORD[6 - n.s]} string, ${n.f === 0 ? 'open' : 'fret ' + n.f}, ` +
          `${n.role === 'R' ? 'root' : n.role === '3' ? 'third' : 'fifth'} of ${symbol}, ${INVERSIONS[inv].name}`);
      }));
    }

    neck.classList.toggle('only-scale', !state.showAll);
    neck.classList.toggle('focusing', state.focus !== null);
  }

  function fretText(n) {
    return `${ORD[6 - n.s]} string ${n.f === 0 ? 'open' : 'fret ' + n.f}`;
  }

  function renderCards() {
    const chord = CHORDS[state.chord];
    const symbol = chordSymbol(chord);
    cardsEl.textContent = '';

    INVERSIONS.forEach((info, inv) => {
      const shapes = state.shapes[inv];
      const shape = shapes[0];
      const card = el('article', 'inv-card');
      card.style.setProperty('--c', `var(--c${inv})`);
      card.append(el('h3', '', info.name));

      if (!shape) {
        card.append(el('p', 'meta', 'This shape does not fit on these strings within the frets shown.'));
        cardsEl.append(card);
        return;
      }

      const bassName = nameOf(shape[0].midi);
      card.append(el('p', 'notes-line', shape.map(n => nameOf(n.midi)).join('  ')));
      card.append(el('p', 'meta',
        `Low to high. Chord symbol ${inv === 0 ? symbol : symbol + '/' + bassName}, ` +
        `${bassName} in the bass, figured bass ${info.figured}.`));
      card.append(el('p', 'frets',
        shape.map(fretText).join(', ') + (shapes.length > 1 ? '. The same shape repeats higher up the neck.' : '.')));

      const actions = el('div', 'card-actions');
      const chordBtn = el('button', 'btn', 'Hear chord');
      chordBtn.type = 'button';
      chordBtn.addEventListener('click', () => playInversion(inv, 60));
      const arpBtn = el('button', 'btn', 'Hear note by note');
      arpBtn.type = 'button';
      arpBtn.addEventListener('click', () => playInversion(inv, 450));
      const focusBtn = el('button', 'btn', 'Show only this');
      focusBtn.type = 'button';
      focusBtn.setAttribute('aria-pressed', String(state.focus === inv));
      focusBtn.addEventListener('click', () => {
        state.focus = state.focus === inv ? null : inv;
        render();
      });
      actions.append(chordBtn, arpBtn, focusBtn);
      card.append(actions);
      cardsEl.append(card);
    });
  }

  function renderSegs() {
    document.querySelectorAll('#chordSeg button').forEach((b, i) =>
      b.setAttribute('aria-pressed', String(i === state.chord)));
    document.querySelectorAll('#setSeg button').forEach((b, i) =>
      b.setAttribute('aria-pressed', String(i === state.set)));
    document.querySelectorAll('.chord-name').forEach(n => { n.textContent = chordSymbol(CHORDS[state.chord]); });
  }

  function renderTheory() {
    const chord = CHORDS[state.chord];
    const q = QUALITY[chord.quality];
    const pcs = chordPcs(chord);
    const names = pcs.map(nameOf);
    const symbol = chordSymbol(chord);
    const lowerPart = q.thirds.map(t => THIRD_NAME[t]);

    $('chordFacts').innerHTML =
      `<strong>${symbol}</strong> is chord ${chord.roman} of C major (the ${chord.fn.toLowerCase()} chord). ` +
      `Its notes are ${names[0]}, ${names[1]} and ${names[2]}. ` +
      `${names[0]} to ${names[1]} is ${lowerPart[0]} and ${names[1]} to ${names[2]} is ${lowerPart[1]}, ` +
      `so it is a ${q.label} triad with the formula ${q.formula}.`;

    const invBody = $('invTable').querySelector('tbody');
    invBody.textContent = '';
    INVERSIONS.forEach((info, inv) => {
      const order = [pcs[inv % 3], pcs[(inv + 1) % 3], pcs[(inv + 2) % 3]].map(nameOf);
      const tr = el('tr');
      [info.name, order[0], order.join(' '), inv === 0 ? symbol : `${symbol}/${order[0]}`, info.above]
        .forEach(t => tr.append(el('td', '', t)));
      tr.firstChild.className = 'swatch inv' + inv;
      invBody.append(tr);
    });

    const diaBody = $('diatonic').querySelector('tbody');
    diaBody.textContent = '';
    CHORDS.forEach((c, i) => {
      const tr = el('tr');
      if (i === state.chord) tr.className = 'sel';
      const n = chordPcs(c).map(nameOf).join(' ');
      const btnCell = el('td');
      const b = el('button', 'link-btn', chordSymbol(c));
      b.type = 'button';
      b.addEventListener('click', () => { state.chord = i; state.focus = null; render(); });
      btnCell.append(b);
      tr.append(el('td', '', c.roman), btnCell, el('td', '', n), el('td', '', QUALITY[c.quality].label), el('td', '', c.fn));
      diaBody.append(tr);
    });
  }

  function render() {
    renderBoard();
    renderCards();
    renderSegs();
    renderTheory();
  }

  // ----- Controls -----
  function buildSegs() {
    CHORDS.forEach((c, i) => {
      const b = el('button', 'seg-btn');
      b.type = 'button';
      b.append(el('b', '', chordSymbol(c)), el('small', '', c.roman));
      b.addEventListener('click', () => { stopTimers(); state.chord = i; state.focus = null; render(); });
      $('chordSeg').append(b);
    });
    SETS.forEach((set, i) => {
      const b = el('button', 'seg-btn');
      b.type = 'button';
      b.append(el('b', '', set.label), el('small', '', set.notes));
      b.addEventListener('click', () => { stopTimers(); state.set = i; state.focus = null; render(); });
      $('setSeg').append(b);
    });
  }

  $('showTones').addEventListener('change', e => { state.tones = e.target.checked; renderBoard(); });
  $('showAll').addEventListener('change', e => { state.showAll = e.target.checked; renderBoard(); });
  $('playAll').addEventListener('click', playAll);
  $('stop').addEventListener('click', stopTimers);

  // ----- Start -----
  buildNeck();
  buildSegs();
  render();
}
