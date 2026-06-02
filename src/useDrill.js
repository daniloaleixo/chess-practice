import { useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'

function pickWeightedRandom(lines, getScore) {
  const weights = lines.map(l => 1 / (getScore(l.id) + 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < lines.length; i++) {
    r -= weights[i]
    if (r <= 0) return i
  }
  return lines.length - 1
}

function initLine(chapter, getScore, lineIndex = null, effectiveDepth = Infinity, startFromChunk = false) {
  const idx = lineIndex ?? pickWeightedRandom(chapter.lines, getScore)
  const line = chapter.lines[idx]
  const allMoves = line.positions.map(p => p.move.replace('0-0-0', 'O-O-O').replace('0-0', 'O-O'))
  const allCps = line.positions.map(p => p.cp ?? 0)
  const allAnnotations = line.positions.map(p => p.annotation ?? null)
  const cap = Math.min(effectiveDepth, allMoves.length)
  const moves = allMoves.slice(0, cap)
  const cps = allCps.slice(0, cap)

  const chess = new Chess()
  let moveIndex = 0

  if (startFromChunk && cap > 0) {
    const lastWhiteIdx = [...Array(cap).keys()].filter(i => i % 2 === 0).at(-1) ?? 0
    for (let i = 0; i < lastWhiteIdx; i++) chess.move(moves[i])
    moveIndex = lastWhiteIdx
  }

  return { chess, moves, cps, allAnnotations, moveIndex, lineId: line.id, lineIndex: idx, lineLength: line.positions.length }
}

export function useDrill(chapter, getScore, setScore, { unlockedDepth = Infinity, startFromChunk = false, recordCorrectAtDepth = null } = {}) {
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = initLine(chapter, getScore, null, unlockedDepth, startFromChunk)
  }

  const [fen, setFen] = useState(() => stateRef.current.chess.fen())
  const [moveHistory, setMoveHistory] = useState(() => [...stateRef.current.chess.history()])
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [currentCp, setCurrentCp] = useState(0)
  const [lineIndex, setLineIndex] = useState(() => stateRef.current.lineIndex)
  const [newlyUnlockedDepth, setNewlyUnlockedDepth] = useState(null)

  const hintUsedRef = useRef(false)
  const startNewLineRef = useRef(null)
  const recordCorrectAtDepthRef = useRef(recordCorrectAtDepth)
  recordCorrectAtDepthRef.current = recordCorrectAtDepth
  const unlockedDepthRef = useRef(unlockedDepth)
  unlockedDepthRef.current = unlockedDepth
  const startFromChunkRef = useRef(startFromChunk)
  startFromChunkRef.current = startFromChunk

  const startNewLine = useCallback(() => {
    const next = initLine(chapter, getScore, null, unlockedDepthRef.current, startFromChunkRef.current)
    stateRef.current = next
    hintUsedRef.current = false
    setNewlyUnlockedDepth(null)
    setFen(next.chess.fen())
    setMoveHistory([...next.chess.history()])
    setCurrentCp(0)
    setLineIndex(next.lineIndex)
    setIsUserTurn(true)
  }, [chapter, getScore])
  startNewLineRef.current = startNewLine

  const restartCurrentLine = useCallback(() => {
    const { lineIndex: idx } = stateRef.current
    const next = initLine(chapter, getScore, idx, unlockedDepthRef.current, startFromChunkRef.current)
    stateRef.current = next
    hintUsedRef.current = false
    setNewlyUnlockedDepth(null)
    setFen(next.chess.fen())
    setMoveHistory([...next.chess.history()])
    setCurrentCp(0)
    setIsUserTurn(true)
  }, [chapter, getScore])

  const applyBlackMoves = useCallback((chess, moves, cps, startIdx) => {
    let idx = startIdx
    while (idx < moves.length && idx % 2 === 1) {
      chess.move(moves[idx])
      idx++
    }

    if (idx >= moves.length) {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      if (!hintUsedRef.current) {
        setScore(stateRef.current.lineId, s => s + 1)
        const didUnlock = recordCorrectAtDepthRef.current?.(chapter.id, stateRef.current.lineLength) ?? false
        if (didUnlock) {
          const oldDepth = unlockedDepthRef.current
          setNewlyUnlockedDepth({ from: oldDepth + 1, to: Math.min(oldDepth + 2, stateRef.current.lineLength) })
        }
      }
      setIsUserTurn(false)
      setTimeout(() => startNewLineRef.current(), 2000)
    } else {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      stateRef.current.moveIndex = idx
      setIsUserTurn(true)
    }
  }, [setScore, chapter.id])

  const handleUserMove = useCallback((from, to) => {
    const { chess, moves, cps, moveIndex } = stateRef.current
    if (moveIndex % 2 !== 0) return { correct: false, correctMove: null }

    const expectedSan = moves[moveIndex]
    const tempChess = new Chess(chess.fen())
    const attempted = tempChess.move({ from, to, promotion: 'q' })

    if (!attempted || attempted.san !== expectedSan) {
      setScore(stateRef.current.lineId, 0)
      return { correct: false, correctMove: expectedSan }
    }

    chess.move({ from, to, promotion: 'q' })
    stateRef.current.moveIndex = moveIndex + 1
    applyBlackMoves(chess, moves, cps, moveIndex + 1)
    return { correct: true, correctMove: null }
  }, [applyBlackMoves, setScore])

  const hint = useCallback(() => {
    hintUsedRef.current = true
    return stateRef.current.moves[stateRef.current.moveIndex] ?? null
  }, [])

  const { moves, moveIndex } = stateRef.current
  const expectedMove = moves[moveIndex] ?? ''
  const currentAnnotation = stateRef.current.allAnnotations[stateRef.current.moveIndex] ?? null

  return {
    fen,
    moveHistory,
    isUserTurn,
    expectedMove,
    currentCp,
    currentLineIndex: lineIndex,
    totalLines: chapter.lines.length,
    handleUserMove,
    hint,
    restartCurrentLine,
    newlyUnlockedDepth,
    currentAnnotation,
  }
}
