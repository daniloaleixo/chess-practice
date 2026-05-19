import { useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function initLine(lines) {
  const line = pickRandom(lines)
  const moves = line.positions.map(p =>
    p.move.replace('0-0-0', 'O-O-O').replace('0-0', 'O-O')
  )
  const cps = line.positions.map(p => p.cp ?? 0)
  const chess = new Chess()
  return { chess, moves, cps, moveIndex: 0 }
}

export function useDrill(lines) {
  const stateRef = useRef(initLine(lines))
  const [fen, setFen] = useState(() => stateRef.current.chess.fen())
  const [moveHistory, setMoveHistory] = useState([])
  const [isUserTurn, setIsUserTurn] = useState(true)
  const [currentCp, setCurrentCp] = useState(0)

  const applyBlackMoves = useCallback((chess, moves, cps, startIndex) => {
    let idx = startIndex

    while (idx < moves.length && idx % 2 === 1) {
      chess.move(moves[idx])
      idx++
    }

    if (idx >= moves.length) {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      setIsUserTurn(false)
      setTimeout(() => {
        const next = initLine(lines)
        stateRef.current = next
        setFen(next.chess.fen())
        setMoveHistory([])
        setCurrentCp(0)
        setIsUserTurn(true)
      }, 2000)
    } else {
      setFen(chess.fen())
      setMoveHistory([...chess.history()])
      setCurrentCp(cps[idx - 1] ?? 0)
      stateRef.current.moveIndex = idx
      setIsUserTurn(true)
    }
  }, [lines])

  const handleUserMove = useCallback((from, to) => {
    const { chess, moves, cps, moveIndex } = stateRef.current

    if (moveIndex % 2 !== 0) return { correct: false, correctMove: null }

    const expectedSan = moves[moveIndex]

    const tempChess = new Chess(chess.fen())
    const attempted = tempChess.move({ from, to, promotion: 'q' })

    if (!attempted || attempted.san !== expectedSan) {
      return { correct: false, correctMove: expectedSan }
    }

    chess.move({ from, to, promotion: 'q' })
    stateRef.current.moveIndex = moveIndex + 1

    applyBlackMoves(chess, moves, cps, moveIndex + 1)

    return { correct: true, correctMove: null }
  }, [applyBlackMoves])

  const restart = useCallback(() => {
    const { moves, cps } = stateRef.current
    const chess = new Chess()
    stateRef.current = { chess, moves, cps, moveIndex: 0 }
    setFen(chess.fen())
    setMoveHistory([])
    setCurrentCp(0)
    setIsUserTurn(true)
  }, [])

  const { moves, moveIndex } = stateRef.current
  const expectedMove = moves[moveIndex] ?? ''

  return { fen, moveHistory, isUserTurn, expectedMove, currentCp, handleUserMove, restart }
}
