# PGN Annotations Display — Design Spec
_2026-06-02_

## Goal

Surface per-move annotations from PGN study files on the frontend: text comments in the Sidebar, and colored arrows/squares drawn on the board. Annotations are shown _before_ the user plays each move, with a toggle to hide them.

---

## 1. Data pipeline

### What changes

`build-studies.js` currently strips all `{ }` content from PGN before parsing. A new `extractMoveAnnotations(pgnText)` function will parse annotations per half-move.

### Algorithm

1. Strip PGN header lines `[...]`.
2. Remove variations `( ... )` with proper nesting (inner parens counted).
3. Scan tokens left-to-right: move numbers, SAN moves, and `{ comment }` blocks.
4. Each SAN move collects any immediately-following comment blocks (multiple consecutive comments are merged — Lichess often splits text and `[%cal]` into separate `{ }` blocks for the same move).
5. From the merged comment, extract `[%cal ...]` and `[%csl ...]` directives; the remainder (trimmed) is the text comment.

### Color code mapping

| PGN code | Color |
|----------|-------|
| R | red |
| G | green |
| Y | yellow |
| B | blue |

### Updated position shape

```json
{
  "fen": "rnbqkbnr/...",
  "move": "d5",
  "cp": 30,
  "annotation": {
    "text": "White's best choice",
    "arrows": [{ "from": "a2", "to": "a4", "color": "red" }],
    "squares": [{ "square": "d5", "color": "green" }]
  }
}
```

`annotation` is `null` when a move has no comment. `text` may be `null` (arrows/squares only), and `arrows`/`squares` may be empty arrays (text only).

### Rebuild

After the code change, run `npm run build:studies` to regenerate `studies.json`. The `fetch-evals.js` script copies the positions array as-is into `studies-with-eval.json`, so it will preserve the new `annotation` field automatically.

---

## 2. `useDrill` — `currentAnnotation`

`useDrill` exposes one new return value:

- **`currentAnnotation`** — the annotation for the _next_ move the user must play (`positions[currentMoveIndex].annotation ?? null`). Updates automatically as the move index advances or the line resets.

No changes to internal drill logic.

---

## 3. Component wiring

`currentAnnotation` lives inside `PracticeBoard` (from `useDrill`) but the Sidebar needs the text portion.

- `PracticeBoard` accepts a new **`onAnnotationChange(annotation)`** callback prop.
- A `useEffect` in `PracticeBoard` calls it whenever `currentAnnotation` changes.
- `App.jsx` holds `currentAnnotation` in local state (initialized `null`), passes the callback to `PracticeBoard`, and passes the annotation value to `Sidebar`.
- `PracticeBoard` also reads its own `currentAnnotation` directly for board rendering (no round-trip).

---

## 4. Sidebar — annotation text + toggle

**Annotation text panel**

A `.annotation-text` block, shown when `showAnnotations` is true and `currentAnnotation.text` is non-null. Positioned above the chunk settings panel, below the progress indicator. Styled to the existing blue-dark sidebar palette.

**Show annotations toggle**

Added to the existing chunk settings panel (alongside `startDepth` and `unlockN`). A labeled toggle: "Show annotations." Defaults to `true`.

---

## 5. Board arrows and colored squares

`PracticeBoard` passes annotation data into the `Chessboard` options when `showAnnotations` is true:

- **`options.arrows`** — from `currentAnnotation.arrows`, shaped as `[{ startSquare, endSquare, color }]`.
- **`options.squareStyles`** — merged with existing highlight styles. Annotation squares add a semi-transparent background:
  - red → `rgba(255, 0, 0, 0.4)`
  - green → `rgba(0, 128, 0, 0.4)`
  - yellow → `rgba(255, 255, 0, 0.4)`
  - blue → `rgba(0, 0, 255, 0.4)`

When `showAnnotations` is false or `currentAnnotation` is null, both are empty — existing board behavior unchanged.

---

## 6. Settings storage

`showAnnotations: boolean` is added to the existing chunk settings object in `useProgress` (same localStorage key). Default: `true`.

Updated shape:
```json
{ "startDepth": 3, "unlockN": 3, "showAnnotations": true }
```

`App.jsx` passes `showAnnotations` and its setter to both `Sidebar` (toggle) and `PracticeBoard` (conditional arrows/squares rendering).

---

## Affected files

| File | Change |
|------|--------|
| `scripts/build-studies.js` | Add `extractMoveAnnotations`; update `extractMainLine` to call it |
| `scripts/build-studies.test.js` | Tests for annotation parsing |
| `public/studies.json` | Rebuilt with `annotation` field per position |
| `public/studies-with-eval.json` | Rebuilt (eval script passes `annotation` through unchanged) |
| `src/useDrill.js` | Expose `currentAnnotation` |
| `src/useDrill.test.js` | Tests for `currentAnnotation` |
| `src/useProgress.js` | Add `showAnnotations` to chunk settings |
| `src/useProgress.test.js` | Tests for new setting |
| `src/App.jsx` | Hold `currentAnnotation` state; wire `onAnnotationChange` and `showAnnotations` |
| `src/PracticeBoard.jsx` | Accept `onAnnotationChange`, `showAnnotations`; pass arrows/squares to board |
| `src/Sidebar.jsx` | Accept `currentAnnotation`, `showAnnotations`/setter; render text + toggle |
| `src/index.css` | Styles for `.annotation-text` panel |
