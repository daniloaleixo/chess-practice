import { parseLine } from './parseLine'

describe('parseLine', () => {
  it('parses a simple two-move line', () => {
    const moves = parseLine('1. d4 Nf6')
    expect(moves).toEqual(['d4', 'Nf6'])
  })

  it('parses a longer line with multiple full moves', () => {
    const moves = parseLine('1. d4 Nf6 2. c4 e6 3. Nc3 Bb4')
    expect(moves).toEqual(['d4', 'Nf6', 'c4', 'e6', 'Nc3', 'Bb4'])
  })

  it('parses a line ending on a White move', () => {
    const moves = parseLine('1. d4 d5 2. c4')
    expect(moves).toEqual(['d4', 'd5', 'c4'])
  })

  it('handles castling notation', () => {
    const moves = parseLine('1. d4 Nf6 2. Nf3 g6 3. g3 Bg7 4. Bg2 O-O')
    expect(moves).toEqual(['d4', 'Nf6', 'Nf3', 'g6', 'g3', 'Bg7', 'Bg2', 'O-O'])
  })

  it('returns empty array for empty string', () => {
    const moves = parseLine('')
    expect(moves).toEqual([])
  })
})
