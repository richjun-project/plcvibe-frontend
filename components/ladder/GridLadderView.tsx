"use client"

import { useState, useEffect } from 'react'
import { Play, Pause, RotateCcw, CheckCircle2, XCircle, Edit3, Save, X } from 'lucide-react'
import { parseLadderText, type LadderProgram } from '@/lib/ladder/parser'
import { convertProgramToGrid, convertGridToProgram } from '@/lib/ladder/grid-converter'
import { GridLadderProgram, GridLadderRung, GridCell } from '@/lib/ladder/grid-types'
import { PLCSimulator } from '@/lib/simulator/engine'
import type { SimulatorState } from '@/lib/simulator/engine'
import { GridEditor } from './GridEditor'
import { AdvancedToolbox, ToolType } from './AdvancedToolbox'

export interface GridLadderViewProps {
  code: string
  validationSuccess?: boolean
  errorCount?: number
  onCodeChange?: (code: string) => void
}

export function GridLadderView({
  code,
  validationSuccess = true,
  errorCount = 0,
  onCodeChange
}: GridLadderViewProps) {
  const [simulator, setSimulator] = useState<PLCSimulator | null>(null)
  const [simulatorState, setSimulatorState] = useState<SimulatorState | null>(null)
  const [gridProgram, setGridProgram] = useState<GridLadderProgram | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Edit mode
  const [isEditing, setIsEditing] = useState(false)
  const [selectedTool, setSelectedTool] = useState<ToolType | null>(null)
  const [contextMenu, setContextMenu] = useState<{
    x: number
    y: number
    networkIdx: number
    row: number
    col: number
    cell: GridCell
  } | null>(null)

  // Copy/paste functionality
  const [clipboard, setClipboard] = useState<GridCell[][] | null>(null)
  const [currentSelection, setCurrentSelection] = useState<{
    networkIdx: number
    startRow: number
    startCol: number
    endRow: number
    endCol: number
  } | null>(null)

  // Initialize simulator
  useEffect(() => {
    if (!code || code.trim().length === 0) {
      setSimulator(null)
      setGridProgram(null)
      return
    }

    try {
      // Parse ladder text
      const program = parseLadderText(code)

      // Convert to grid
      const grid = convertProgramToGrid(program)
      setGridProgram(grid)

      // Create simulator
      const sim = new PLCSimulator(program)
      sim.start()
      setSimulator(sim)
      setSimulatorState(sim.getState())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Parse error')
      setSimulator(null)
      setGridProgram(null)
    }
  }, [code])

  // Update state continuously
  useEffect(() => {
    if (!simulator) return

    const interval = setInterval(() => {
      setSimulatorState(simulator.getState())
    }, 50)

    return () => clearInterval(interval)
  }, [simulator])

  // Cleanup
  useEffect(() => {
    return () => {
      simulator?.stop()
    }
  }, [simulator])

  // Close context menu on click
  useEffect(() => {
    if (!contextMenu) return
    const handler = () => setContextMenu(null)
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [contextMenu])

  // Keyboard shortcuts for copy/paste
  useEffect(() => {
    if (!isEditing) return

    const handleKeyDown = (e: KeyboardEvent) => {
      // Copy: Ctrl+C or Cmd+C
      if ((e.ctrlKey || e.metaKey) && e.key === 'c' && currentSelection && gridProgram) {
        e.preventDefault()
        const { networkIdx, startRow, startCol, endRow, endCol } = currentSelection
        const network = gridProgram.networks[networkIdx]

        // Copy selected cells to clipboard
        const copiedCells: GridCell[][] = []
        for (let row = startRow; row <= endRow; row++) {
          const copiedRow: GridCell[] = []
          for (let col = startCol; col <= endCol; col++) {
            copiedRow.push({ ...network.grid[row][col] })
          }
          copiedCells.push(copiedRow)
        }
        setClipboard(copiedCells)
      }

      // Paste: Ctrl+V or Cmd+V
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && clipboard && currentSelection && gridProgram) {
        e.preventDefault()
        const { networkIdx, startRow, startCol } = currentSelection

        // Clone grid program
        const newProgram = { ...gridProgram }
        newProgram.networks = [...gridProgram.networks]
        const newRung = { ...gridProgram.networks[networkIdx] }
        newRung.grid = [...newRung.grid.map(r => [...r])]

        // Paste cells from clipboard
        for (let row = 0; row < clipboard.length; row++) {
          for (let col = 0; col < clipboard[row].length; col++) {
            const targetRow = startRow + row
            const targetCol = startCol + col

            // Check bounds
            if (targetRow < newRung.rows && targetCol < newRung.cols) {
              newRung.grid[targetRow][targetCol] = {
                ...clipboard[row][col],
                row: targetRow,
                col: targetCol
              }
            }
          }
        }

        newProgram.networks[networkIdx] = newRung
        setGridProgram(newProgram)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isEditing, currentSelection, clipboard, gridProgram])

  const handleReset = () => {
    simulator?.reset()
    setSimulatorState(simulator?.getState() || null)
  }

  const toggleContact = (address: string) => {
    if (simulator && simulatorState) {
      const currentValue = simulatorState.inputs[address] || false
      simulator.setInput(address, !currentValue)
      setSimulatorState(simulator.getState())
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
    setSelectedTool(null)
  }

  const handleSaveEdit = () => {
    if (gridProgram) {
      // Convert grid back to legacy program
      const program = convertGridToProgram(gridProgram)

      // Serialize to text (need to implement this)
      // For now, just exit edit mode
      // TODO: Implement grid → text serialization
      console.warn('Grid to text serialization not yet implemented')
    }
    setIsEditing(false)
    setSelectedTool(null)
  }

  const handleCancelEdit = () => {
    // Reload grid from code
    try {
      const program = parseLadderText(code)
      const grid = convertProgramToGrid(program)
      setGridProgram(grid)
    } catch (err) {
      // Ignore
    }
    setIsEditing(false)
    setSelectedTool(null)
  }

  const handleCellClick = (networkIdx: number, row: number, col: number, cell: GridCell) => {
    // Update selection for copy/paste
    setCurrentSelection({ networkIdx, startRow: row, startCol: col, endRow: row, endCol: col })

    if (!isEditing || !selectedTool || !gridProgram) return

    // Clone grid program
    const newProgram = { ...gridProgram }
    newProgram.networks = [...gridProgram.networks]
    const newRung = { ...gridProgram.networks[networkIdx] }
    newRung.grid = [...newRung.grid.map(r => [...r])]

    // Place selected tool
    if (selectedTool.startsWith('h-line') ||
        selectedTool.startsWith('v-line') ||
        selectedTool.startsWith('junction') ||
        selectedTool.startsWith('corner')) {
      // Connection element
      newRung.grid[row][col] = {
        row,
        col,
        connection: { type: selectedTool as any }
      }
    } else {
      // Ladder element
      newRung.grid[row][col] = {
        row,
        col,
        element: {
          type: selectedTool as any,
          address: selectedTool.includes('contact') ? 'I0.0' :
                   selectedTool.includes('coil') ? 'Q0.0' :
                   selectedTool.includes('timer') ? 'T1' :
                   selectedTool.includes('counter') ? 'C1' : undefined,
          preset: selectedTool.includes('timer') ? 1000 :
                  selectedTool.includes('counter') ? 10 : undefined
        }
      }
    }

    newProgram.networks[networkIdx] = newRung
    setGridProgram(newProgram)

    // Auto-deselect tool after placement
    setSelectedTool(null)
  }

  const handleBlockSelect = (networkIdx: number, startRow: number, startCol: number, endRow: number, endCol: number) => {
    // Update selection for copy/paste
    setCurrentSelection({ networkIdx, startRow, startCol, endRow, endCol })
  }

  const handleToolDrop = (networkIdx: number, row: number, col: number, toolType: string) => {
    if (!gridProgram) return

    // Clone grid program
    const newProgram = { ...gridProgram }
    newProgram.networks = [...gridProgram.networks]
    const newRung = { ...gridProgram.networks[networkIdx] }
    newRung.grid = [...newRung.grid.map(r => [...r])]

    // Place dropped tool
    if (toolType.startsWith('h-line') ||
        toolType.startsWith('v-line') ||
        toolType.startsWith('junction') ||
        toolType.startsWith('corner')) {
      // Connection element
      newRung.grid[row][col] = {
        row,
        col,
        connection: { type: toolType as any }
      }
    } else {
      // Ladder element
      newRung.grid[row][col] = {
        row,
        col,
        element: {
          type: toolType as any,
          address: toolType.includes('contact') ? 'I0.0' :
                   toolType.includes('coil') ? 'Q0.0' :
                   toolType.includes('timer') ? 'T1' :
                   toolType.includes('counter') ? 'C1' : undefined,
          preset: toolType.includes('timer') ? 1000 :
                  toolType.includes('counter') ? 10 : undefined
        }
      }
    }

    newProgram.networks[networkIdx] = newRung
    setGridProgram(newProgram)
  }

  const handleCellRightClick = (
    networkIdx: number,
    row: number,
    col: number,
    cell: GridCell,
    event: React.MouseEvent
  ) => {
    if (!isEditing) return

    event.preventDefault()
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      networkIdx,
      row,
      col,
      cell
    })
  }

  const handleDeleteCell = () => {
    if (!contextMenu || !gridProgram) return

    const { networkIdx, row, col } = contextMenu

    // Clone and clear cell
    const newProgram = { ...gridProgram }
    newProgram.networks = [...gridProgram.networks]
    const newRung = { ...gridProgram.networks[networkIdx] }
    newRung.grid = [...newRung.grid.map(r => [...r])]

    newRung.grid[row][col] = {
      row,
      col,
      connection: { type: 'empty' }
    }

    newProgram.networks[networkIdx] = newRung
    setGridProgram(newProgram)
    setContextMenu(null)
  }

  if (!code || code.trim().length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-600 bg-gray-900/30 p-8 text-center">
        <p className="text-sm text-gray-500">No code generated yet</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/10 p-4">
        <div className="flex items-center gap-2 text-red-400">
          <XCircle className="h-5 w-5" />
          <span className="font-medium">Parse Error</span>
        </div>
        <p className="mt-2 text-sm text-gray-400">{error}</p>
      </div>
    )
  }

  if (!gridProgram || !simulator || !simulatorState) {
    return (
      <div className="rounded-lg border border-gray-600 bg-gray-900 p-4">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-700 bg-gradient-to-br from-gray-900 to-gray-800 shadow-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-700 bg-gray-900/50 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {validationSuccess ? (
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <span className="font-semibold text-gray-200">
              {gridProgram.networks.length} Networks (Grid Mode)
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <span className="px-2 py-1 bg-gray-800 rounded font-mono">
              Scan: {simulatorState.scanTime.toFixed(2)}ms
            </span>
            <span className="px-2 py-1 bg-gray-800 rounded font-mono">
              Cycles: {simulatorState.cycleCount}
            </span>
          </div>
          {isEditing && (
            <span className="text-xs text-blue-400">✏️ GRID EDIT MODE</span>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button
                onClick={handleSaveEdit}
                className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex items-center gap-1.5 rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
                Cancel
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleEdit}
                className="flex items-center gap-1.5 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>
            </>
          )}
        </div>
      </div>

      {/* Advanced Toolbox */}
      {isEditing && (
        <AdvancedToolbox
          selectedTool={selectedTool}
          onToolSelect={setSelectedTool}
        />
      )}

      {/* Grid Networks */}
      <div className="p-4 space-y-6">
        {gridProgram.networks.map((network, idx) => (
          <div key={idx}>
            <GridEditor
              gridRung={network}
              networkIdx={idx}
              state={simulatorState}
              isEditMode={isEditing}
              onCellClick={(row, col, cell) => handleCellClick(idx, row, col, cell)}
              onCellRightClick={(row, col, cell, event) => handleCellRightClick(idx, row, col, cell, event)}
              onBlockSelect={(startRow, startCol, endRow, endCol) => handleBlockSelect(idx, startRow, startCol, endRow, endCol)}
              onToolDrop={(row, col, toolType) => handleToolDrop(idx, row, col, toolType)}
            />
          </div>
        ))}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={handleDeleteCell}
            className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-gray-700 flex items-center gap-2"
          >
            <X className="h-4 w-4" />
            Delete Cell
          </button>
          <div className="border-t border-gray-700 my-1"></div>
          <div className="px-4 py-1 text-xs text-gray-500">
            Cell: ({contextMenu.row}, {contextMenu.col})
          </div>
        </div>
      )}
    </div>
  )
}
