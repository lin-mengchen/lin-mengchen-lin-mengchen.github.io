import * as XLSX from 'xlsx'
import type {
  PoetryCharacter,
  PoetryGrid,
  ValidationIssue,
  WorkbookParseResult,
} from '../types/poetry'
import { isVisualWhitespace, splitGraphemes } from '../utils/graphemes'

const MAX_REPORTED_CELL_ERRORS = 12
const MAX_GRID_SLOTS = 500_000
const MAX_CHARACTERS = 20_000

function displayCellValue(cell: XLSX.CellObject): string {
  if (cell.v === null || cell.v === undefined) return ''
  if (typeof cell.v === 'string') return cell.v
  if (cell.v instanceof Date) return cell.v.toISOString()
  return String(cell.v)
}

function firstPopulatedSheet(workbook: XLSX.WorkBook): string | undefined {
  return workbook.SheetNames.find((name) => {
    const sheet = workbook.Sheets[name]
    return Boolean(sheet?.['!ref'])
  })
}

export function parseWorksheet(
  workbook: XLSX.WorkBook,
  fileName: string,
  requestedSheetName?: string,
): WorkbookParseResult {
  const sheetNames = [...workbook.SheetNames]
  const sheetName =
    (requestedSheetName && workbook.Sheets[requestedSheetName]
      ? requestedSheetName
      : firstPopulatedSheet(workbook)) ?? workbook.SheetNames[0]

  if (!sheetName) {
    return {
      grid: null,
      sheetNames,
      issues: [
        {
          code: 'EMPTY_WORKBOOK',
          severity: 'error',
          message: '工作簿中没有可读取的工作表。',
        },
      ],
    }
  }

  const worksheet = workbook.Sheets[sheetName]
  const reference = worksheet?.['!ref']

  if (!worksheet || !reference) {
    return {
      grid: null,
      sheetNames,
      issues: [
        {
          code: 'EMPTY_SHEET',
          severity: 'error',
          message: `工作表“${sheetName}”中没有有效单元格。`,
        },
      ],
    }
  }

  const range = XLSX.utils.decode_range(reference)
  const rowCount = range.e.r - range.s.r + 1
  const colCount = range.e.c - range.s.c + 1
  const gridSlots = rowCount * colCount

  if (!Number.isSafeInteger(gridSlots) || gridSlots > MAX_GRID_SLOTS) {
    return {
      grid: null,
      sheetNames,
      issues: [
        {
          code: 'GRID_TOO_LARGE',
          severity: 'error',
          message: `工作表范围为 ${colCount.toLocaleString('zh-CN')} 列 × ${rowCount.toLocaleString('zh-CN')} 行，超过 500,000 个槽位的安全上限。`,
        },
      ],
    }
  }

  const characters: PoetryCharacter[] = []
  const issues: ValidationIssue[] = []
  let occupiedCellCount = 0
  let invalidCellCount = 0

  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let col = range.s.c; col <= range.e.c; col += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: col })
      const cell = worksheet[address]
      if (!cell) continue

      const rawValue = displayCellValue(cell)
      if (rawValue.length === 0 || isVisualWhitespace(rawValue)) continue

      occupiedCellCount += 1
      if (occupiedCellCount > MAX_CHARACTERS) {
        return {
          grid: null,
          sheetNames,
          issues: [
            {
              code: 'TOO_MANY_CHARACTERS',
              severity: 'error',
              message: '有效字符超过 20,000 个。请拆分工作表后再生成。',
            },
          ],
        }
      }
      let characterValue = rawValue
      let graphemes = splitGraphemes(characterValue)

      if (graphemes.length !== 1) {
        const withoutEdgeWhitespace = rawValue.trim()
        const visibleGraphemes = splitGraphemes(withoutEdgeWhitespace)
        if (visibleGraphemes.length === 1 && withoutEdgeWhitespace !== rawValue) {
          issues.push({
            code: 'WHITESPACE_NORMALIZED',
            severity: 'warning',
            message: `${address} 含首尾空白或换行；已明确清理并按“${withoutEdgeWhitespace}”参与编织。`,
            coordinate: { row, col, address },
            rawValue,
          })
          characterValue = withoutEdgeWhitespace
          graphemes = visibleGraphemes
        }
      }

      if (graphemes.length !== 1) {
        invalidCellCount += 1
        if (issues.filter((issue) => issue.code === 'MULTIPLE_GRAPHEMES').length < MAX_REPORTED_CELL_ERRORS) {
          issues.push({
            code: 'MULTIPLE_GRAPHEMES',
            severity: 'error',
            message: `${address} 包含 ${graphemes.length} 个字素；每个单元格只能放一个汉字或标点。`,
            coordinate: { row, col, address },
            rawValue,
          })
        }
        continue
      }

      characters.push({
        id: `${sheetName}!R${row + 1}C${col + 1}`,
        index: characters.length,
        rawValue,
        char: characterValue,
        normalizedWhitespace: characterValue !== rawValue,
        row,
        col,
        address,
      })
    }
  }

  if (invalidCellCount > MAX_REPORTED_CELL_ERRORS) {
    issues.push({
      code: 'MULTIPLE_GRAPHEMES',
      severity: 'error',
      message: `另有 ${invalidCellCount - MAX_REPORTED_CELL_ERRORS} 个异常单元格未在列表中展开。`,
    })
  }

  const mergeCount = worksheet['!merges']?.length ?? 0
  if (mergeCount > 0) {
    issues.push({
      code: 'MERGED_CELLS',
      severity: 'warning',
      message: `检测到 ${mergeCount} 处合并单元格；仅左上角内容参与编织，其余位置保留为空白间距。`,
    })
  }

  if (occupiedCellCount === 0) {
    issues.push({
      code: 'EMPTY_SHEET',
      severity: 'error',
      message: `工作表“${sheetName}”中没有可显示的字符。`,
    })
  }

  const grid: PoetryGrid = {
    fileName,
    sheetName,
    sheetNames,
    rowStart: range.s.r,
    rowEnd: range.e.r,
    colStart: range.s.c,
    colEnd: range.e.c,
    rowCount,
    colCount,
    occupiedCellCount,
    emptyCellCount: rowCount * colCount - occupiedCellCount,
    characters,
  }

  return { grid, issues, sheetNames }
}

export function parseWorkbookBuffer(
  buffer: ArrayBuffer,
  fileName: string,
  sheetName?: string,
): WorkbookParseResult {
  try {
    const workbook = XLSX.read(buffer, {
      type: 'array',
      cellDates: true,
      cellText: false,
      dense: false,
    })
    return parseWorksheet(workbook, fileName, sheetName)
  } catch (error) {
    const detail = error instanceof Error ? error.message : '未知读取错误'
    return {
      grid: null,
      sheetNames: [],
      issues: [
        {
          code: 'READ_ERROR',
          severity: 'error',
          message: `无法读取工作簿：${detail}`,
        },
      ],
    }
  }
}

export function hasBlockingIssues(result: WorkbookParseResult): boolean {
  return result.issues.some((issue) => issue.severity === 'error')
}
