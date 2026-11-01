import { describe, expect, it } from 'vitest'
import { splitGraphemes } from './graphemes'

describe('splitGraphemes', () => {
  it('treats Chinese punctuation and astral characters as single graphemes', () => {
    expect(splitGraphemes('，')).toEqual(['，'])
    expect(splitGraphemes('𠮷')).toEqual(['𠮷'])
  })

  it('keeps variation selectors and combining marks with their base', () => {
    expect(splitGraphemes('木\uFE0F')).toHaveLength(1)
    expect(splitGraphemes('e\u0301')).toHaveLength(1)
  })

  it('reports a trailing line feed as a second grapheme', () => {
    expect(splitGraphemes('落\n')).toEqual(['落', '\n'])
  })
})
