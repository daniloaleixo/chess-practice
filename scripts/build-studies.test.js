import { parsePgnGames, extractChapterName, extractMainLine } from './build-studies.js'

describe('parsePgnGames', () => {
  it('splits a PGN file with two games', () => {
    const content = '[Event "Game 1"]\n\n1. d4 d5 *\n\n[Event "Game 2"]\n\n1. e4 e5 *'
    const games = parsePgnGames(content)
    expect(games).toHaveLength(2)
    expect(games[0]).toContain('[Event "Game 1"]')
    expect(games[1]).toContain('[Event "Game 2"]')
  })

  it('returns a single-element array when file has one game', () => {
    const content = '[Event "Game 1"]\n\n1. d4 d5 *'
    expect(parsePgnGames(content)).toHaveLength(1)
  })
})

describe('extractChapterName', () => {
  it('extracts name from [Event] tag', () => {
    const pgn = '[Event "London vs Dutch"]\n\n1. d4 f5 *'
    expect(extractChapterName(pgn, 'irrelevant')).toBe('London vs Dutch')
  })

  it('falls back to filename when Event tag is absent', () => {
    const pgn = '[Site "?"]\n\n1. d4 f5 *'
    expect(extractChapterName(pgn, 'london-vs-dutch')).toBe('London Vs Dutch')
  })

  it('falls back to filename when Event tag is "?"', () => {
    const pgn = '[Event "?"]\n\n1. d4 f5 *'
    expect(extractChapterName(pgn, 'london-vs-kid')).toBe('London Vs Kid')
  })
})

describe('extractMainLine', () => {
  it('extracts positions for a simple line', () => {
    const pgn = '[Event "Test"]\n\n1. d4 d5 *'
    const positions = extractMainLine(pgn)
    expect(positions).toHaveLength(2)
    expect(positions[0].move).toBe('d4')
    expect(positions[1].move).toBe('d5')
    expect(positions[0].fen).toMatch(/^[rnbqkbnrpRNBQKBNRP1-8\/]+ [wb]/)
  })

  it('ignores variations in parentheses', () => {
    const pgn = '[Event "Test"]\n\n1. d4 (1. e4 e5) 1... d5 *'
    const positions = extractMainLine(pgn)
    expect(positions.map(p => p.move)).toEqual(['d4', 'd5'])
  })

  it('returns all positions up to the last move', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 2. Bf4 e6 3. Nf3 *'
    const positions = extractMainLine(pgn)
    expect(positions).toHaveLength(5)
    expect(positions[4].move).toBe('Nf3')
  })
})
