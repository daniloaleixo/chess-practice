import { Chess } from 'chess.js'

/**
 * Parse a PGN string into an ordered array of SAN move strings.
 * e.g. "1. d4 Nf6 2. c4 e6" → ['d4', 'Nf6', 'c4', 'e6']
 */
export function parseLine(pgn) {
  if (!pgn || !pgn.trim()) return []
  const chess = new Chess()
  chess.loadPgn(pgn)
  return chess.history()
}
