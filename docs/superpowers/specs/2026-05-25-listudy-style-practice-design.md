# Listudy-Style Chess Practice App — Design Spec

**Date:** 2026-05-25
**Scope:** Rebuild practice app with chapter-based organization, spaced repetition, eval, and hint — similar to listudy.org

## Overview

Extend the existing React/Vite chess practice app to support named chapters (study files), per-line spaced repetition, centipawn evaluation, and a hint button. The user drops PGN files into a `studies/` folder; a build script converts them into a single JSON file the app loads.

## Data Pipeline

```
studies/*.pgn
     ↓  scripts/build-studies.js
public/studies.json
     ↓  scripts/fetch-evals.js  (Lichess cloud eval, resume-aware)
public/studies-with-eval.json   ← app loads this
```

**`studies/*.pgn`**
One file per chapter. Chapter name is taken from the PGN `[Event "..."]` tag; if absent, the filename (without extension, kebab-cased) is used as the name. Each game in the file is one line. Only the main line is extracted — all variations in parentheses are discarded.

**`scripts/build-studies.js`**
Reads every `.pgn` file in `studies/`, parses each game with chess.js, strips variations, and outputs `public/studies.json`:

```json
{
  "chapters": [
    {
      "id": "london-vs-dutch",
      "name": "London vs Dutch",
      "lines": [
        {
          "id": "london-vs-dutch-0",
          "pgn": "1. d4 f5 2. Bf4 Nf6 3. e3 e6 4. Nf3 d5 5. Bd3",
          "positions": [
            { "fen": "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", "move": "d4" },
            { "fen": "...", "move": "f5" }
          ]
        }
      ]
    }
  ]
}
```

Line IDs are stable: `<chapter-id>-<index>` (e.g. `london-vs-dutch-0`). Chapter ID is the kebab-cased chapter name.

**`scripts/fetch-evals.js`**
Adapted from the existing script. Reads `public/studies.json`, fetches Lichess cloud eval for each unique FEN (1 req/s, 429 retry with backoff, resume/cache so failed fetches are retried). Writes `public/studies-with-eval.json` — same structure as `studies.json` but each position gains a `cp` field (centipawns, from White's perspective).

## Data Model

### studies-with-eval.json

```typescript
type Position = { fen: string; move: string; cp: number }
type Line = { id: string; pgn: string; positions: Position[] }
type Chapter = { id: string; name: string; lines: Line[] }
type StudiesFile = { chapters: Chapter[] }
```

### Progress (localStorage)

Key: `chess-practice:progress`
Value: `Record<lineId, score>` — e.g. `{ "london-vs-dutch-0": 2, "london-vs-dutch-1": 0 }`

Score semantics:
- `0` — unseen or last attempt was wrong
- `1` — correct once
- `2` — correct twice in a row
- `3+` — mastered (still drilled occasionally)

A line is **mastered** when `score >= 3`.

## Spaced Repetition

Within the active chapter, line selection is weighted:

```
weight(line) = 1 / (score + 1)
```

Lines with score 0 have weight 1 (highest). Lines with score 3 have weight 0.25. Selection is a weighted random draw across all lines in the chapter.

**Score updates:**
- Correct full line (all moves played correctly) → `score += 1`
- Wrong move → `score = 0`, restart line from move 1
- Hint used → no score change, line continues from current position

## UI

### Layout

Two-column layout:

```
┌─────────────────┬──────────────────────────────────┐
│  CHAPTERS       │  London vs Dutch       Line 3/7  │
│                 │                                   │
│ ● London vs     │  1. d4 f5 2. Bf4 Nf6 3. e3 4. ? │
│   Dutch  4/7 ▓▓▓│                                   │
│                 │  [eval bar] [board 480×480]       │
│   London vs KID │                                   │
│   0/5           │  +0.45              💡 Hint       │
│                 │                                   │
│   London vs d5  │  [feedback: Correct! / Wrong!]   │
│   2/8           │                                   │
└─────────────────┴──────────────────────────────────┘
```

**Sidebar:**
- Lists all chapters
- Active chapter highlighted
- Each entry shows: name, progress bar (mastered/total), X/N count
- Click a chapter to switch; switches pick up a new line immediately from that chapter's weighted pool

**Main area:**
- Chapter name + current line number (`Line N of Total`)
- Move notation bar: moves played so far + `N. ?` for the next expected White move
- Eval bar (vertical, left of board): white/black proportion based on `cp`
- Chess board (480×480, drag and click supported)
- Eval score below board (e.g. `+0.45`)
- Hint button: highlights the correct destination square(s) on the board; no score penalty; hint clears on next move

**Feedback:**
- Correct move: brief green flash (`Correct!`), board advances
- Wrong move: red flash (`Wrong! Correct move: Nf3`), line restarts after 1.5s, board locked during feedback
- Line complete: `Line complete! ✓` flash, next line starts after 2s

## Component Structure

```
src/
  App.jsx               # loads studies-with-eval.json, renders layout
  Sidebar.jsx           # chapter list with progress bars (new)
  PracticeBoard.jsx     # board + notation + eval + feedback (updated)
  useDrill.js           # chapter-aware drill logic (updated)
  useProgress.js        # localStorage read/write for scores (new)
  buildTree.js          # unchanged
  parseLine.js          # unchanged
```

**`useProgress.js`** — single hook, pure localStorage:
- `getScore(lineId) → number`
- `setScore(lineId, score) → void`
- `getMasteredCount(chapter) → number`
- `resetChapter(chapterId) → void`

**`useDrill.js`** — takes `(chapter, getScore, setScore)`:
- Picks next line using weighted random
- Exposes `{ fen, moveHistory, isUserTurn, currentCp, handleUserMove, hint, restart }`
- `hint()` returns the correct SAN move and sets an internal flag that suppresses score update

**`Sidebar.jsx`** — takes `(chapters, progress, activeChapterId, onSelect)`:
- Pure display component, no drill logic

**`PracticeBoard.jsx`** — takes `(chapter)`:
- Wires `useDrill` + `useProgress`
- Renders board, eval bar, notation, feedback, hint button

## File Changes Summary

| File | Action |
|------|--------|
| `studies/*.pgn` | New — user-managed |
| `scripts/build-studies.js` | New |
| `scripts/fetch-evals.js` | Updated — reads `studies.json` instead of `repertoire.json` |
| `public/studies-with-eval.json` | New — replaces `repertoire-with-eval.json` |
| `src/App.jsx` | Updated — load new JSON, render sidebar + practice area |
| `src/Sidebar.jsx` | New |
| `src/useProgress.js` | New |
| `src/useDrill.js` | Updated — chapter-aware, weighted selection, hint support |
| `src/PracticeBoard.jsx` | Updated — hint button, line counter |

## Out of Scope

- Black repertoire practice
- Day-based spaced repetition scheduling (SM-2 intervals)
- User accounts or cloud sync
- Mobile layout
- PGN editor UI (files are managed by hand)
