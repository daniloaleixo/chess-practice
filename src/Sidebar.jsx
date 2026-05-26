export function Sidebar({ chapters, getMasteredCount, activeChapterId, onSelect }) {
  return (
    <aside className="sidebar">
      <div className="sidebar-title">CHAPTERS</div>
      {chapters.map(chapter => {
        const mastered = getMasteredCount(chapter)
        const total = chapter.lines.length
        const pct = total > 0 ? (mastered / total) * 100 : 0
        const isActive = chapter.id === activeChapterId
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
          </div>
        )
      })}
    </aside>
  )
}
