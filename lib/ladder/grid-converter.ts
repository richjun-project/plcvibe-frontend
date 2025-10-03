// 기존 LadderRung ↔ GridLadderRung 변환
// Legacy 래더 구조를 그리드 기반으로 변환

import { LadderRung, LadderElement, LadderProgram } from './parser'
import {
  GridLadderRung,
  GridLadderProgram,
  GridCell,
  ConnectionElement,
  createEmptyGrid,
  IOMapping
} from './grid-types'

/**
 * 기존 LadderRung을 GridLadderRung으로 변환
 * 선형 배열 → 2D 그리드
 */
export function convertRungToGrid(rung: LadderRung): GridLadderRung {
  // 병렬 브랜치가 있는 경우
  if (rung.branches && rung.branches.length > 0) {
    return convertBranchesToGrid(rung)
  }

  // 단일 브랜치 (기본)
  const elements = rung.elements
  const cols = elements.length + 2 // 양쪽 파워 레일 포함
  const rows = 1

  const grid = createEmptyGrid(rows, cols)

  // 왼쪽 파워 레일
  grid[0][0] = {
    row: 0,
    col: 0,
    connection: { type: 'left-rail' }
  }

  // 요소 배치
  elements.forEach((element, idx) => {
    const col = idx + 1
    grid[0][col] = {
      row: 0,
      col,
      element
    }
  })

  // 오른쪽 파워 레일
  grid[0][cols - 1] = {
    row: 0,
    col: cols - 1,
    connection: { type: 'right-rail' }
  }

  return {
    id: rung.id,
    label: rung.label,
    rows,
    cols,
    grid,
    comment: rung.comment
  }
}

/**
 * 병렬 브랜치를 그리드로 변환
 */
function convertBranchesToGrid(rung: LadderRung): GridLadderRung {
  const branches = rung.branches!
  const rows = branches.length
  const maxBranchLength = Math.max(...branches.map(b => b.length))
  const cols = maxBranchLength + 2 // 파워 레일 포함

  const grid = createEmptyGrid(rows, cols)

  // 각 브랜치를 행으로 배치
  branches.forEach((branch, rowIdx) => {
    // 왼쪽 파워 레일
    grid[rowIdx][0] = {
      row: rowIdx,
      col: 0,
      connection: { type: 'left-rail' }
    }

    // 브랜치 요소 배치
    branch.forEach((element, colIdx) => {
      const col = colIdx + 1
      grid[rowIdx][col] = {
        row: rowIdx,
        col,
        element
      }
    })

    // 오른쪽 파워 레일
    grid[rowIdx][cols - 1] = {
      row: rowIdx,
      col: cols - 1,
      connection: { type: 'right-rail' }
    }
  })

  return {
    id: rung.id,
    label: rung.label,
    rows,
    cols,
    grid,
    comment: rung.comment
  }
}

/**
 * GridLadderRung을 기존 LadderRung으로 역변환
 * (호환성 유지)
 */
export function convertGridToRung(gridRung: GridLadderRung): LadderRung {
  const elements: LadderElement[] = []
  const branches: LadderElement[][] = []

  // 단일 행인 경우
  if (gridRung.rows === 1) {
    // 첫 번째 행의 요소들만 추출
    gridRung.grid[0].forEach(cell => {
      if (cell.element) {
        elements.push(cell.element)
      }
    })

    return {
      id: gridRung.id,
      label: gridRung.label,
      elements,
      comment: gridRung.comment
    }
  }

  // 다중 행인 경우 (병렬 브랜치)
  gridRung.grid.forEach(row => {
    const branchElements: LadderElement[] = []
    row.forEach(cell => {
      if (cell.element) {
        branchElements.push(cell.element)
      }
    })
    if (branchElements.length > 0) {
      branches.push(branchElements)
    }
  })

  return {
    id: gridRung.id,
    label: gridRung.label,
    elements: [],  // Legacy
    branches,
    comment: gridRung.comment
  }
}

/**
 * 전체 프로그램 변환 (Legacy → Grid)
 */
export function convertProgramToGrid(program: LadderProgram): GridLadderProgram {
  return {
    networks: program.networks.map(rung => convertRungToGrid(rung)),
    ioMap: program.ioMap
  }
}

/**
 * 전체 프로그램 역변환 (Grid → Legacy)
 */
export function convertGridToProgram(gridProgram: GridLadderProgram): LadderProgram {
  return {
    networks: gridProgram.networks.map(gridRung => convertGridToRung(gridRung)),
    ioMap: gridProgram.ioMap
  }
}

/**
 * 그리드를 텍스트로 시각화 (디버깅용)
 */
export function visualizeGrid(gridRung: GridLadderRung): string {
  let output = ''

  gridRung.grid.forEach((row, rowIdx) => {
    let line = ''
    row.forEach(cell => {
      if (cell.connection) {
        switch (cell.connection.type) {
          case 'left-rail':
          case 'right-rail':
          case 'v-line':
            line += '|'
            break
          case 'h-line':
            line += '---'
            break
          case 'junction':
            line += '+'
            break
          case 'corner-tr':
            line += '┐'
            break
          case 'corner-tl':
            line += '┌'
            break
          case 'corner-br':
            line += '┘'
            break
          case 'corner-bl':
            line += '└'
            break
          case 'empty':
            line += '   '
            break
        }
      } else if (cell.element) {
        switch (cell.element.type) {
          case 'contact-no':
            line += `[${cell.element.address}]`
            break
          case 'contact-nc':
            line += `[/${cell.element.address}]`
            break
          case 'coil':
            line += `(${cell.element.address})`
            break
          default:
            line += '[?]'
        }
      } else {
        line += '   '
      }
    })
    output += line + '\n'
  })

  return output
}
