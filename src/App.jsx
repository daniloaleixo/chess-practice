import { useState, useEffect } from 'react'
import { PracticeBoard } from './PracticeBoard'

export default function App() {
  const [lines, setLines] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    fetch('/repertoire.json')
      .then((r) => r.json())
      .then((data) => setLines(data.lines))
      .catch(() => setError('Failed to load repertoire.json'))
  }, [])

  if (error) return <div className="status-message">{error}</div>
  if (!lines) return <div className="status-message">Loading repertoire…</div>
  if (lines.length === 0) return <div className="status-message">No lines in repertoire.json yet.</div>

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">♟ Chess Practice</span>
      </header>
      <main className="app-main">
        <PracticeBoard lines={lines} />
      </main>
    </div>
  )
}
