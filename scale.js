/* A natural minor, position 1. This file is the only thing that changes between scales. */
window.SCALE = {
  name: 'A minor',
  rootPitchClass: 9,                       // A. C=0, C♯=1, D=2 ... B=11
  pitchClasses: [9, 11, 0, 2, 4, 5, 7],    // A B C D E F G
  firstFret: 5,
  lastFret: 12,
  // [string, fret] in playing order. Strings are numbered from the top of the
  // drawing: 0 = 6th string (low E) ... 5 = 1st string (high E).
  // The B string starts on fret 6 because its 5th fret (E) was already played
  // on the G string.
  path: [
    [0, 5], [0, 7], [0, 8],
    [1, 5], [1, 7], [1, 8],
    [2, 5], [2, 7], [2, 9],
    [3, 5], [3, 7], [3, 9],
    [4, 6], [4, 8],
    [5, 5]
  ]
};
