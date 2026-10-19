# Guitar lessons

Interactive fretboards for learning guitar scales and chords. Runs entirely in the browser: no frameworks, no build step, no audio files.

- Strings are drawn like tab: 6th string (low E) on top, 1st string (high E) at the bottom
- Every dot is a button named after its note, and tapping it plays that note
- Play a scale up or down at an adjustable speed, or practice it note by note with hints
- Sounds are synthesized with the Web Audio API (a plucked-string model)

## Lessons

| Lesson | Page |
| --- | --- |
| A minor scale, position 1 (frets 5 to 9) | `a-minor/` |
| Triads and inversions, starting from C major | `triads/` |

### Triads

Pick any of the seven triads built on the C major scale (C, Dm, Em, F, G, Am, Bdim) and one of four string sets.
The three inversions are shown in different colours on the fretboard, each can be played as a chord or note by note,
and the theory section below the fretboard updates for the chord you picked.

## Folder layout

```
index.html          home page listing the scales
shared/
  audio.js          plucked-string sound, with mobile fixes (used by the triads lesson)
  engine.js         fretboard, sound, play and practice logic (shared by every scale)
  style.css         styles (shared)
a-minor/
  index.html        the page for this scale
  scale.js          the scale's data: notes, frets, playing order
triads/
  index.html        the triads lesson, including the theory text
  triads.js         chord shapes, fretboard and controls
  triads.css        styles for this lesson only
```

## Add a new scale

1. Copy the `a-minor` folder and rename it, for example `c-major`.
2. Open the new folder's `scale.js` and change:
   - `name`, for example `'C major'`
   - `rootPitchClass`: C=0, C♯=1, D=2, D♯=3, E=4, F=5, F♯=6, G=7, G♯=8, A=9, A♯=10, B=11
   - `pitchClasses`: the 7 notes of the scale, using the same numbers
   - `firstFret` and `lastFret`: the frets shown on screen
   - `path`: the `[string, fret]` pairs in playing order. Strings count from the top of the drawing: `0` is the 6th string (low E), `5` is the 1st string (high E)
3. Open the new folder's `index.html` and update the `<title>`, the `<h1>` and the intro text.
4. In the root `index.html`, add another `<li>` with a link to the new folder.

Tip: in `path`, don't repeat a pitch. If a fret on one string sounds the same as a fret on the next string, play it once and skip the duplicate.

## Play locally

Open `index.html` in a modern browser.

## Deploy with GitHub Pages

1. Push these files to a public GitHub repository named `guitar`.
2. Go to **Settings, then Pages**.
3. Set **Source** to **Deploy from a branch**, choose `main` and `/ (root)`, then **Save**.
4. After a minute, the home page is live at `https://<your-username>.github.io/guitar/`, A minor is at `.../guitar/a-minor/` and triads are at `.../guitar/triads/`.
