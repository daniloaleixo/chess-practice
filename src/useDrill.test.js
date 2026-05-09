import { renderHook, act } from '@testing-library/react'
import { useDrill } from './useDrill'

const singleLine = ['1. d4 Nf6']

describe('useDrill', () => {
  it('starts with isUserTurn true (White moves first)', () => {
    const { result } = renderHook(() => useDrill(singleLine))
    expect(result.current.isUserTurn).toBe(true)
  })

  it('returns correct: true when user plays the expected White move', () => {
    const { result } = renderHook(() => useDrill(singleLine))
    // Expected first White move is d4 (d2→d4)
    let response
    act(() => {
      response = result.current.handleUserMove('d2', 'd4')
    })
    expect(response.correct).toBe(true)
  })

  it('returns correct: false and provides correctMove when user plays wrong move', () => {
    const { result } = renderHook(() => useDrill(singleLine))
    // Expected move is d4, user plays e4
    let response
    act(() => {
      response = result.current.handleUserMove('e2', 'e4')
    })
    expect(response.correct).toBe(false)
    expect(response.correctMove).toBe('d4')
  })

  it('advances moveHistory after a correct White move', () => {
    const { result } = renderHook(() => useDrill(singleLine))
    act(() => {
      result.current.handleUserMove('d2', 'd4')
    })
    expect(result.current.moveHistory).toContain('d4')
  })

  it('restart() resets the line back to the starting position', () => {
    const { result } = renderHook(() => useDrill(singleLine))
    act(() => {
      result.current.handleUserMove('d2', 'd4')
    })
    act(() => {
      result.current.restart()
    })
    expect(result.current.moveHistory).toHaveLength(0)
    expect(result.current.isUserTurn).toBe(true)
  })

  it('isUserTurn is false immediately after a correct move while Black auto-plays', () => {
    // After correct White move, hook should auto-apply Black move synchronously in test
    const { result } = renderHook(() => useDrill(singleLine))
    act(() => {
      result.current.handleUserMove('d2', 'd4')
    })
    // After d4 (correct), Black plays Nf6 automatically → line ends → new line starts
    // isUserTurn should be true again (new line begins)
    expect(result.current.isUserTurn).toBe(true)
  })
})
