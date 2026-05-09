import { useState, useCallback } from 'react'
import { Chessboard } from 'react-chessboard'
import { useDrill } from './useDrill'

const FEEDBACK_DURATION_MS = 1500

export function PracticeBoard({ lines }) {
  const { fen, moveHistory, isUserTurn, expectedMove, handleUserMove, restart } = useDrill(lines)
  const [feedback, setFeedback] = useState(null) // null | { correct: boolean, message: string }

  const onPieceDrop = useCallback((sourceSquare, targetSquare) => {
    if (!isUserTurn) return false

    const result = handleUserMove(sourceSquare, targetSquare)

    if (result.correct) {
      setFeedback({ correct: true, message: 'Correct!' })
      setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS)
      return true
    } else {
      setFeedback({ correct: false, message: `Wrong! Correct move: ${result.correctMove}` })
      setTimeout(() => {
        setFeedback(null)
        restart()
      }, FEEDBACK_DURATION_MS)
      return false
    }
  }, [isUserTurn, handleUserMove, restart])

  const moveNotation = moveHistory
    .map((move, i) => {
      if (i % 2 === 0) return `${Math.floor(i / 2) + 1}. ${move}`
      return move
    })
    .join(' ')

  const nextMoveLabel = isUserTurn && expectedMove
    ? `${Math.floor(moveHistory.length / 2) + 1}. ?`
    : ''

  return (
    <div className="practice-board">
      <div className="move-notation">
        {moveNotation || 'Game start'}
        {nextMoveLabel && <span className="expected-move"> {nextMoveLabel}</span>}
      </div>

      <div className="board-wrapper">
        <Chessboard
          position={fen}
          onPieceDrop={onPieceDrop}
          boardWidth={480}
          arePiecesDraggable={isUserTurn}
        />
      </div>

      {feedback && (
        <div className={`feedback ${feedback.correct ? 'feedback--correct' : 'feedback--wrong'}`}>
          {feedback.message}
        </div>
      )}
    </div>
  )
}
