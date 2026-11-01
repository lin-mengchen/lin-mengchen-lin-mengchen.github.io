import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import * as XLSX from 'xlsx'
import { describe, expect, it } from 'vitest'
import { createGarmentMapping } from '../geometry/garmentMapping'
import { hasBlockingIssues, parseWorkbookBuffer, parseWorksheet } from './excel'

function asArrayBuffer(buffer: Buffer): ArrayBuffer {
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer
}

function workbookBuffer(rows: unknown[][]): ArrayBuffer {
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '字阵')
  return XLSX.write(workbook, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer
}

describe('parseWorkbookBuffer', () => {
  it('preserves the sparse coordinates and baseline of the provided workbook', () => {
    const input = readFileSync(resolve(process.cwd(), '深秋织锦.xlsx'))
    const result = parseWorkbookBuffer(asArrayBuffer(input), '深秋织锦.xlsx')

    expect(hasBlockingIssues(result)).toBe(false)
    expect(result.grid).not.toBeNull()
    const grid = result.grid!

    expect(grid.sheetName).toBe('Sheet1')
    expect(grid.rowStart).toBe(36)
    expect(grid.colStart).toBe(28)
    expect(grid.rowCount).toBe(102)
    expect(grid.colCount).toBe(91)
    expect(grid.characters).toHaveLength(2097)
    expect(grid.emptyCellCount).toBe(7185)
    expect(new Set(grid.characters.map((cell) => cell.id)).size).toBe(2097)

    expect(grid.characters.find((cell) => cell.address === 'BA37')?.char).toBe('种')
    expect(grid.characters.find((cell) => cell.address === 'AC100')?.char).toBe('假')
    expect(grid.characters.find((cell) => cell.address === 'DO68')?.char).toBe('微')
    expect(grid.characters.find((cell) => cell.address === 'BH138')?.char).toBe('结')

    const normalizedCell = grid.characters.find((cell) => cell.address === 'DF53')
    expect(normalizedCell?.rawValue).toBe('落\n')
    expect(normalizedCell?.char).toBe('落')
    expect(normalizedCell?.normalizedWhitespace).toBe(true)
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'WHITESPACE_NORMALIZED', coordinate: expect.objectContaining({ address: 'DF53' }) }),
    ]))

    const mapping = createGarmentMapping(grid)
    expect(mapping.poses).toHaveLength(grid.characters.length)
    expect(mapping.edges).toHaveLength(2449)
    expect(mapping.poses.every((pose) => pose.targetPosition.toArray().every(Number.isFinite))).toBe(true)
    expect(mapping.poses.every((pose) => Math.abs(pose.targetQuaternion.length() - 1) < 1e-5)).toBe(true)
  })

  it('keeps internal blank cells as coordinate gaps', () => {
    const result = parseWorkbookBuffer(workbookBuffer([['山', undefined, '水']]), '稀疏.xlsx')
    expect(result.grid?.colCount).toBe(3)
    expect(result.grid?.characters.map((cell) => cell.col)).toEqual([0, 2])
    expect(result.grid?.emptyCellCount).toBe(1)
  })

  it('blocks a cell containing two visible graphemes', () => {
    const result = parseWorkbookBuffer(workbookBuffer([['春秋']]), '异常.xlsx')
    expect(hasBlockingIssues(result)).toBe(true)
    expect(result.issues[0]).toEqual(expect.objectContaining({
      code: 'MULTIPLE_GRAPHEMES',
      coordinate: expect.objectContaining({ address: 'A1' }),
    }))
  })

  it('accepts an ASCII comma as one Unicode grapheme', () => {
    const result = parseWorkbookBuffer(workbookBuffer([[',']]), '标点.xlsx')
    expect(hasBlockingIssues(result)).toBe(false)
    expect(result.grid?.characters[0].char).toBe(',')
  })

  it('rejects a maliciously oversized worksheet dimension before scanning it', () => {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([['诗']])
    worksheet['!ref'] = 'A1:XFD1048576'
    XLSX.utils.book_append_sheet(workbook, worksheet, '超大范围')

    const result = parseWorksheet(workbook, '超大.xlsx')
    expect(result.grid).toBeNull()
    expect(result.issues[0].code).toBe('GRID_TOO_LARGE')
  })
})
