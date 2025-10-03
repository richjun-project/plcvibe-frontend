"use client"

import { useState } from 'react'
import { GridLadderRung, GridCell, ConnectionElement, LadderElement } from '@/lib/ladder/grid-types'
import { SimulatorState } from '@/lib/simulator/engine'

interface GridEditorProps {
  gridRung: GridLadderRung
  networkIdx: number
  state?: SimulatorState
  isEditMode?: boolean
  onCellClick?: (row: number, col: number, cell: GridCell) => void
  onCellRightClick?: (row: number, col: number, cell: GridCell, event: React.MouseEvent) => void
  onBlockSelect?: (startRow: number, startCol: number, endRow: number, endCol: number) => void
  onToolDrop?: (row: number, col: number, toolType: string) => void
}

const CELL_WIDTH = 60
const CELL_HEIGHT = 40

interface CellSelection {
  startRow: number
  startCol: number
  endRow: number
  endCol: number
}

export function GridEditor({
  gridRung,
  networkIdx,
  state,
  isEditMode = false,
  onCellClick,
  onCellRightClick,
  onBlockSelect,
  onToolDrop
}: GridEditorProps) {
  const [selection, setSelection] = useState<CellSelection | null>(null)
  const [dragOver, setDragOver] = useState<{ row: number; col: number } | null>(null)

  const handleCellClick = (row: number, col: number, cell: GridCell, event: React.MouseEvent) => {
    if (event.shiftKey && selection) {
      // Extend selection to create a block
      const newSelection: CellSelection = {
        startRow: Math.min(selection.startRow, row),
        startCol: Math.min(selection.startCol, col),
        endRow: Math.max(selection.startRow, row),
        endCol: Math.max(selection.startCol, col)
      }
      setSelection(newSelection)
      onBlockSelect?.(newSelection.startRow, newSelection.startCol, newSelection.endRow, newSelection.endCol)
    } else {
      // New single cell selection
      setSelection({ startRow: row, startCol: col, endRow: row, endCol: col })
      onCellClick?.(row, col, cell)
    }
  }

  const handleCellRightClick = (row: number, col: number, cell: GridCell, event: React.MouseEvent) => {
    event.preventDefault()
    onCellRightClick?.(row, col, cell, event)
  }

  const handleDragOver = (row: number, col: number, e: React.DragEvent) => {
    e.preventDefault()
    setDragOver({ row, col })
  }

  const handleDragLeave = () => {
    setDragOver(null)
  }

  const handleDrop = (row: number, col: number, e: React.DragEvent) => {
    e.preventDefault()
    const toolType = e.dataTransfer.getData('toolType')
    if (toolType && onToolDrop) {
      onToolDrop(row, col, toolType)
    }
    setDragOver(null)
  }

  const isSelected = (row: number, col: number) => {
    if (!selection) return false
    return row >= selection.startRow && row <= selection.endRow &&
           col >= selection.startCol && col <= selection.endCol
  }

  const isBlockSelection = () => {
    if (!selection) return false
    return selection.startRow !== selection.endRow || selection.startCol !== selection.endCol
  }

  const renderCell = (cell: GridCell, row: number, col: number) => {
    const isActive = cell.connection?.active || false
    const selected = isSelected(row, col)
    const isDraggedOver = dragOver?.row === row && dragOver?.col === col

    return (
      <div
        key={`${row}-${col}`}
        className={`
          flex items-center justify-center
          border border-gray-700
          transition-colors cursor-pointer
          ${selected ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900/50'}
          ${isDraggedOver ? 'bg-green-900/30 border-green-500' : ''}
          ${isEditMode ? 'hover:bg-gray-800/70' : ''}
        `}
        style={{
          width: CELL_WIDTH,
          height: CELL_HEIGHT,
          gridRow: row + 1,
          gridColumn: col + 1
        }}
        onClick={(e) => handleCellClick(row, col, cell, e)}
        onContextMenu={(e) => handleCellRightClick(row, col, cell, e)}
        onDragOver={(e) => handleDragOver(row, col, e)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(row, col, e)}
      >
        {renderCellContent(cell, isActive)}
      </div>
    )
  }

  const renderCellContent = (cell: GridCell, isActive: boolean) => {
    // 래더 요소 렌더링
    if (cell.element) {
      return renderElement(cell.element, isActive)
    }

    // 연결 요소 렌더링
    if (cell.connection) {
      return renderConnection(cell.connection, isActive)
    }

    return null
  }

  const renderElement = (element: LadderElement, isActive: boolean) => {
    const activeColor = isActive ? 'text-green-400' : 'text-gray-500'

    switch (element.type) {
      case 'contact-no':
        return (
          <div className={`font-mono text-sm ${activeColor}`}>
            [ {element.address} ]
          </div>
        )

      case 'contact-nc':
        return (
          <div className={`font-mono text-sm ${activeColor}`}>
            [/ {element.address} ]
          </div>
        )

      case 'coil':
        return (
          <div className={`font-mono text-sm ${activeColor}`}>
            ( {element.address} )
          </div>
        )

      case 'coil-set':
        return (
          <div className={`font-mono text-sm ${activeColor}`}>
            (S {element.address} )
          </div>
        )

      case 'coil-reset':
        return (
          <div className={`font-mono text-sm ${activeColor}`}>
            (R {element.address} )
          </div>
        )

      case 'timer':
        return (
          <div className={`font-mono text-xs ${activeColor}`}>
            <div>TON</div>
            <div>{element.address}</div>
            <div>{element.preset}ms</div>
          </div>
        )

      case 'counter':
        return (
          <div className={`font-mono text-xs ${activeColor}`}>
            <div>CTU</div>
            <div>{element.address}</div>
            <div>/{element.preset}</div>
          </div>
        )

      default:
        return (
          <div className={`text-xs ${activeColor}`}>
            {element.type}
          </div>
        )
    }
  }

  const renderConnection = (connection: ConnectionElement, isActive: boolean) => {
    const activeColor = isActive ? 'text-green-400' : 'text-gray-600'
    const strokeColor = isActive ? '#4ade80' : '#4b5563'

    switch (connection.type) {
      case 'h-line':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <line x1="0" y1="20" x2="60" y2="20" stroke={strokeColor} strokeWidth="2" />
          </svg>
        )

      case 'v-line':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <line x1="30" y1="0" x2="30" y2="40" stroke={strokeColor} strokeWidth="2" />
          </svg>
        )

      case 'junction':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <line x1="0" y1="20" x2="60" y2="20" stroke={strokeColor} strokeWidth="2" />
            <line x1="30" y1="0" x2="30" y2="40" stroke={strokeColor} strokeWidth="2" />
            <circle cx="30" cy="20" r="3" fill={strokeColor} />
          </svg>
        )

      case 'corner-tr':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <path d="M 0 20 L 30 20 L 30 0" stroke={strokeColor} strokeWidth="2" fill="none" />
          </svg>
        )

      case 'corner-tl':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <path d="M 30 0 L 30 20 L 60 20" stroke={strokeColor} strokeWidth="2" fill="none" />
          </svg>
        )

      case 'corner-br':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <path d="M 0 20 L 30 20 L 30 40" stroke={strokeColor} strokeWidth="2" fill="none" />
          </svg>
        )

      case 'corner-bl':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <path d="M 30 40 L 30 20 L 60 20" stroke={strokeColor} strokeWidth="2" fill="none" />
          </svg>
        )

      case 'left-rail':
      case 'right-rail':
        return (
          <svg width="100%" height="100%" viewBox="0 0 60 40">
            <line x1="30" y1="0" x2="30" y2="40" stroke={strokeColor} strokeWidth="3" />
          </svg>
        )

      case 'empty':
        return null

      default:
        return <div className={`text-xs ${activeColor}`}>?</div>
    }
  }

  return (
    <div className="p-4">
      {/* 헤더 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          Network {networkIdx + 1}
          {gridRung.label && <span className="ml-2 text-gray-500">- {gridRung.label}</span>}
        </div>
        <div className="text-xs text-gray-500">
          Grid: {gridRung.rows}×{gridRung.cols}
        </div>
      </div>

      {/* 그리드 */}
      <div
        className="inline-block border-2 border-gray-700 rounded-lg overflow-hidden"
        style={{
          display: 'grid',
          gridTemplateRows: `repeat(${gridRung.rows}, ${CELL_HEIGHT}px)`,
          gridTemplateColumns: `repeat(${gridRung.cols}, ${CELL_WIDTH}px)`
        }}
      >
        {gridRung.grid.map((row, rowIdx) =>
          row.map((cell, colIdx) => renderCell(cell, rowIdx, colIdx))
        )}
      </div>

      {/* 선택된 셀 정보 */}
      {isEditMode && selection && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          {isBlockSelection() ? (
            <div className="text-xs text-gray-400">
              Selected Block: ({selection.startRow}, {selection.startCol}) → ({selection.endRow}, {selection.endCol})
              <span className="ml-2 text-blue-400">
                {(selection.endRow - selection.startRow + 1) * (selection.endCol - selection.startCol + 1)} cells
              </span>
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-400">
                Selected Cell: Row {selection.startRow}, Col {selection.startCol}
              </div>
              {(() => {
                const cell = gridRung.grid[selection.startRow][selection.startCol]
                if (cell.element) {
                  return (
                    <div className="mt-2 text-sm text-gray-300">
                      Element: {cell.element.type}
                      {cell.element.address && ` - ${cell.element.address}`}
                    </div>
                  )
                }
                if (cell.connection) {
                  return (
                    <div className="mt-2 text-sm text-gray-300">
                      Connection: {cell.connection.type}
                    </div>
                  )
                }
                return null
              })()}
            </>
          )}
        </div>
      )}

      {/* 코멘트 */}
      {gridRung.comment && (
        <div className="mt-2 text-xs text-gray-500 italic">
          // {gridRung.comment}
        </div>
      )}
    </div>
  )
}
