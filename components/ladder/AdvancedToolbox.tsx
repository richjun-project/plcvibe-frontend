"use client"

import { useState } from 'react'
import { ConnectionType } from '@/lib/ladder/grid-types'
import { ChevronDown, ChevronRight } from 'lucide-react'

export type ToolType =
  // Connections
  | 'h-line' | 'v-line' | 'junction'
  | 'corner-tr' | 'corner-tl' | 'corner-br' | 'corner-bl'
  // Contacts
  | 'contact-no' | 'contact-nc' | 'contact-p' | 'contact-n'
  // Coils
  | 'coil' | 'coil-set' | 'coil-reset' | 'coil-p' | 'coil-n'
  // Function Blocks
  | 'timer-ton' | 'timer-tof' | 'counter-ctu' | 'counter-ctd'
  // Math
  | 'math-add' | 'math-sub' | 'math-mul' | 'math-div' | 'move'
  // Compare
  | 'compare-gt' | 'compare-lt' | 'compare-eq' | 'compare-ge' | 'compare-le' | 'compare-ne'
  // Advanced
  | 'pid' | 'filter-avg' | 'scale'

interface ToolDefinition {
  type: ToolType
  label: string
  symbol: string
  description: string
}

interface ToolCategory {
  name: string
  tools: ToolDefinition[]
}

const toolCategories: ToolCategory[] = [
  {
    name: 'Connections',
    tools: [
      { type: 'h-line', label: '가로선', symbol: '────', description: 'Horizontal Line' },
      { type: 'v-line', label: '세로선', symbol: '│', description: 'Vertical Line' },
      { type: 'junction', label: '분기점', symbol: '┼', description: 'Junction' },
      { type: 'corner-tr', label: '코너 ┐', symbol: '┐', description: 'Corner Top-Right' },
      { type: 'corner-tl', label: '코너 ┌', symbol: '┌', description: 'Corner Top-Left' },
      { type: 'corner-br', label: '코너 ┘', symbol: '┘', description: 'Corner Bottom-Right' },
      { type: 'corner-bl', label: '코너 └', symbol: '└', description: 'Corner Bottom-Left' },
    ]
  },
  {
    name: 'Contacts',
    tools: [
      { type: 'contact-no', label: 'NO 접점', symbol: '[ I ]', description: 'Normally Open' },
      { type: 'contact-nc', label: 'NC 접점', symbol: '[/ I ]', description: 'Normally Closed' },
      { type: 'contact-p', label: '상승 엣지', symbol: '[P]', description: 'Positive Edge' },
      { type: 'contact-n', label: '하강 엣지', symbol: '[N]', description: 'Negative Edge' },
    ]
  },
  {
    name: 'Coils',
    tools: [
      { type: 'coil', label: '코일', symbol: '( Q )', description: 'Coil' },
      { type: 'coil-set', label: 'Set 코일', symbol: '(S)', description: 'Set Coil' },
      { type: 'coil-reset', label: 'Reset 코일', symbol: '(R)', description: 'Reset Coil' },
      { type: 'coil-p', label: '상승 엣지', symbol: '(P)', description: 'Positive Edge' },
      { type: 'coil-n', label: '하강 엣지', symbol: '(N)', description: 'Negative Edge' },
    ]
  },
  {
    name: 'Timers & Counters',
    tools: [
      { type: 'timer-ton', label: 'TON', symbol: '[TON]', description: 'Timer On-Delay' },
      { type: 'timer-tof', label: 'TOF', symbol: '[TOF]', description: 'Timer Off-Delay' },
      { type: 'counter-ctu', label: 'CTU', symbol: '[CTU]', description: 'Counter Up' },
      { type: 'counter-ctd', label: 'CTD', symbol: '[CTD]', description: 'Counter Down' },
    ]
  },
  {
    name: 'Math Operations',
    tools: [
      { type: 'math-add', label: 'ADD', symbol: '[+]', description: 'Addition' },
      { type: 'math-sub', label: 'SUB', symbol: '[-]', description: 'Subtraction' },
      { type: 'math-mul', label: 'MUL', symbol: '[×]', description: 'Multiplication' },
      { type: 'math-div', label: 'DIV', symbol: '[÷]', description: 'Division' },
      { type: 'move', label: 'MOVE', symbol: '[→]', description: 'Move' },
    ]
  },
  {
    name: 'Comparisons',
    tools: [
      { type: 'compare-gt', label: 'GT (>)', symbol: '[>]', description: 'Greater Than' },
      { type: 'compare-lt', label: 'LT (<)', symbol: '[<]', description: 'Less Than' },
      { type: 'compare-eq', label: 'EQ (=)', symbol: '[=]', description: 'Equal' },
      { type: 'compare-ge', label: 'GE (>=)', symbol: '[≥]', description: 'Greater or Equal' },
      { type: 'compare-le', label: 'LE (<=)', symbol: '[≤]', description: 'Less or Equal' },
      { type: 'compare-ne', label: 'NE (≠)', symbol: '[≠]', description: 'Not Equal' },
    ]
  },
  {
    name: 'Advanced Functions',
    tools: [
      { type: 'pid', label: 'PID', symbol: '[PID]', description: 'PID Controller' },
      { type: 'filter-avg', label: 'Filter', symbol: '[AVG]', description: 'Moving Average Filter' },
      { type: 'scale', label: 'Scale', symbol: '[SCL]', description: 'Scaling Function' },
    ]
  }
]

interface AdvancedToolboxProps {
  selectedTool: ToolType | null
  onToolSelect: (tool: ToolType | null) => void
}

export function AdvancedToolbox({ selectedTool, onToolSelect }: AdvancedToolboxProps) {
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(['Connections', 'Contacts', 'Coils'])
  )

  const toggleCategory = (categoryName: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(categoryName)) {
        next.delete(categoryName)
      } else {
        next.add(categoryName)
      }
      return next
    })
  }

  const handleToolClick = (toolType: ToolType) => {
    if (selectedTool === toolType) {
      onToolSelect(null) // Deselect
    } else {
      onToolSelect(toolType)
    }
  }

  const handleDragStart = (e: React.DragEvent, toolType: ToolType) => {
    e.dataTransfer.effectAllowed = 'copy'
    e.dataTransfer.setData('toolType', toolType)
  }

  return (
    <div className="w-full border-b border-gray-700 bg-gray-900/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-300">
          Advanced Toolbox
        </h3>
        {selectedTool && (
          <button
            onClick={() => onToolSelect(null)}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Clear Selection
          </button>
        )}
      </div>

      {selectedTool && (
        <div className="mb-4 rounded-lg bg-blue-900/20 border border-blue-500/30 p-3">
          <div className="text-xs text-blue-300">
            Selected: <span className="font-mono font-semibold">{selectedTool}</span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            Click on a grid cell to place this element
          </div>
        </div>
      )}

      <div className="space-y-2">
        {toolCategories.map(category => (
          <div key={category.name} className="rounded-lg border border-gray-700 bg-gray-800/30">
            {/* Category Header */}
            <button
              onClick={() => toggleCategory(category.name)}
              className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-gray-700/30 transition-colors"
            >
              <span className="text-sm font-medium text-gray-300">{category.name}</span>
              {expandedCategories.has(category.name) ? (
                <ChevronDown className="h-4 w-4 text-gray-400" />
              ) : (
                <ChevronRight className="h-4 w-4 text-gray-400" />
              )}
            </button>

            {/* Tools Grid */}
            {expandedCategories.has(category.name) && (
              <div className="grid grid-cols-2 gap-2 p-3 pt-0 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
                {category.tools.map(tool => (
                  <button
                    key={tool.type}
                    onClick={() => handleToolClick(tool.type)}
                    draggable
                    onDragStart={(e) => handleDragStart(e, tool.type)}
                    className={`
                      group relative flex flex-col items-center justify-center
                      rounded-lg border p-3 transition-all cursor-move
                      ${
                        selectedTool === tool.type
                          ? 'border-blue-500 bg-blue-600 text-white shadow-lg shadow-blue-500/30'
                          : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-700/50'
                      }
                    `}
                    title={tool.description}
                  >
                    {/* Symbol */}
                    <div
                      className={`
                        mb-1 font-mono text-lg
                        ${selectedTool === tool.type ? 'text-white' : 'text-gray-300'}
                      `}
                    >
                      {tool.symbol}
                    </div>

                    {/* Label */}
                    <div
                      className={`
                        text-xs text-center
                        ${selectedTool === tool.type ? 'text-white' : 'text-gray-400'}
                      `}
                    >
                      {tool.label}
                    </div>

                    {/* Tooltip */}
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-10">
                      <div className="rounded bg-gray-900 px-2 py-1 text-xs text-gray-300 whitespace-nowrap border border-gray-700 shadow-lg">
                        {tool.description}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
