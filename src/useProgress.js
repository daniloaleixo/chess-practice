import { useState, useCallback } from 'react'

const STORAGE_KEY = 'chess-practice:progress'

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress)

  const getScore = useCallback((lineId) => progress[lineId] ?? 0, [progress])

  const setScore = useCallback((lineId, scoreOrUpdater) => {
    setProgress(prev => {
      const current = prev[lineId] ?? 0
      const newScore = typeof scoreOrUpdater === 'function' ? scoreOrUpdater(current) : scoreOrUpdater
      const next = { ...prev, [lineId]: newScore }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  const getMasteredCount = useCallback(
    (chapter) => chapter.lines.filter(l => (progress[l.id] ?? 0) >= 3).length,
    [progress]
  )

  const resetChapter = useCallback((chapterId) => {
    setProgress(prev => {
      const next = { ...prev }
      for (const key of Object.keys(next)) {
        if (key.startsWith(chapterId + '-')) delete next[key]
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return { getScore, setScore, getMasteredCount, resetChapter }
}
