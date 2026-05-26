import { useState, useEffect } from 'react'
import { PracticeBoard } from './PracticeBoard'
import { Sidebar } from './Sidebar'
import { useProgress } from './useProgress'

export default function App() {
  const [chapters, setChapters] = useState(null)
  const [activeChapterId, setActiveChapterId] = useState(null)
  const [error, setError] = useState(null)
  const { getMasteredCount, getScore, setScore } = useProgress()

  useEffect(() => {
    fetch('/studies-with-eval.json')
      .then(r => r.json())
      .then(data => {
        setChapters(data.chapters)
        if (data.chapters.length > 0) setActiveChapterId(data.chapters[0].id)
      })
      .catch(() => setError('Failed to load studies-with-eval.json. Run build-studies.js and fetch-evals.js first.'))
  }, [])

  if (error) return <div className="status-message">{error}</div>
  if (!chapters) return <div className="status-message">Loading…</div>
  if (chapters.length === 0) return <div className="status-message">No chapters found. Add .pgn files to studies/ and run node scripts/build-studies.js.</div>

  const activeChapter = chapters.find(c => c.id === activeChapterId) ?? chapters[0]

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-title">♟ Chess Practice</span>
      </header>
      <div className="app-body">
        <Sidebar
          chapters={chapters}
          getMasteredCount={getMasteredCount}
          activeChapterId={activeChapterId}
          onSelect={setActiveChapterId}
        />
        <main className="app-main">
          <PracticeBoard key={activeChapterId} chapter={activeChapter} getScore={getScore} setScore={setScore} />
        </main>
      </div>
    </div>
  )
}
