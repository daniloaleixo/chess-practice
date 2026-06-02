# Unlock by Two Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Change the chunk unlock increment from 1 ply to 2 plies so each unlock always covers a full chess move (white + black).

**Architecture:** Three files change: `useProgress.js` gets the `+1→+2` increment fix, `useDrill.js` changes `newlyUnlockedDepth` from a plain number to `{ from, to }` to accurately describe the unlock range, and `PracticeBoard.jsx` renders the new toast. Tests in `useProgress.test.js` and `useDrill.test.js` are updated to match.

**Tech Stack:** React 18, Vitest, @testing-library/react

---

## File Map

| File | Change |
|------|--------|
| `src/useProgress.js` | `unlockedDepth + 1` → `+ 2` on line ~75 |
| `src/useProgress.test.js` | Two assertions updated for +2 unlock |
| `src/useDrill.js` | `setNewlyUnlockedDepth(number)` → `setNewlyUnlockedDepth({ from, to })` on line ~97 |
| `src/useDrill.test.js` | Two assertions updated for `{ from, to }` shape |
| `src/PracticeBoard.jsx` | Toast render updated to use `{ from, to }` |

---

### Task 1: Update useProgress — increment to +2

**Files:**
- Modify: `src/useProgress.js` (line ~75)
- Test: `src/useProgress.test.js` (lines 107 and ~148)

**Background:** `recordCorrectAtDepth` in `useProgress.js` increments `unlockedDepth` by 1 when `correctAtDepth` reaches `unlockN`. The fix is `+2`. Two tests expect the old `+1` behavior and must be updated first (TDD).

- [ ] **Step 1: Update the two failing tests**

In `src/useProgress.test.js`, change line ~107:
```js
// Before:
expect(result.current.getUnlockedDepth('benko', 11)).toBe(5)

// After:
expect(result.current.getUnlockedDepth('benko', 11)).toBe(6)
```

In the same file, change the final assertion in `'recordCorrectAtDepth does not cause spurious unlock if lineLength later increases'` (line ~148):
```js
// Before:
expect(result.current.getUnlockedDepth('benko', 6)).toBe(5)

// After (with +2, stored depth after unlock is 6, and min(6,6)=6):
expect(result.current.getUnlockedDepth('benko', 6)).toBe(6)
```

Also update the comment on line ~140 from `// unlocks to 5` to `// unlocks stored depth to 6 (effective=5 while lineLength=5)`.

- [ ] **Step 2: Verify tests fail**

```bash
npm test -- --run src/useProgress.test.js
```

Expected: 2 failures — the two assertions you just changed now expect the new values but implementation still says `+1`.

- [ ] **Step 3: Change the increment in useProgress.js**

In `src/useProgress.js` at the `recordCorrectAtDepth` function, find:
```js
next = { ...prev, [chapterId]: { unlockedDepth: current.unlockedDepth + 1, correctAtDepth: 0 } }
```

Change to:
```js
next = { ...prev, [chapterId]: { unlockedDepth: current.unlockedDepth + 2, correctAtDepth: 0 } }
```

- [ ] **Step 4: Verify all useProgress tests pass**

```bash
npm test -- --run src/useProgress.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/useProgress.js src/useProgress.test.js
git commit -m "fix: unlock by 2 plies instead of 1 in recordCorrectAtDepth"
```

---

### Task 2: Update useDrill — newlyUnlockedDepth becomes { from, to }

**Files:**
- Modify: `src/useDrill.js` (line ~97)
- Test: `src/useDrill.test.js` (lines ~195 and ~205)

**Background:** `useDrill.js` currently does `setNewlyUnlockedDepth(unlockedDepthRef.current + 1)`. After the `+2` change in Task 1, this should become `{ from: oldDepth + 1, to: min(oldDepth + 2, lineLength) }` so PracticeBoard can render the correct range. Two tests check `newlyUnlockedDepth` and expect the old plain-number shape.

The mock chapter in the tests has 6 positions. `unlockedDepth` passed to the hook is 4. After unlock: `from = 5`, `to = min(6, 6) = 6`.

- [ ] **Step 1: Update the two failing tests**

In `src/useDrill.test.js`, test `'newlyUnlockedDepth is set to new depth when recordCorrectAtDepth returns true'`, change line ~195:
```js
// Before:
expect(result.current.newlyUnlockedDepth).toBe(5)

// After:
expect(result.current.newlyUnlockedDepth).toEqual({ from: 5, to: 6 })
```

In the same file, test `'newlyUnlockedDepth is cleared on restartCurrentLine'`, change line ~205:
```js
// Before:
expect(result.current.newlyUnlockedDepth).toBe(5)

// After:
expect(result.current.newlyUnlockedDepth).toEqual({ from: 5, to: 6 })
```

(The `toBeNull()` assertion that follows in both tests is unchanged.)

- [ ] **Step 2: Verify tests fail**

```bash
npm test -- --run src/useDrill.test.js
```

Expected: 2 failures for the `newlyUnlockedDepth` shape assertions.

- [ ] **Step 3: Update setNewlyUnlockedDepth in useDrill.js**

In `src/useDrill.js`, find (line ~96–97):
```js
const didUnlock = recordCorrectAtDepthRef.current?.(chapter.id, stateRef.current.lineLength) ?? false
if (didUnlock) setNewlyUnlockedDepth(unlockedDepthRef.current + 1)
```

Replace with:
```js
const didUnlock = recordCorrectAtDepthRef.current?.(chapter.id, stateRef.current.lineLength) ?? false
if (didUnlock) {
  const oldDepth = unlockedDepthRef.current
  setNewlyUnlockedDepth({ from: oldDepth + 1, to: Math.min(oldDepth + 2, stateRef.current.lineLength) })
}
```

- [ ] **Step 4: Verify all useDrill tests pass**

```bash
npm test -- --run src/useDrill.test.js
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/useDrill.js src/useDrill.test.js
git commit -m "fix: newlyUnlockedDepth now carries { from, to } range for 2-ply unlock"
```

---

### Task 3: Update PracticeBoard toast

**Files:**
- Modify: `src/PracticeBoard.jsx`

**Background:** The toast in `PracticeBoard.jsx` currently renders `Move {newlyUnlockedDepth} unlocked!`. After Task 2, `newlyUnlockedDepth` is `{ from, to } | null`. The toast must render:
- "Moves 5 & 6 unlocked!" when `from !== to`
- "Move 11 unlocked!" when `from === to` (odd-length line edge case)

The `newlyUnlockedDepth === null` guard on "Line complete!" is unchanged — `null` check still works.

There is no test file for PracticeBoard. Verify manually by running the app after committing.

- [ ] **Step 1: Update the toast JSX in PracticeBoard.jsx**

Find (at the bottom of the JSX return):
```jsx
{newlyUnlockedDepth !== null && (
  <div className="feedback feedback--correct">Move {newlyUnlockedDepth} unlocked!</div>
)}
```

Replace with:
```jsx
{newlyUnlockedDepth !== null && (
  <div className="feedback feedback--correct">
    {newlyUnlockedDepth.from === newlyUnlockedDepth.to
      ? `Move ${newlyUnlockedDepth.to} unlocked!`
      : `Moves ${newlyUnlockedDepth.from} & ${newlyUnlockedDepth.to} unlocked!`}
  </div>
)}
```

- [ ] **Step 2: Run the full test suite**

```bash
npm test -- --run
```

Expected: all 50 tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/PracticeBoard.jsx
git commit -m "feat: toast shows 'Moves N & M unlocked!' for 2-ply unlock"
```
