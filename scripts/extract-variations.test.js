import { extractAllLeafPaths } from './extract-variations.js'

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
})
