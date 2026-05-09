# Chess Opening Practice App — Design Spec

**Date:** 2026-05-09
**Scope:** White repertoire practice tool (single color, drill mode only)

## Overview

A static React app that loads a repertoire of opening lines from a local JSON file and drills the user on White's moves through random repetition. There is no builder UI — lines are managed by directly editing the JSON file.

## Data Model

Repertoire is stored in `repertoire.json` at the project root as a flat array of PGN strings:

```json
{
  "lines": [
    "1. d4 Nf6 2. c4 e6 3. Nc3 Bb4",
    "1. d4 d5 2. c4 dxc4 3. Nf3",
    "1. d4 Nf6 2. Nf3 g6 3. g3 Bg7"
  ]
}
```

To add or remove lines, edit this file directly. The app reads it on load (no server needed).

## Runtime Tree Construction

On startup the app parses every PGN line using `chess.js` and merges them into an in-memory move tree:

```
root
└── d4 (White)
    ├── Nf6 (Black)
    │   ├── c4 (White)
    │   │   └── e6 (Black)
    │   │       └── Nc3 (White) → leaf
    │   └── Nf3 (White)
    │       └── g6 (Black)
    │           └── g3 (White) → leaf
    └── d5 (Black)
        └── c4 (White)
            └── dxc4 (Black)
                └── Nf3 (White) → leaf
```

White nodes are moves the user must play. Black nodes are played automatically by the app (randomly when multiple options exist at a branch).

## Practice Mode Flow

1. App picks a random line from the repertoire array.
2. Starting from the initial position, the app plays Black's moves automatically (with a short delay for feel).
3. When it's White's turn, the user drags/clicks a piece on the board.
4. **Correct move:** position advances, app plays next Black move.
5. **Wrong move:** board flashes red, correct move is shown briefly, then the line restarts from move 1.
6. When the final move of a line is reached (White's last move played correctly), the app picks a new random line and starts over.

## Tech Stack

- **React** (Vite) — UI framework
- **chess.js** — move validation, PGN parsing, game state
- **react-chessboard** — interactive board with drag-and-drop piece movement
- No backend, no database — pure static app

## UI

Single screen: a chess board centered on the page. Above the board, the current move sequence is displayed in algebraic notation with the next expected move shown as `?`. Below the board, a status area shows feedback (correct / wrong + correct move).

No navigation, no settings, no mode switching — the app opens straight into practice.

## File Structure

```
chess-practice/
├── repertoire.json        # Edited by hand to add/remove lines
├── src/
│   ├── main.jsx
│   ├── App.jsx            # Root: loads JSON, builds tree, renders PracticeBoard
│   ├── buildTree.js       # Pure function: lines[] → move tree
│   └── PracticeBoard.jsx  # Board UI, drill logic, feedback
├── public/
└── package.json
```

## Out of Scope

- Black repertoire
- Move annotations or comments
- Statistics / score tracking
- Online play or engine integration
- Mobile layout (desktop-first for now)
