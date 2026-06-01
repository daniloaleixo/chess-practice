import { useState, useCallback, useRef } from 'react'

const STORAGE_KEY = 'chess-practice:progress'
const CHUNK_SETTINGS_KEY = 'chess-practice:chunk-settings'
const CHUNK_PROGRESS_KEY = 'chess-practice:chunk-progress'

const DEFAULT_CHUNK_SETTINGS = { startDepth: 4, unlockN: 3 }

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') } catch { return {} }
}

function loadChunkSettings() {
  try { return JSON.parse(localStorage.getItem(CHUNK_SETTINGS_KEY)) ?? DEFAULT_CHUNK_SETTINGS } catch { return DEFAULT_CHUNK_SETTINGS }
}

function loadChunkProgress() {
  try { return JSON.parse(localStorage.getItem(CHUNK_PROGRESS_KEY) ?? '{}') } catch { return {} }
}

export function useProgress() {
  const [progress, setProgress] = useState(loadProgress)
  const [chunkSettings, setChunkSettingsState] = useState(loadChunkSettings)
  const [chunkProgress, setChunkProgressState] = useState(loadChunkProgress)

  const chunkSettingsRef = useRef(chunkSettings)
  chunkSettingsRef.current = chunkSettings
  const chunkProgressRef = useRef(chunkProgress)
  chunkProgressRef.current = chunkProgress

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

  const getUnlockedDepth = useCallback((chapterId, lineLength) => {
    const { startDepth } = chunkSettingsRef.current
    const p = chunkProgressRef.current[chapterId]
    const depth = p ? p.unlockedDepth : startDepth
    return Math.min(depth, lineLength)
  }, [])

  const recordCorrectAtDepth = useCallback((chapterId, lineLength) => {
    const { startDepth, unlockN } = chunkSettingsRef.current
    const prev = chunkProgressRef.current
    const current = prev[chapterId] ?? { unlockedDepth: startDepth, correctAtDepth: 0 }
    const newCorrect = current.correctAtDepth + 1

    let next, didUnlock
    if (newCorrect >= unlockN && current.unlockedDepth < lineLength) {
      didUnlock = true
      next = { ...prev, [chapterId]: { unlockedDepth: current.unlockedDepth + 1, correctAtDepth: 0 } }
    } else {
      didUnlock = false
      next = { ...prev, [chapterId]: { ...current, correctAtDepth: newCorrect } }
    }

    chunkProgressRef.current = next
    localStorage.setItem(CHUNK_PROGRESS_KEY, JSON.stringify(next))
    setChunkProgressState(next)
    return didUnlock
  }, [])

  const setChunkSettings = useCallback(({ startDepth, unlockN }) => {
    const next = { startDepth, unlockN }
    setChunkSettingsState(next)
    localStorage.setItem(CHUNK_SETTINGS_KEY, JSON.stringify(next))
  }, [])

  return { getScore, setScore, getMasteredCount, resetChapter, chunkSettings, getUnlockedDepth, recordCorrectAtDepth, setChunkSettings }
}
