import { useState } from 'react'

export function Sidebar({ chapters, getMasteredCount, activeChapterId, onSelect, getUnlockedDepth, chunkSettings, setChunkSettings }) {
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

      <div className="chunk-settings">
        <button
          className="chunk-settings-toggle"
          onClick={e => { e.stopPropagation(); setSettingsOpen(v => !v) }}
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
                onChange={e => setChunkSettings({ ...chunkSettings, startDepth: Math.max(1, Number(e.target.value)) })}
              />
            </label>
            <label className="chunk-settings-label">
              Unlock after N correct
              <input
                type="number"
                min="1"
                className="chunk-settings-input"
                value={chunkSettings.unlockN}
                onChange={e => setChunkSettings({ ...chunkSettings, unlockN: Math.max(1, Number(e.target.value)) })}
              />
            </label>
          </div>
        )}
      </div>
    </aside>
  )
}
