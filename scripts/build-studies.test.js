import { parsePgnGames, extractChapterName, extractMainLine, extractMoveAnnotations, folderNameToChapterName, buildStudies } from './build-studies.js'
import { mkdirSync, writeFileSync as fsWriteFileSync, mkdtempSync, rmSync, readFileSync as fsReadFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

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

describe('extractMoveAnnotations', () => {
  it('returns empty array for empty string', () => {
    expect(extractMoveAnnotations('')).toEqual([])
  })

  it('returns null annotation for moves with no comments', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 *'
    const result = extractMoveAnnotations(pgn)
    expect(result).toHaveLength(2)
    expect(result[0]).toBeNull()
    expect(result[1]).toBeNull()
  })

  it('attaches text comment to the correct move', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 { Good move } 2. Bf4 *'
    const result = extractMoveAnnotations(pgn)
    // move 0: d4, move 1: Nf6, move 2: Bf4
    expect(result[1]).toMatchObject({ text: 'Good move', arrows: [], squares: [] })
    expect(result[0]).toBeNull()
    expect(result[2]).toBeNull()
  })

  it('merges consecutive comment blocks for the same move', () => {
    const pgn = '[Event "Test"]\n\n1. d4 Nf6 { The text } { [%cal Rd4d5] } 2. Bf4 *'
    const result = extractMoveAnnotations(pgn)
    expect(result[1]).toMatchObject({
      text: 'The text',
      arrows: [{ from: 'd4', to: 'd5', color: 'red' }],
      squares: [],
    })
  })

  it('parses [%cal] arrows with color codes', () => {
    const pgn = '[Event "Test"]\n\n1. d4 { [%cal Ra1a8,Gb1b8,Yc1c8,Bd1d8] } *'
    const result = extractMoveAnnotations(pgn)
    expect(result[0]).toMatchObject({
      text: null,
      arrows: [
        { from: 'a1', to: 'a8', color: 'red' },
        { from: 'b1', to: 'b8', color: 'green' },
        { from: 'c1', to: 'c8', color: 'yellow' },
        { from: 'd1', to: 'd8', color: 'blue' },
      ],
      squares: [],
    })
  })

  it('parses [%csl] squares with color codes', () => {
    const pgn = '[Event "Test"]\n\n1. d4 { [%csl Gd4,Re4] } *'
    const result = extractMoveAnnotations(pgn)
    expect(result[0]).toMatchObject({
      text: null,
      arrows: [],
      squares: [
        { square: 'd4', color: 'green' },
        { square: 'e4', color: 'red' },
      ],
    })
  })

  it('strips variations before counting moves', () => {
    const pgn = '[Event "Test"]\n\n1. d4 d5 (1... Nf6 2. c4) { After d5 } 2. c4 *'
    const result = extractMoveAnnotations(pgn)
    // main line: d4 (0), d5 (1), c4 (2)
    expect(result[1]).toMatchObject({ text: 'After d5' })
    expect(result[2]).toBeNull()
  })

  it('returns null for a move with empty comment block', () => {
    const pgn = '[Event "Test"]\n\n1. d4 { } *'
    const result = extractMoveAnnotations(pgn)
    expect(result[0]).toBeNull()
  })

  it('preserves parenthetical text inside comment blocks', () => {
    const pgn = '[Event "T"]\n\n1. d4 { Two options: e3 (safe) or d5 (sharp) } Nf6 *'
    const result = extractMoveAnnotations(pgn)
    expect(result[0].text).toBe('Two options: e3 (safe) or d5 (sharp)')
  })
})

describe('extractMainLine with annotations', () => {
  it('includes annotation field on each position', () => {
    const pgn = '[Event "Test"]\n\n1. d4 { White starts } Nf6 *'
    const positions = extractMainLine(pgn)
    expect(positions[0]).toHaveProperty('annotation')
    expect(positions[0].annotation).toMatchObject({ text: 'White starts' })
    expect(positions[1].annotation).toBeNull()
  })
})

describe('folderNameToChapterName', () => {
  it('title-cases a single word', () => {
    expect(folderNameToChapterName('benoni')).toBe('Benoni')
  })

  it('title-cases each hyphen-separated word', () => {
    expect(folderNameToChapterName('kings-indian')).toBe('Kings Indian')
  })

  it('handles an alphanumeric segment like d5', () => {
    expect(folderNameToChapterName('london-vs-d5')).toBe('London Vs D5')
  })
})

describe('buildStudies (subdirectory mode)', () => {
  let studiesDir, outputPath

  beforeEach(() => {
    studiesDir = mkdtempSync(path.join(tmpdir(), 'chess-test-'))
    outputPath = path.join(studiesDir, 'out.json')
  })

  afterEach(() => {
    rmSync(studiesDir, { recursive: true, force: true })
  })

  it('groups all PGN files in a subfolder into one chapter', () => {
    const folderPath = path.join(studiesDir, 'benoni')
    mkdirSync(folderPath)
    fsWriteFileSync(path.join(folderPath, 'a.pgn'), '[Event "T"]\n\n1. d4 Nf6 *')
    fsWriteFileSync(path.join(folderPath, 'b.pgn'), '[Event "T"]\n\n1. e4 e5 *')

    const result = buildStudies(studiesDir, outputPath)

    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].id).toBe('benoni')
    expect(result.chapters[0].name).toBe('Benoni')
    expect(result.chapters[0].lines).toHaveLength(2)
    expect(result.chapters[0].lines[0].id).toBe('benoni-0')
    expect(result.chapters[0].lines[1].id).toBe('benoni-1')
  })

  it('uses _name.txt for display name when present', () => {
    const folderPath = path.join(studiesDir, 'benoni')
    mkdirSync(folderPath)
    fsWriteFileSync(path.join(folderPath, '_name.txt'), 'London vs Benoni\n')
    fsWriteFileSync(path.join(folderPath, 'line.pgn'), '[Event "T"]\n\n1. d4 Nf6 *')

    const result = buildStudies(studiesDir, outputPath)

    expect(result.chapters[0].name).toBe('London vs Benoni')
  })

  it('creates separate chapters for separate subfolders', () => {
    for (const name of ['benoni', 'benko']) {
      const folderPath = path.join(studiesDir, name)
      mkdirSync(folderPath)
      fsWriteFileSync(path.join(folderPath, 'line.pgn'), '[Event "T"]\n\n1. d4 Nf6 *')
    }

    const result = buildStudies(studiesDir, outputPath)

    expect(result.chapters).toHaveLength(2)
    expect(result.chapters.map(c => c.id)).toEqual(['benko', 'benoni'])
  })

  it('loads PGN files alphabetically within a folder', () => {
    const folderPath = path.join(studiesDir, 'test')
    mkdirSync(folderPath)
    fsWriteFileSync(path.join(folderPath, 'b.pgn'), '[Event "T"]\n\n1. e4 e5 *')
    fsWriteFileSync(path.join(folderPath, 'a.pgn'), '[Event "T"]\n\n1. d4 d5 *')

    const result = buildStudies(studiesDir, outputPath)

    expect(result.chapters[0].lines[0].positions[0].move).toBe('d4') // a.pgn first
    expect(result.chapters[0].lines[1].positions[0].move).toBe('e4') // b.pgn second
  })

  it('skips folders with no PGN files', () => {
    mkdirSync(path.join(studiesDir, 'empty'))
    const folderPath = path.join(studiesDir, 'benoni')
    mkdirSync(folderPath)
    fsWriteFileSync(path.join(folderPath, 'line.pgn'), '[Event "T"]\n\n1. d4 Nf6 *')

    const result = buildStudies(studiesDir, outputPath)

    expect(result.chapters).toHaveLength(1)
    expect(result.chapters[0].id).toBe('benoni')
  })

  it('writes valid JSON to the output path', () => {
    const folderPath = path.join(studiesDir, 'benoni')
    mkdirSync(folderPath)
    fsWriteFileSync(path.join(folderPath, 'line.pgn'), '[Event "T"]\n\n1. d4 Nf6 *')

    buildStudies(studiesDir, outputPath)

    const written = JSON.parse(fsReadFileSync(outputPath, 'utf8'))
    expect(written).toHaveProperty('chapters')
    expect(written.chapters[0].id).toBe('benoni')
  })

  it('handles a PGN file containing multiple games as separate lines', () => {
    const folderPath = path.join(studiesDir, 'benoni')
    mkdirSync(folderPath)
    fsWriteFileSync(
      path.join(folderPath, 'multi.pgn'),
      '[Event "T"]\n\n1. d4 Nf6 *\n\n[Event "T"]\n\n1. e4 e5 *'
    )

    const result = buildStudies(studiesDir, outputPath)

    expect(result.chapters[0].lines).toHaveLength(2)
    expect(result.chapters[0].lines[0].id).toBe('benoni-0')
    expect(result.chapters[0].lines[1].id).toBe('benoni-1')
  })
})
