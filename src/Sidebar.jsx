import { useState } from 'react'

export function Sidebar({ chapters, getMasteredCount, activeChapterId, onSelect, getUnlockedDepth, chunkSettings, setChunkSettings, currentAnnotation }) {
  const [settingsOpen, setSettingsOpen] = useState(false)

  return (
    <aside className="sidebar">
      <div className="sidebar-title">CHAPTERS</div>
      {chapters.map(chapter => {
        const mastered = getMasteredCount(chapter)
        const total = chapter.lines.length
        const pct = total > 0 ? (mastered / total) * 100 : 0
        const isActive = chapter.id === activeChapterId
        const maxLen = chapter.lines.reduce((max, l) => Math.max(max, l.positions.length), 0)
        const unlocked = getUnlockedDepth(chapter.id, maxLen)
        const isFullyUnlocked = unlocked >= maxLen

        return (
          <div
            key={chapter.id}
            className={`sidebar-chapter${isActive ? ' sidebar-chapter--active' : ''}`}
            onClick={() => onSelect(chapter.id)}
          >
            <div className="sidebar-chapter-name">{chapter.name}</div>
            <div className="sidebar-progress-bar">
              <div className="sidebar-progress-fill" style={{ width: `${pct}%` }} />
            </div>
            <div className="sidebar-chapter-count">{mastered}/{total} mastered</div>
            {!isFullyUnlocked && (
              <div className="sidebar-chunk-depth">move {unlocked} / {maxLen} unlocked</div>
            )}
          </div>
        )
      })}

      {chunkSettings.showAnnotations && currentAnnotation?.text && (
        <div className="annotation-text">
          <div className="annotation-text-label">Annotation</div>
          <p className="annotation-text-body">{currentAnnotation.text}</p>
        </div>
      )}

      <div className="chunk-settings">
        <button
          className="chunk-settings-toggle"
          onClick={() => setSettingsOpen(v => !v)}
        >
          {settingsOpen ? '▲' : '▼'} Chunk settings
        </button>
        {settingsOpen && (
          <div className="chunk-settings-panel">
            <label className="chunk-settings-label">
              Start at move
              <input
                type="number"
                min="1"
                className="chunk-settings-input"
                value={chunkSettings.startDepth}
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  if (!Number.isFinite(n) || n < 1) return
                  setChunkSettings({ ...chunkSettings, startDepth: n })
                }}
              />
            </label>
            <label className="chunk-settings-label">
              Unlock after N correct
              <input
                type="number"
                min="1"
                className="chunk-settings-input"
                value={chunkSettings.unlockN}
                onChange={e => {
                  const n = parseInt(e.target.value, 10)
                  if (!Number.isFinite(n) || n < 1) return
                  setChunkSettings({ ...chunkSettings, unlockN: n })
                }}
              />
            </label>
            <label className="chunk-settings-label chunk-settings-label--toggle">
              Show annotations
              <input
                type="checkbox"
                checked={chunkSettings.showAnnotations}
                onChange={e => setChunkSettings({ ...chunkSettings, showAnnotations: e.target.checked })}
              />
            </label>
          </div>
        )}
      </div>
    </aside>
  )
}
