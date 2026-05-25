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
