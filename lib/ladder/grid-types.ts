// Grid-based Ladder Logic Types
// 2D 그리드 기반 래더 로직 구조

import { LadderElement } from './parser'

// Re-export LadderElement for convenience
export type { LadderElement } from './parser'

/**
 * 연결 요소 타입
 */
export type ConnectionType =
  | 'h-line'        // 가로선 ────
  | 'v-line'        // 세로선 │
  | 'junction'      // 분기점 ┼
  | 'corner-tr'     // 코너 우상 ┐
  | 'corner-tl'     // 코너 좌상 ┌
  | 'corner-br'     // 코너 우하 ┘
  | 'corner-bl'     // 코너 좌하 └
  | 'left-rail'     // 왼쪽 파워 레일 |
  | 'right-rail'    // 오른쪽 파워 레일 |
  | 'empty'         // 빈 공간

/**
 * 연결 요소
 */
export interface ConnectionElement {
  type: ConnectionType
  active?: boolean  // 전류 흐름 여부
}

/**
 * 그리드 셀 - 래더 요소 또는 연결 요소
 */
export interface GridCell {
  row: number
  col: number
  element?: LadderElement          // 래더 요소 (접점, 코일 등)
  connection?: ConnectionElement   // 연결 요소 (선, 코너 등)
}

/**
 * 그리드 기반 래더 Rung
 */
export interface GridLadderRung {
  id: number
  label?: string
  rows: number      // 그리드 행 수
  cols: number      // 그리드 열 수
  grid: GridCell[][]  // 2D 그리드
  comment?: string
}

/**
 * 그리드 기반 래더 프로그램
 */
export interface GridLadderProgram {
  networks: GridLadderRung[]
  ioMap: IOMapping[]
}

/**
 * I/O 매핑 (기존 parser.ts와 동일)
 */
export interface IOMapping {
  address: string
  name: string
  type: 'DI' | 'DO' | 'AI' | 'AO' | 'M'
  description?: string
}

/**
 * 빈 그리드 셀 생성
 */
export function createEmptyCell(row: number, col: number): GridCell {
  return {
    row,
    col,
    connection: { type: 'empty' }
  }
}

/**
 * 빈 그리드 생성
 */
export function createEmptyGrid(rows: number, cols: number): GridCell[][] {
  const grid: GridCell[][] = []

  for (let r = 0; r < rows; r++) {
    const row: GridCell[] = []
    for (let c = 0; c < cols; c++) {
      row.push(createEmptyCell(r, c))
    }
    grid.push(row)
  }

  return grid
}

/**
 * 기본 그리드 Rung 생성 (파워 레일 포함)
 */
export function createDefaultGridRung(id: number, rows: number = 1, cols: number = 10): GridLadderRung {
  const grid = createEmptyGrid(rows, cols)

  // 왼쪽 파워 레일 추가
  for (let r = 0; r < rows; r++) {
    grid[r][0] = {
      row: r,
      col: 0,
      connection: { type: 'left-rail' }
    }
  }

  // 오른쪽 파워 레일 추가
  for (let r = 0; r < rows; r++) {
    grid[r][cols - 1] = {
      row: r,
      col: cols - 1,
      connection: { type: 'right-rail' }
    }
  }

  return {
    id,
    rows,
    cols,
    grid
  }
}

/**
 * 셀에 요소 배치
 */
export function placeElementInGrid(
  grid: GridCell[][],
  row: number,
  col: number,
  element: LadderElement
): GridCell[][] {
  const newGrid = [...grid]
  newGrid[row][col] = {
    row,
    col,
    element
  }
  return newGrid
}

/**
 * 셀에 연결 요소 배치
 */
export function placeConnectionInGrid(
  grid: GridCell[][],
  row: number,
  col: number,
  connection: ConnectionElement
): GridCell[][] {
  const newGrid = [...grid]
  newGrid[row][col] = {
    row,
    col,
    connection
  }
  return newGrid
}

/**
 * 셀 가져오기
 */
export function getCellAt(grid: GridCell[][], row: number, col: number): GridCell | null {
  if (row < 0 || row >= grid.length) return null
  if (col < 0 || col >= grid[0].length) return null
  return grid[row][col]
}

/**
 * 셀 삭제 (빈 셀로 변경)
 */
export function clearCell(grid: GridCell[][], row: number, col: number): GridCell[][] {
  const newGrid = [...grid]
  newGrid[row][col] = createEmptyCell(row, col)
  return newGrid
}
