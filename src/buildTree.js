import { parseLine } from './parseLine'

/**
 * Merge an array of PGN strings into a nested move tree.
 * Each key is a SAN move; the value is the subtree of subsequent moves.
 *
 * e.g. ['1. d4 Nf6 2. c4'] → { d4: { Nf6: { c4: {} } } }
 */
export function buildTree(lines) {
  const root = {}
  for (const pgn of lines) {
    const moves = parseLine(pgn)
    let node = root
    for (const move of moves) {
      if (!node[move]) node[move] = {}
      node = node[move]
    }
  }
  return root
}
