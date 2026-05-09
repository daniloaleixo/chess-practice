import { useState, useCallback, useRef } from 'react'
import { Chess } from 'chess.js'
import { parseLine } from './parseLine'

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function initLine(lines) {
  const pgn = pickRandom(lines)
  const moves = parseLine(pgn)
  const chess = new Chess()
  return { chess, moves, moveIndex: 0 }
}

/**
 * Drill state machine hook.
 *
 * @param {string[]} lines - Array of PGN strings from repertoire.json
 * @returns {{
 *   fen: string,
 *   moveHistory: string[],
 *   isUserTurn: boolean,
 *   expectedMove: string,
 *   handleUserMove: (from: string, to: string) => { correct: boolean, correctMove: string | null },
 *   restart: () => void,
 * }}
 */
export function useDrill(lines) {
  const stateRef = useRef(initLine(lines))
  const [fen, setFen] = useState(() => stateRef.current.chess.fen())
  const [moveHistory, setMoveHistory] = useState([])
  const [isUserTurn, setIsUserTurn] = useState(true)

  // Apply all consecutive Black moves synchronously until it's White's turn or line ends
  const applyBlackMoves = useCallback((chess, moves, startIndex) => {
    let idx = startIndex

    while (idx < moves.length && idx % 2 === 1) {
      chess.move(moves[idx])
      idx++
    }

    setFen(chess.fen())

    if (idx >= moves.length) {
      // Line complete — start a new one
      const next = initLine(lines)
      stateRef.current = next
      setFen(next.chess.fen())
      setMoveHistory([...chess.history()])
      setIsUserTurn(true)
    } else {
      setMoveHistory([...chess.history()])
      stateRef.current.moveIndex = idx
      setIsUserTurn(true)
    }
  }, [lines])

  const handleUserMove = useCallback((from, to) => {
    const { chess, moves, moveIndex } = stateRef.current

    if (moveIndex % 2 !== 0) return { correct: false, correctMove: null } // not user's turn

    const expectedSan = moves[moveIndex]

    // Try to make the move on a temporary chess instance to get its SAN
    const tempChess = new Chess(chess.fen())
    const attempted = tempChess.move({ from, to, promotion: 'q' })

    if (!attempted || attempted.san !== expectedSan) {
      return { correct: false, correctMove: expectedSan }
    }

    // Correct — apply to real chess instance
    chess.move({ from, to, promotion: 'q' })
    stateRef.current.moveIndex = moveIndex + 1

    applyBlackMoves(chess, moves, moveIndex + 1)

    return { correct: true, correctMove: null }
  }, [applyBlackMoves])

  const restart = useCallback(() => {
    const { moves } = stateRef.current
    const chess = new Chess()
    stateRef.current = { chess, moves, moveIndex: 0 }
    setFen(chess.fen())
    setMoveHistory([])
    setIsUserTurn(true)
  }, [])

  const { moves, moveIndex } = stateRef.current
  const expectedMove = moves[moveIndex] ?? ''

  return { fen, moveHistory, isUserTurn, expectedMove, handleUserMove, restart }
}
