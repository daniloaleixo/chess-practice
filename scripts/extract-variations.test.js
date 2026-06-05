import { extractAllLeafPaths, formatLeafAsPgn, extractVariations } from './extract-variations.js'
import { mkdtempSync, rmSync, readdirSync, readFileSync as fsReadFileSync, writeFileSync as fsWriteFileSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'

describe('extractAllLeafPaths', () => {
  it('returns empty array for a PGN with no variations', () => {
    const pgn = '[Event "T"]\n\n1. d4 Nf6 2. Bf4 e6 *'
    expect(extractAllLeafPaths(pgn)).toEqual([])
  })

  it('returns one leaf path for a PGN with one variation', () => {
    const pgn = '[Event "T"]\n\n1. d4 (1. e4 e5) 1... d5 *'
    const leaves = extractAllLeafPaths(pgn)
    expect(leaves).toHaveLength(1)
    expect(leaves[0]).toEqual(['e4', 'e5'])
  })

  it('excludes the main trunk from the results', () => {
    const pgn = '[Event "T"]\n\n1. d4 (1. e4 e5) 1... d5 *'
    const leaves = extractAllLeafPaths(pgn)
    expect(leaves.every(l => l[0] !== 'd4')).toBe(true)
  })

  it('returns full path from root for a top-level variation', () => {
    // variation branches after d4 Nf6; alt is d5 instead of Nf6
    const pgn = '[Event "T"]\n\n1. d4 Nf6 (1... d5 2. c4) 2. Bf4 *'
    const leaves = extractAllLeafPaths(pgn)
    expect(leaves).toHaveLength(1)
    expect(leaves[0]).toEqual(['d4', 'd5', 'c4'])
  })

  it('handles nested variations and returns all leaf paths', () => {
    const pgn = '[Event "T"]\n\n1. d4 Nf6 (1... d5 2. c4 (2. e3 e5) 2... e6) (1... e5) 2. Bf4 *'
    const leaves = extractAllLeafPaths(pgn)
    // Leaf 1: d4 d5 e3 e5  (sub-var inside d5 branch)
    // Leaf 2: d4 d5 c4 e6  (main of d5 branch)
    // Leaf 3: d4 e5         (top-level var B)
    expect(leaves).toHaveLength(3)
    expect(leaves[0]).toEqual(['d4', 'd5', 'e3', 'e5'])
    expect(leaves[1]).toEqual(['d4', 'd5', 'c4', 'e6'])
    expect(leaves[2]).toEqual(['d4', 'e5'])
  })

  it('strips comments before extracting paths', () => {
    const pgn = '[Event "T"]\n\n1. d4 { Opening } (1. e4 { Alt } e5) 1... d5 *'
    const leaves = extractAllLeafPaths(pgn)
    expect(leaves).toHaveLength(1)
    expect(leaves[0]).toEqual(['e4', 'e5'])
  })

  it('handles multiple sibling variations off the same move', () => {
    const pgn = '[Event "T"]\n\n1. d4 (1. e4 e5) (1. c4 c5) 1... d5 *'
    const leaves = extractAllLeafPaths(pgn)
    expect(leaves).toHaveLength(2)
    expect(leaves[0]).toEqual(['e4', 'e5'])
    expect(leaves[1]).toEqual(['c4', 'c5'])
  })
})

describe('formatLeafAsPgn', () => {
  it('formats a move array with correct move numbers', () => {
    const result = formatLeafAsPgn(['[Event "T"]'], ['d4', 'Nf6', 'Bf4'])
    expect(result).toContain('1. d4 Nf6 2. Bf4 *')
  })

  it('preserves header lines from the source PGN', () => {
    const headers = ['[Event "Test"]', '[Date "2025.01.01"]']
    const result = formatLeafAsPgn(headers, ['e4'])
    expect(result).toContain('[Event "Test"]')
    expect(result).toContain('[Date "2025.01.01"]')
  })

  it('handles a path with white and black moves', () => {
    const result = formatLeafAsPgn(['[Event "T"]'], ['d4', 'e5', 'c4'])
    expect(result).toContain('1. d4 e5 2. c4 *')
  })
})

describe('extractVariations', () => {
  let tmpDir

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(tmpdir(), 'chess-var-test-'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  it('writes one _var_N.pgn file per leaf variation', () => {
    const pgn = '[Event "T"]\n\n1. d4 (1. e4 e5) (1. c4 c5) 1... d5 *'
    const src = path.join(tmpDir, 'study.pgn')
    fsWriteFileSync(src, pgn)

    extractVariations(src)

    const files = readdirSync(tmpDir).filter(f => f.includes('_var_'))
    // 2 variations (e4 e5, c4 c5) — main line d4 d5 is excluded by extractAllLeafPaths
    expect(files).toHaveLength(2)
    expect(files).toContain('study_var_1.pgn')
    expect(files).toContain('study_var_2.pgn')
  })

  it('written PGN contains the correct moves', () => {
    const pgn = '[Event "T"]\n\n1. d4 (1. e4 e5) 1... d5 *'
    const src = path.join(tmpDir, 'study.pgn')
    fsWriteFileSync(src, pgn)

    extractVariations(src)

    const files = readdirSync(tmpDir).filter(f => f.includes('_var_'))
    const contents = files.map(f => fsReadFileSync(path.join(tmpDir, f), 'utf8'))
    expect(contents.some(c => c.includes('1. e4 e5 *'))).toBe(true)
  })

  it('writes nothing and returns empty array when there are no variations', () => {
    const pgn = '[Event "T"]\n\n1. d4 d5 *'
    const src = path.join(tmpDir, 'study.pgn')
    fsWriteFileSync(src, pgn)

    const result = extractVariations(src)

    expect(result).toEqual([])
    const files = readdirSync(tmpDir).filter(f => f.includes('_var_'))
    expect(files).toHaveLength(0)
  })

  it('throws if any _var_ files already exist in the directory', () => {
    const pgn = '[Event "T"]\n\n1. d4 (1. e4 e5) 1... d5 *'
    const src = path.join(tmpDir, 'study.pgn')
    fsWriteFileSync(src, pgn)
    fsWriteFileSync(path.join(tmpDir, 'study_var_1.pgn'), 'stale content')

    expect(() => extractVariations(src)).toThrow(/existing variation files/)
  })

  it('handles a multi-game PGN file and extracts variations from each game', () => {
    // Two games: first has 1 variation, second has 1 variation
    const pgn = [
      '[Event "Game 1"]\n\n1. d4 (1. e4 e5) 1... d5 *',
      '[Event "Game 2"]\n\n1. c4 (1. Nf3 Nf6) 1... c5 *',
    ].join('\n\n')
    const src = path.join(tmpDir, 'multi.pgn')
    fsWriteFileSync(src, pgn)

    const written = extractVariations(src)

    // 2 variations total (one per game), numbered sequentially
    expect(written).toHaveLength(2)
    const allContents = written.map(f => fsReadFileSync(f, 'utf8'))
    expect(allContents.some(c => c.includes('1. e4 e5 *'))).toBe(true)
    expect(allContents.some(c => c.includes('1. Nf3 Nf6 *'))).toBe(true)
  })
})
