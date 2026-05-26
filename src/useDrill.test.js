import { renderHook, act } from '@testing-library/react'
import { vi } from 'vitest'
import { useDrill } from './useDrill'

// After 1. d4: FEN rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1
// After 1. d4 d5: FEN rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2
const line1 = {
  id: 'london-vs-dutch-0',
  pgn: '1. d4 d5',
  positions: [
    { fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', move: 'd4', cp: 15 },
    { fen: 'rnbqkbnr/ppp1pppp/8/3p4/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 0 2', move: 'd5', cp: 10 },
  ],
}

// After 1. d4 Nf6: FEN rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2
// After 1. d4 Nf6 2. c4: FEN rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2
const line2 = {
  id: 'london-vs-dutch-1',
  pgn: '1. d4 Nf6 2. c4',
  positions: [
    { fen: 'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1', move: 'd4', cp: 15 },
    { fen: 'rnbqkb1r/pppppppp/5n2/8/3P4/8/PPP1PPPP/RNBQKBNR w KQkq - 1 2', move: 'Nf6', cp: 10 },
    { fen: 'rnbqkb1r/pppppppp/5n2/8/2PP4/8/PP2PPPP/RNBQKBNR b KQkq - 0 2', move: 'c4', cp: 20 },
  ],
}

function makeChapter(lines) {
  return { id: 'london-vs-dutch', name: 'London vs Dutch', lines }
}

describe('useDrill', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('starts with isUserTurn true and empty moveHistory', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    expect(result.current.isUserTurn).toBe(true)
    expect(result.current.moveHistory).toHaveLength(0)
  })

  it('exposes totalLines and currentLineIndex', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1, line2]), getScore, setScore))
    expect(result.current.totalLines).toBe(2)
    expect(result.current.currentLineIndex).toBeGreaterThanOrEqual(0)
    expect(result.current.currentLineIndex).toBeLessThan(2)
  })

  it('returns correct: true when user plays the expected White move', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    let response
    act(() => { response = result.current.handleUserMove('d2', 'd4') })
    expect(response.correct).toBe(true)
  })

  it('returns correct: false and provides correctMove on wrong move', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    let response
    act(() => { response = result.current.handleUserMove('e2', 'e4') })
    expect(response.correct).toBe(false)
    expect(response.correctMove).toBe('d4')
  })

  it('calls setScore(lineId, 0) on wrong move', () => {
    const getScore = vi.fn(() => 2)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    act(() => { result.current.handleUserMove('e2', 'e4') })
    expect(setScore).toHaveBeenCalledWith(line1.id, 0)
  })

  it('calls setScore(lineId, score+1) when full line is completed', () => {
    const getScore = vi.fn(() => 1)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(setScore).toHaveBeenCalledWith(line1.id, expect.any(Function))
    const [, updater] = setScore.mock.calls[0]
    expect(updater(1)).toBe(2)
  })

  it('advances moveHistory to include White and Black moves after correct White move', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line2]), getScore, setScore))
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(result.current.moveHistory).toContain('d4')
    expect(result.current.moveHistory).toContain('Nf6')
  })

  it('updates currentCp to the last played position cp value', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    expect(result.current.currentCp).toBe(0)
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(result.current.currentCp).toBe(10)
  })

  it('hint() returns the expected SAN without triggering setScore on completion', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    let hintMove
    act(() => { hintMove = result.current.hint() })
    expect(hintMove).toBe('d4')
    act(() => { result.current.handleUserMove('d2', 'd4') })
    expect(setScore).not.toHaveBeenCalled()
  })

  it('restartCurrentLine resets board to start without picking a new line', () => {
    const getScore = vi.fn(() => 0)
    const setScore = vi.fn()
    const { result } = renderHook(() => useDrill(makeChapter([line1]), getScore, setScore))
    const indexBefore = result.current.currentLineIndex
    act(() => { result.current.handleUserMove('d2', 'd4') })
    act(() => { result.current.restartCurrentLine() })
    expect(result.current.moveHistory).toHaveLength(0)
    expect(result.current.currentLineIndex).toBe(indexBefore)
    expect(result.current.isUserTurn).toBe(true)
  })
})
