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

function initLine(chapter, getScore, lineIndex = null) {
  const idx = lineIndex ?? pickWeightedRandom(chapter.lines, getScore)
  const line = chapter.lines[idx]
  const moves = line.positions.map(p => p.move.replace('0-0-0', 'O-O-O').replace('0-0', 'O-O'))
  const cps = line.positions.map(p => p.cp ?? 0)
  const chess = new Chess()
  return { chess, moves, cps, moveIndex: 0, lineId: line.id, lineIndex: idx }
}

export function useDrill(chapter, getScore, setScore) {
  const stateRef = useRef(null)
  if (stateRef.current === null) {
    stateRef.current = initLine(chapter, getScore)
  }

  const [fen, setFen] = useState(() => stateRef.current.chess.fen())
  const [moveHistory, setMoveHistory] = useState([])
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [currentCp, setCurrentCp] = useState(0)
  const [lineIndex, setLineIndex] = useState(() => stateRef.current.lineIndex)
  const hintUsedRef = useRef(false)

  const startNewLine = useCallback(() => {
    const next = initLine(chapter, getScore)
    stateRef.current = next
    hintUsedRef.current = false
    setFen(next.chess.fen())
    setMoveHistory([])
    setCurrentCp(0)
    setLineIndex(next.lineIndex)
    setIsUserTurn(true)
  }, [chapter, getScore])

  const restartCurrentLine = useCallback(() => {
    const { lineIndex: idx } = stateRef.current
    const next = initLine(chapter, getScore, idx)
    stateRef.current = next
    hintUsedRef.current = false
    setFen(next.chess.fen())
    setMoveHistory([])
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
        setScore(stateRef.current.lineId, getScore(stateRef.current.lineId) + 1)
      }
      setIsUserTurn(false)
      setTimeout(() => startNewLine(), 2000)
    } else {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      stateRef.current.moveIndex = idx
      setIsUserTurn(true)
    }
  }, [getScore, setScore, startNewLine])

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
  }
}
