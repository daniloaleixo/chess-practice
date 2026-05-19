import { useState, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { useDrill } from './useDrill'

const FEEDBACK_DURATION_MS = 1500

export function PracticeBoard({ lines }) {
  const { fen, moveHistory, isUserTurn, expectedMove, currentCp, handleUserMove, restart } = useDrill(lines)
  const [feedback, setFeedback] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const lockedRef = useRef(false)
  const feedbackTimerRef = useRef(null)

  const tryMove = useCallback((sourceSquare, targetSquare) => {
    if (!isUserTurn || lockedRef.current) return false

    const result = handleUserMove(sourceSquare, targetSquare)

    if (result.correct) {
      setFeedback({ correct: true, message: 'Correct!' })
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => setFeedback(null), FEEDBACK_DURATION_MS)
      return true
    } else {
      lockedRef.current = true
      setFeedback({ correct: false, message: `Wrong! Correct move: ${result.correctMove}` })
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = setTimeout(() => {
        lockedRef.current = false
        setFeedback(null)
        restart()
      }, FEEDBACK_DURATION_MS)
      return false
    }
  }, [isUserTurn, handleUserMove, restart])

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    setSelectedSquare(null)
    return tryMove(sourceSquare, targetSquare)
  }, [tryMove])

  const onSquareClick = useCallback(({ piece, square }) => {
    if (!isUserTurn || lockedRef.current) return

    if (piece) {
      // Click on a piece: select it or deselect if same square
      setSelectedSquare(prev => prev === square ? null : square)
      return
    }

    // Click on empty square: attempt move if a piece is selected
    if (selectedSquare) {
      tryMove(selectedSquare, square)
      setSelectedSquare(null)
    }
  }, [selectedSquare, isUserTurn, tryMove])

  const squareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(255, 255, 0, 0.4)' } }
    : {}

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

      <div className="eval-bar">
        <span className={`eval-score ${currentCp >= 0 ? 'eval-white' : 'eval-black'}`}>
          {currentCp >= 0 ? '+' : ''}{(currentCp / 100).toFixed(2)}
        </span>
      </div>

      <div className="board-wrapper">
        <Chessboard
          options={{
            position: fen,
            allowDragging: isUserTurn && !lockedRef.current,
            onPieceDrop,
            onSquareClick,
            squareStyles,
            boardStyle: { width: '480px', height: '480px' },
          }}
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
