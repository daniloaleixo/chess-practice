# Unlock by Two — Design Spec

**Date:** 2026-06-02
**Scope:** Change chunk unlock increment from 1 ply to 2 plies (one full chess move)

---

## Problem

The current unlock system advances one ply at a time. A ply is a single half-move (white or black). Unlocking a black ply is meaningless from a learning perspective — black moves are auto-played by the app, not chosen by the user. Unlocking one ply at a time means every other unlock buys the user nothing new to learn.

---

## Solution

Advance `unlockedDepth` by 2 on each unlock (one white ply + one black ply = one full move). The user always unlocks a new decision point.

---

## Data Model

No new localStorage keys. No new state shape. `unlockedDepth` remains a ply count (integer).

Single change in `recordCorrectAtDepth` in `useProgress.js`:

```js
// Before
unlockedDepth: current.unlockedDepth + 1

// After
unlockedDepth: current.unlockedDepth + 2
```

The existing cap in `getUnlockedDepth` (`Math.min(depth, lineLength)`) handles odd-length lines. For the Benko (11 plies), the final unlock goes from depth 10 → stored 12 → served as 11.

---

## Toast

`newlyUnlockedDepth` in `useDrill` changes type from `number | null` to `{ from: number, to: number } | null`.

Set on unlock:
```js
const oldDepth = unlockedDepthRef.current
const newEffectiveDepth = Math.min(oldDepth + 2, stateRef.current.lineLength)
setNewlyUnlockedDepth({ from: oldDepth + 1, to: newEffectiveDepth })
```

Rendered in `PracticeBoard`:
```jsx
{newlyUnlockedDepth !== null && (
  <div className="feedback feedback--correct">
    {newlyUnlockedDepth.from === newlyUnlockedDepth.to
      ? `Move ${newlyUnlockedDepth.to} unlocked!`
      : `Moves ${newlyUnlockedDepth.from} & ${newlyUnlockedDepth.to} unlocked!`}
  </div>
)}
```

The `newlyUnlockedDepth === null` guard on "Line complete!" is unchanged.

---

## Files Changed

| File | Change |
|------|--------|
| `src/useProgress.js` | `+ 1` → `+ 2` in `recordCorrectAtDepth` |
| `src/useProgress.test.js` | Update tests expecting `unlockedDepth + 1` to expect `+ 2` |
| `src/useDrill.js` | `setNewlyUnlockedDepth(number)` → `setNewlyUnlockedDepth({ from, to })` |
| `src/useDrill.test.js` | Update tests for new `newlyUnlockedDepth` shape |
| `src/PracticeBoard.jsx` | Update toast render to use `{ from, to }` |

No new files needed.

---

## Out of Scope

- Making the unlock step configurable (hardcoded to 2 is sufficient)
- Enforcing even `startDepth` values in the UI (the cap handles odd values gracefully)
