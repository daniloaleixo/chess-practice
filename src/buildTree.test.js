import { buildTree } from './buildTree'

describe('buildTree', () => {
  it('builds a tree from a single line', () => {
    const tree = buildTree(['1. d4 Nf6'])
    expect(tree).toEqual({ d4: { Nf6: {} } })
  })

  it('merges two lines that share a prefix', () => {
    const tree = buildTree(['1. d4 Nf6 2. c4', '1. d4 d5 2. c4'])
    expect(tree).toEqual({
      d4: {
        Nf6: { c4: {} },
        d5: { c4: {} },
      },
    })
  })

  it('returns an empty object for an empty array', () => {
    const tree = buildTree([])
    expect(tree).toEqual({})
  })

  it('does not duplicate nodes for identical lines', () => {
    const tree = buildTree(['1. d4 Nf6', '1. d4 Nf6'])
    expect(tree).toEqual({ d4: { Nf6: {} } })
  })
})
