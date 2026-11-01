export type GarmentRegion =
  | 'cap'
  | 'face'
  | 'neck'
  | 'collar'
  | 'front'
  | 'back'
  | 'left-sleeve'
  | 'right-sleeve'
  | 'left-hand'
  | 'right-hand'
  | 'waist'
  | 'hem'

export type GenerationStyle = 'roundCollarRobe' | 'humanUpperBody'

export interface CellCoordinate {
  row: number
  col: number
  address: string
}

export interface PoetryCharacter extends CellCoordinate {
  id: string
  index: number
  rawValue: string
  char: string
  normalizedWhitespace: boolean
}

export interface PoetryGrid {
  fileName: string
  sheetName: string
  sheetNames: string[]
  rowStart: number
  rowEnd: number
  colStart: number
  colEnd: number
  rowCount: number
  colCount: number
  occupiedCellCount: number
  emptyCellCount: number
  characters: PoetryCharacter[]
}

export type ValidationSeverity = 'error' | 'warning'

export interface ValidationIssue {
  code:
    | 'EMPTY_WORKBOOK'
    | 'EMPTY_SHEET'
    | 'MULTIPLE_GRAPHEMES'
    | 'WHITESPACE_NORMALIZED'
    | 'GRID_TOO_LARGE'
    | 'TOO_MANY_CHARACTERS'
    | 'MERGED_CELLS'
    | 'READ_ERROR'
  severity: ValidationSeverity
  message: string
  coordinate?: CellCoordinate
  rawValue?: string
}

export interface WorkbookParseResult {
  grid: PoetryGrid | null
  issues: ValidationIssue[]
  sheetNames: string[]
}
