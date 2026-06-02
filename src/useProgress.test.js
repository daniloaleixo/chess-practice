import { renderHook, act } from '@testing-library/react'
import { useProgress } from './useProgress'

const mockChapter = {
  id: 'london-vs-dutch',
  name: 'London vs Dutch',
  lines: [
    { id: 'london-vs-dutch-0', pgn: '', positions: [] },
    { id: 'london-vs-dutch-1', pgn: '', positions: [] },
    { id: 'london-vs-dutch-2', pgn: '', positions: [] },
  ],
}

beforeEach(() => localStorage.clear())

describe('useProgress', () => {
  it('getScore returns 0 for unseen lines', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getScore('london-vs-dutch-0')).toBe(0)
  })

  it('setScore persists score and getScore returns it', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setScore('london-vs-dutch-0', 2))
    expect(result.current.getScore('london-vs-dutch-0')).toBe(2)
  })

  it('setScore writes to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setScore('london-vs-dutch-0', 1))
    const stored = JSON.parse(localStorage.getItem('chess-practice:progress'))
    expect(stored['london-vs-dutch-0']).toBe(1)
  })

  it('getMasteredCount returns 0 when no lines mastered', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getMasteredCount(mockChapter)).toBe(0)
  })

  it('getMasteredCount counts lines with score >= 3', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setScore('london-vs-dutch-0', 3)
      result.current.setScore('london-vs-dutch-1', 5)
      result.current.setScore('london-vs-dutch-2', 2)
    })
    expect(result.current.getMasteredCount(mockChapter)).toBe(2)
  })

  it('resetChapter clears scores for that chapter', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setScore('london-vs-dutch-0', 3)
      result.current.setScore('london-vs-dutch-1', 1)
    })
    act(() => result.current.resetChapter('london-vs-dutch'))
    expect(result.current.getScore('london-vs-dutch-0')).toBe(0)
    expect(result.current.getScore('london-vs-dutch-1')).toBe(0)
  })

  it('resetChapter does not touch scores from other chapters', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setScore('london-vs-dutch-0', 3)
      result.current.setScore('london-vs-kid-0', 2)
    })
    act(() => result.current.resetChapter('london-vs-dutch'))
    expect(result.current.getScore('london-vs-kid-0')).toBe(2)
  })
})

describe('chunk state', () => {
  it('chunkSettings defaults to startDepth 4 and unlockN 3', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.chunkSettings).toEqual({ startDepth: 4, unlockN: 3, showAnnotations: true })
  })

  it('setChunkSettings updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.setChunkSettings({ startDepth: 6, unlockN: 5 }))
    expect(result.current.chunkSettings).toEqual({ startDepth: 6, unlockN: 5 })
    expect(JSON.parse(localStorage.getItem('chess-practice:chunk-settings'))).toEqual({ startDepth: 6, unlockN: 5 })
  })

  it('getUnlockedDepth returns startDepth for a new chapter', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getUnlockedDepth('benko', 11)).toBe(4)
  })

  it('getUnlockedDepth caps at lineLength', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.getUnlockedDepth('benko', 3)).toBe(3)
  })

  it('recordCorrectAtDepth increments correctAtDepth without unlocking before N', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    expect(result.current.getUnlockedDepth('benko', 11)).toBe(4)
  })

  it('recordCorrectAtDepth unlocks next depth after unlockN correct answers', () => {
    const { result } = renderHook(() => useProgress())
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    act(() => result.current.recordCorrectAtDepth('benko', 11))
    expect(result.current.getUnlockedDepth('benko', 11)).toBe(6)
  })

  it('recordCorrectAtDepth returns true when an unlock happens', () => {
    const { result } = renderHook(() => useProgress())
    let unlocked
    act(() => { result.current.recordCorrectAtDepth('benko', 11) })
    act(() => { result.current.recordCorrectAtDepth('benko', 11) })
    act(() => { unlocked = result.current.recordCorrectAtDepth('benko', 11) })
    expect(unlocked).toBe(true)
  })

  it('recordCorrectAtDepth returns false when not yet unlocking', () => {
    const { result } = renderHook(() => useProgress())
    let unlocked
    act(() => { unlocked = result.current.recordCorrectAtDepth('benko', 11) })
    expect(unlocked).toBe(false)
  })

  it('recordCorrectAtDepth does not unlock past lineLength', () => {
    const { result } = renderHook(() => useProgress())
    // lineLength=4 equals startDepth=4 — already at cap, should never unlock
    act(() => { result.current.recordCorrectAtDepth('benko', 4) })
    act(() => { result.current.recordCorrectAtDepth('benko', 4) })
    act(() => { result.current.recordCorrectAtDepth('benko', 4) })
    expect(result.current.getUnlockedDepth('benko', 4)).toBe(4)
  })

  it('recordCorrectAtDepth does not cause spurious unlock if lineLength later increases', () => {
    const { result } = renderHook(() => useProgress())
    // Unlock to depth 6 (unlockN=3 calls with lineLength=5)
    act(() => { result.current.recordCorrectAtDepth('benko', 5) })
    act(() => { result.current.recordCorrectAtDepth('benko', 5) })
    act(() => { result.current.recordCorrectAtDepth('benko', 5) }) // unlocks stored depth to 6 (effective=5 while lineLength=5)
    // Two more post-cap calls — without the fix, correctAtDepth accumulates to 2
    act(() => { result.current.recordCorrectAtDepth('benko', 5) })
    act(() => { result.current.recordCorrectAtDepth('benko', 5) })
    // Now call with lineLength=6 — must NOT immediately unlock (needs 3 fresh correct answers)
    let didUnlock
    act(() => { didUnlock = result.current.recordCorrectAtDepth('benko', 6) })
    expect(didUnlock).toBe(false)
    expect(result.current.getUnlockedDepth('benko', 6)).toBe(6)
  })
})

describe('showAnnotations setting', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults showAnnotations to true', () => {
    const { result } = renderHook(() => useProgress())
    expect(result.current.chunkSettings.showAnnotations).toBe(true)
  })

  it('persists showAnnotations to localStorage via setChunkSettings', () => {
    const { result } = renderHook(() => useProgress())
    act(() => {
      result.current.setChunkSettings({ ...result.current.chunkSettings, showAnnotations: false })
    })
    expect(result.current.chunkSettings.showAnnotations).toBe(false)
    const stored = JSON.parse(localStorage.getItem('chess-practice:chunk-settings'))
    expect(stored.showAnnotations).toBe(false)
  })

  it('loads showAnnotations from localStorage', () => {
    localStorage.setItem('chess-practice:chunk-settings', JSON.stringify({ startDepth: 4, unlockN: 3, showAnnotations: false }))
    const { result } = renderHook(() => useProgress())
    expect(result.current.chunkSettings.showAnnotations).toBe(false)
  })
})
