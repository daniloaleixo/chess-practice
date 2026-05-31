# Chunked Progressive Drilling — Design Spec

**Date:** 2026-05-31
**Scope:** Benko line (and any long line) in the chess practice app

---

## Problem

The Benko main line is 11 moves deep. Drilling all 11 moves at once from the start makes it hard to internalize — there's too much to hold at once. The goal is to unlock moves progressively, letting the user build the line chunk by chunk.

---

## Approach

Per-chapter chunk progress saved to localStorage, with global configurable settings. Each chapter independently tracks how many moves are currently unlocked. A move unlocks when the user correctly plays it N times (N is configurable). A toggle lets the user choose whether to drill from move 1 or fast-forward to the current chunk.

---

## State & Data Model

Two new localStorage entries, both owned by `useProgress`:

### Global chunk settings
```js
chunkSettings: {
  startDepth: 4,   // initial unlocked depth for a new chapter
  unlockN: 3       // correct answers required at current depth to unlock next move
}
```

### Per-chapter chunk progress
```js
chunkProgress: {
  "benko": {
    unlockedDepth: 6,       // how many moves are currently unlocked
    correctAtDepth: 2       // times correct at current depth (resets on unlock)
  }
}
```

- A new chapter initializes `unlockedDepth` to `chunkSettings.startDepth`.
- When `correctAtDepth` reaches `unlockN`, `unlockedDepth` increments by 1 and `correctAtDepth` resets to 0.
- When `unlockedDepth` equals the line's total move count, the chapter is fully unlocked and chunk tracking is retired.

---

## UI & UX

### Sidebar
- Each chapter shows a secondary indicator: **"move 6 / 11 unlocked"** below the mastery progress bar.
- Once fully unlocked, the indicator is hidden.
- A collapsible **"Chunk settings"** section at the bottom of the sidebar contains two number inputs:
  - **Start at move** (default: 4)
  - **Unlock after N correct** (default: 3)
- Changes apply immediately and persist to localStorage.

### PracticeBoard
- A toggle in the board header: **"Full line" / "From chunk"**.
  - **Full line:** drills from move 1 up to `unlockedDepth`.
  - **From chunk:** silently auto-plays all moves before `unlockedDepth`, then hands control to the user at the current unlock boundary.
- When a new move unlocks, a brief inline message appears before the next drill: **"Move 7 unlocked!"**

---

## Component & Logic Changes

### `useProgress.js`
- Add `chunkSettings` (global) and `chunkProgress` (per chapter) to localStorage.
- New functions:
  - `getUnlockedDepth(chapterId)` — returns current unlocked depth, initializing to `startDepth` if new.
  - `recordCorrectAtDepth(chapterId)` — increments `correctAtDepth`; when it reaches `unlockN`, increments `unlockedDepth` and resets counter.
  - `setChunkSettings({ startDepth, unlockN })` — updates global settings, persists to localStorage.

### `useDrill.js`
- Accepts new props: `unlockedDepth` and `startFromChunk` (boolean).
- When `startFromChunk` is false: drills the full line from move 1 up to `unlockedDepth`.
- When `startFromChunk` is true: replays moves silently up to `unlockedDepth - 1`, then waits for user input at the unlock boundary.
- Calls `recordCorrectAtDepth` when the user correctly plays the move at position `unlockedDepth`.

### `PracticeBoard.jsx`
- Renders the "Full line / From chunk" toggle.
- Renders the unlock toast ("Move N unlocked!") when `unlockedDepth` increments.
- Passes toggle state to `useDrill`.

### `Sidebar.jsx`
- Renders "move N / total unlocked" indicator per chapter.
- Renders the collapsible chunk settings inputs at the bottom.

### `App.jsx`
- Passes `chunkSettings`, `chunkProgress`, and new `useProgress` functions down as props (already owns `useProgress`).

No new files are needed.

---

## Out of Scope

- Annotations per move (separate feature, same session).
- Chunk boundaries defined in data file (deferred — +1 per unlock is sufficient).
- Per-chapter N override (global N is enough for now).
