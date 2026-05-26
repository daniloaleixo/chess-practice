import { useState, useCallback, useRef } from 'react'
import { Chessboard } from 'react-chessboard'
import { useDrill } from './useDrill'

const FEEDBACK_DURATION_MS = 1500

export function PracticeBoard({ chapter, getScore, setScore }) {
  const {
    fen,
    moveHistory,
    isUserTurn,
    expectedMove,
    currentCp,
    currentLineIndex,
    totalLines,
    handleUserMove,
    hint,
    restartCurrentLine,
  } = useDrill(chapter, getScore, setScore)

  const [feedback, setFeedback] = useState(null)
  const [selectedSquare, setSelectedSquare] = useState(null)
  const [hintSan, setHintSan] = useState(null)
  const lockedRef = useRef(false)
  const feedbackTimerRef = useRef(null)

  const tryMove = useCallback((sourceSquare, targetSquare) => {
    if (!isUserTurn || lockedRef.current) return false
    setHintSan(null)

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
        restartCurrentLine()
      }, FEEDBACK_DURATION_MS)
      return false
    }
  }, [isUserTurn, handleUserMove, restartCurrentLine])

  const onPieceDrop = useCallback(({ sourceSquare, targetSquare }) => {
    setSelectedSquare(null)
    return tryMove(sourceSquare, targetSquare)
  }, [tryMove])

  const onSquareClick = useCallback(({ piece, square }) => {
    if (!isUserTurn || lockedRef.current) return
    if (piece) {
      setSelectedSquare(prev => prev === square ? null : square)
      return
    }
    if (selectedSquare) {
      tryMove(selectedSquare, square)
      setSelectedSquare(null)
    }
  }, [selectedSquare, isUserTurn, tryMove])

  const onHintClick = useCallback(() => {
    const san = hint()
    if (san) setHintSan(san)
  }, [hint])

  const squareStyles = selectedSquare
    ? { [selectedSquare]: { backgroundColor: 'rgba(255,255,0,0.4)' } }
    : {}

  const moveNotation = moveHistory
    .map((move, i) => i % 2 === 0 ? `${Math.floor(i / 2) + 1}. ${move}` : move)
    .join(' ')

  const nextMoveLabel = isUserTurn && expectedMove
    ? `${Math.floor(moveHistory.length / 2) + 1}. ?`
    : ''

  const evalPercent = Math.min(100, Math.max(0, 50 + currentCp / 100))

  return (
    <div className="practice-board">
      <div className="practice-header">
        <span className="practice-chapter-name">{chapter.name}</span>
        <span className="practice-line-counter">Line {currentLineIndex + 1} of {totalLines}</span>
      </div>

      <div className="move-notation">
        {moveNotation || 'Game start'}
        {nextMoveLabel && <span className="expected-move"> {nextMoveLabel}</span>}
      </div>

      <div className="board-area">
        <div className="eval-bar">
          <div className="eval-bar-white" style={{ height: `${evalPercent}%` }} />
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
      </div>

      <div className="below-board">
        <span className={`eval-score ${currentCp >= 0 ? 'eval-white' : 'eval-black'}`}>
          {currentCp >= 0 ? '+' : ''}{(currentCp / 100).toFixed(2)}
        </span>
        <button
          className="hint-button"
          onClick={onHintClick}
          disabled={!isUserTurn || lockedRef.current}
        >
          💡 Hint
        </button>
      </div>

      {hintSan && (
        <div className="hint-text">Hint: play <strong>{hintSan}</strong></div>
      )}

      {!isUserTurn && (
        <div className="feedback feedback--correct">Line complete! ✓</div>
      )}

      {isUserTurn && feedback && (
        <div className={`feedback ${feedback.correct ? 'feedback--correct' : 'feedback--wrong'}`}>
          {feedback.message}
        </div>
      )}
    </div>
  )
}
