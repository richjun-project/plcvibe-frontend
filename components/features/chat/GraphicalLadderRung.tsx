"use client"

import { LadderRung, LadderElement } from '@/lib/ladder/parser'
import { SimulatorState } from '@/lib/simulator/engine'

interface GraphicalLadderRungProps {
  rung: LadderRung
  networkIdx: number
  state: SimulatorState
  onContactClick?: (address: string) => void
  onElementClick?: (networkIdx: number, elementIdx: number, event: React.MouseEvent) => void
  isEditMode?: boolean
}

const POWER_RAIL_X = 10
const POWER_RAIL_RIGHT_X = 800  // Increased for better spacing
const ELEMENT_WIDTH = 40
const ELEMENT_HEIGHT = 20
const ELEMENT_SPACING = 50
const RUNG_Y = 15

export function GraphicalLadderRung({
  rung,
  networkIdx,
  state,
  onContactClick,
  onElementClick,
  isEditMode = false
}: GraphicalLadderRungProps) {
  // Check if this rung has parallel branches
  if (rung.branches && rung.branches.length > 0) {
    return renderParallelBranches(rung, networkIdx, state, onContactClick, onElementClick, isEditMode)
  }

  // Legacy single branch rendering
  // Calculate current flow through the rung
  let rungCondition = true
  const elementStates: Array<{
    element: LadderElement
    elementActive: boolean
    rungConditionBefore: boolean
    rungConditionAfter: boolean
  }> = []

  // First pass: calculate all states
  rung.elements.forEach((el) => {
    const rungConditionBefore = rungCondition
    let elementActive = false

    switch (el.type) {
      case 'contact-no': {
        let contactValue = false
        // Check if this is a timer/counter done bit (e.g., T1.DN, C1.DN, [ T1.DN ])
        if (el.address!.includes('.DN')) {
          // Remove brackets and spaces: "[ T1.DN ]" -> "T1.DN"
          const cleanAddr = el.address!.replace(/[\[\]\s]/g, '')
          const timerAddr = cleanAddr.split('.')[0]
          contactValue = state.timers[timerAddr]?.done || state.counters[timerAddr]?.done || false
        } else {
          contactValue = state.inputs[el.address!] || state.outputs[el.address!] || state.memory[el.address!] || false
        }
        elementActive = contactValue
        rungCondition = rungCondition && contactValue
        break
      }
      case 'contact-nc': {
        let contactValue = false
        // Check if this is a timer/counter done bit (e.g., /T1.DN, /C1.DN, [/ T1.DN ])
        if (el.address!.includes('.DN')) {
          // Remove brackets and spaces: "[/ T1.DN ]" -> "/T1.DN"
          const cleanAddr = el.address!.replace(/[\[\]\s]/g, '')
          const timerAddr = cleanAddr.split('.')[0].replace('/', '')
          contactValue = state.timers[timerAddr]?.done || state.counters[timerAddr]?.done || false
        } else {
          contactValue = state.inputs[el.address!] || state.outputs[el.address!] || state.memory[el.address!] || false
        }
        elementActive = !contactValue
        rungCondition = rungCondition && !contactValue
        break
      }
      case 'coil':
      case 'coil-set':
      case 'coil-reset':
        elementActive = state.outputs[el.address!] || state.memory[el.address!] || false
        // Coils are outputs, don't affect rung condition
        break
      case 'timer':
        elementActive = state.timers[el.address!]?.done || false
        // Timer command is an output, doesn't affect rung condition
        // (Timer done bit as contact [ T1.DN ] is handled in contact-no case)
        break
      case 'counter':
        elementActive = state.counters[el.address!]?.done || false
        // Counter command is an output, doesn't affect rung condition
        break

      // Comparison operators
      case 'compare-gt':
      case 'compare-lt':
      case 'compare-eq':
      case 'compare-ge':
      case 'compare-le':
      case 'compare-ne':
        if (el.operand1 && el.value !== undefined) {
          const op1Value = state.analogInputs[el.operand1] || state.analogOutputs[el.operand1] || state.memoryWords[el.operand1] || 0
          let compResult = false
          switch (el.type) {
            case 'compare-gt': compResult = op1Value > el.value; break
            case 'compare-lt': compResult = op1Value < el.value; break
            case 'compare-eq': compResult = op1Value === el.value; break
            case 'compare-ge': compResult = op1Value >= el.value; break
            case 'compare-le': compResult = op1Value <= el.value; break
            case 'compare-ne': compResult = op1Value !== el.value; break
          }
          elementActive = compResult
          rungCondition = rungCondition && compResult
        }
        break

      // Math operations
      case 'math-add':
      case 'math-sub':
      case 'math-mul':
      case 'math-div':
      case 'move':
        // Math operations are outputs, don't affect rung condition
        // elementActive shows if operation was executed (based on rungCondition)
        elementActive = rungCondition
        break
    }

    elementStates.push({
      element: el,
      elementActive,
      rungConditionBefore,
      rungConditionAfter: rungCondition
    })
  })

  // Separate elements into left (inputs/contacts) and right (outputs/timers/counters) groups
  const leftElements: typeof elementStates = []
  const rightElements: typeof elementStates = []

  elementStates.forEach((elState) => {
    const el = elState.element
    // Right side: coils, timers, counters, math operations
    if (el.type === 'coil' || el.type === 'coil-set' || el.type === 'coil-reset' ||
        el.type === 'timer' || el.type === 'counter' ||
        el.type === 'math-add' || el.type === 'math-sub' || el.type === 'math-mul' || el.type === 'math-div' || el.type === 'move') {
      rightElements.push(elState)
    } else {
      // Left side: all contacts and comparisons
      leftElements.push(elState)
    }
  })

  // Calculate viewBox dimensions
  const viewBoxWidth = POWER_RAIL_RIGHT_X + 10
  const rungHeight = 40

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${rungHeight}`}
      className="w-full"
      style={{ height: 'auto', minHeight: `${rungHeight}px` }}
      preserveAspectRatio="xMinYMid meet"
    >
      {/* Left Power Rail */}
      <line
        x1={POWER_RAIL_X}
        y1={0}
        x2={POWER_RAIL_X}
        y2={rungHeight}
        stroke="#4b5563"
        strokeWidth="3"
      />

      {/* Right Power Rail */}
      <line
        x1={POWER_RAIL_RIGHT_X}
        y1={0}
        x2={POWER_RAIL_RIGHT_X}
        y2={rungHeight}
        stroke="#4b5563"
        strokeWidth="3"
      />

      {/* Line from left rail to first element - always has power */}
      <line
        x1={POWER_RAIL_X}
        y1={RUNG_Y}
        x2={POWER_RAIL_X + 20}
        y2={RUNG_Y}
        stroke="#4ade80"
        strokeWidth="2"
      />

      {/* Left side elements (contacts) */}
      {leftElements.map((elementState, idx) => {
        const x = POWER_RAIL_X + 20 + idx * ELEMENT_SPACING
        const y = RUNG_Y
        const originalIdx = elementStates.indexOf(elementState)

        return (
          <g key={`left-${idx}`}>
            {renderElement(
              elementState.element,
              x,
              y,
              elementState.elementActive,
              elementState.rungConditionBefore,
              elementState.rungConditionAfter,
              () => {
                if (isEditMode && onElementClick) {
                  const fakeEvent = {
                    stopPropagation: () => {},
                    target: { getBoundingClientRect: () => ({ left: x, bottom: y + 40, top: y, right: x + 80 }) }
                  } as any
                  onElementClick(networkIdx, originalIdx, fakeEvent)
                } else if (onContactClick && elementState.element.address?.startsWith('I')) {
                  onContactClick(elementState.element.address)
                }
              },
              isEditMode || (elementState.element.address?.startsWith('I') ?? false),
              state
            )}

            {/* Line to next left element */}
            {idx < leftElements.length - 1 && (
              <line
                x1={x + ELEMENT_WIDTH}
                y1={y}
                x2={x + ELEMENT_SPACING}
                y2={y}
                stroke={elementState.rungConditionAfter ? '#4ade80' : '#4b5563'}
                strokeWidth="2"
              />
            )}
          </g>
        )
      })}

      {/* Connection line from left elements to right elements */}
      {leftElements.length > 0 && rightElements.length > 0 && (
        <line
          x1={POWER_RAIL_X + 20 + (leftElements.length - 1) * ELEMENT_SPACING + ELEMENT_WIDTH}
          y1={RUNG_Y}
          x2={POWER_RAIL_RIGHT_X - rightElements.length * ELEMENT_SPACING}
          y2={RUNG_Y}
          stroke={leftElements[leftElements.length - 1].rungConditionAfter ? '#4ade80' : '#4b5563'}
          strokeWidth="2"
        />
      )}

      {/* Right side elements (outputs, timers, counters) - positioned from right */}
      {rightElements.map((elementState, idx) => {
        const x = POWER_RAIL_RIGHT_X - (rightElements.length - idx) * ELEMENT_SPACING
        const y = RUNG_Y
        const originalIdx = elementStates.indexOf(elementState)

        return (
          <g key={`right-${idx}`}>
            {renderElement(
              elementState.element,
              x,
              y,
              elementState.elementActive,
              elementState.rungConditionBefore,
              elementState.rungConditionAfter,
              () => {
                if (isEditMode && onElementClick) {
                  const fakeEvent = {
                    stopPropagation: () => {},
                    target: { getBoundingClientRect: () => ({ left: x, bottom: y + 40, top: y, right: x + 80 }) }
                  } as any
                  onElementClick(networkIdx, originalIdx, fakeEvent)
                }
              },
              isEditMode,
              state
            )}

            {/* Line to next right element or right rail */}
            {idx === rightElements.length - 1 ? (
              <line
                x1={x + ELEMENT_WIDTH}
                y1={y}
                x2={POWER_RAIL_RIGHT_X}
                y2={y}
                stroke={elementState.rungConditionAfter ? '#4ade80' : '#4b5563'}
                strokeWidth="2"
              />
            ) : (
              <line
                x1={x + ELEMENT_WIDTH}
                y1={y}
                x2={x + ELEMENT_SPACING}
                y2={y}
                stroke={elementState.rungConditionAfter ? '#4ade80' : '#4b5563'}
                strokeWidth="2"
              />
            )}
          </g>
        )
      })}

      {/* Special case: only left elements, no right elements */}
      {leftElements.length > 0 && rightElements.length === 0 && (
        <line
          x1={POWER_RAIL_X + 20 + (leftElements.length - 1) * ELEMENT_SPACING + ELEMENT_WIDTH}
          y1={RUNG_Y}
          x2={POWER_RAIL_RIGHT_X}
          y2={RUNG_Y}
          stroke={leftElements[leftElements.length - 1].rungConditionAfter ? '#4ade80' : '#4b5563'}
          strokeWidth="2"
        />
      )}

      {/* Special case: only right elements, no left elements */}
      {leftElements.length === 0 && rightElements.length > 0 && (
        <line
          x1={POWER_RAIL_X + 20}
          y1={RUNG_Y}
          x2={POWER_RAIL_RIGHT_X - rightElements.length * ELEMENT_SPACING}
          y2={RUNG_Y}
          stroke="#4ade80"
          strokeWidth="2"
        />
      )}
    </svg>
  )
}

function renderElement(
  element: LadderElement,
  x: number,
  y: number,
  active: boolean,
  flowBefore: boolean,
  flowAfter: boolean,
  onClick: () => void,
  isClickable: boolean,
  state?: SimulatorState
): JSX.Element {
  // Determine base color by element type and address
  let baseColor = '#6b7280' // Default gray
  if (element.address) {
    if (element.address.startsWith('I')) {
      baseColor = '#60a5fa' // Blue for inputs
    } else if (element.address.startsWith('Q')) {
      baseColor = '#f87171' // Red for outputs
    } else if (element.address.startsWith('M')) {
      baseColor = '#fbbf24' // Yellow for memory
    } else if (element.address.startsWith('T') || element.address.startsWith('C')) {
      baseColor = '#a78bfa' // Purple for timers/counters
    }
  }

  // Override color when active or has flow
  const color = flowBefore && active ? '#4ade80' : flowBefore ? '#facc15' : baseColor
  const strokeWidth = flowBefore && active ? 2.5 : 2

  switch (element.type) {
    case 'contact-no':
      // Get contact status
      let contactStatus = 'OFF'
      if (element.address) {
        if (element.address.includes('.DN')) {
          // Extract timer/counter name: "[ T1.DN ]" or "T1.DN" -> "T1"
          const timerAddr = element.address.replace(/[\[\]\s]/g, '').split('.')[0]
          contactStatus = (state?.timers[timerAddr]?.done || state?.counters[timerAddr]?.done) ? 'ON' : 'OFF'
        } else {
          contactStatus = (state?.inputs[element.address] || state?.outputs[element.address] || state?.memory[element.address]) ? 'ON' : 'OFF'
        }
      }

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* NO Contact - two vertical lines */}
          <line x1={x} y1={y - 8} x2={x} y2={y + 8} stroke={color} strokeWidth={strokeWidth} />
          <line x1={x + ELEMENT_WIDTH} y1={y - 8} x2={x + ELEMENT_WIDTH} y2={y + 8} stroke={color} strokeWidth={strokeWidth} />

          {/* Status indicator (ON/OFF) */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 11}
            textAnchor="middle"
            fill={contactStatus === 'ON' ? '#4ade80' : '#6b7280'}
            fontSize="5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {contactStatus}
          </text>

          {/* Address label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 15}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="7"
            fontFamily="monospace"
          >
            {element.address}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 13}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )

    case 'contact-nc':
      // Get contact status for NC
      let ncContactStatus = 'OFF'
      if (element.address) {
        if (element.address.includes('.DN')) {
          // Extract timer/counter name: "[ T1.DN ]" or "/T1.DN" -> "T1"
          const timerAddr = element.address.replace(/[\[\]\/\s]/g, '').split('.')[0]
          const rawValue = state?.timers[timerAddr]?.done || state?.counters[timerAddr]?.done || false
          ncContactStatus = !rawValue ? 'ON' : 'OFF' // Inverted for NC
        } else {
          const rawValue = state?.inputs[element.address] || state?.outputs[element.address] || state?.memory[element.address] || false
          ncContactStatus = !rawValue ? 'ON' : 'OFF' // Inverted for NC
        }
      }

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* NC Contact - two vertical lines with diagonal */}
          <line x1={x} y1={y - 8} x2={x} y2={y + 8} stroke={color} strokeWidth={strokeWidth} />
          <line x1={x + ELEMENT_WIDTH} y1={y - 8} x2={x + ELEMENT_WIDTH} y2={y + 8} stroke={color} strokeWidth={strokeWidth} />
          <line x1={x + 6} y1={y - 8} x2={x + ELEMENT_WIDTH - 6} y2={y + 8} stroke={color} strokeWidth={strokeWidth} />

          {/* Status indicator (ON/OFF) */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 11}
            textAnchor="middle"
            fill={ncContactStatus === 'ON' ? '#4ade80' : '#6b7280'}
            fontSize="5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {ncContactStatus}
          </text>

          {/* Address label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 15}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="7"
            fontFamily="monospace"
          >
            {element.address}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 13}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )

    case 'coil':
      // Get coil status
      const coilStatus = (state?.outputs[element.address!] || state?.memory[element.address!]) ? 'ON' : 'OFF'

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* Coil - circle */}
          <circle
            cx={x + ELEMENT_WIDTH / 2}
            cy={y}
            r={8}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* Status indicator (ON/OFF) */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 11}
            textAnchor="middle"
            fill={coilStatus === 'ON' ? '#4ade80' : '#6b7280'}
            fontSize="5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {coilStatus}
          </text>

          {/* Address label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 15}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="7"
            fontFamily="monospace"
          >
            {element.address}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 13}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )

    case 'coil-set':
      const setCoilStatus = (state?.outputs[element.address!] || state?.memory[element.address!]) ? 'ON' : 'OFF'

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* SET Coil - circle with S */}
          <circle
            cx={x + ELEMENT_WIDTH / 2}
            cy={y}
            r={8}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* S label inside circle */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 2.5}
            textAnchor="middle"
            fill={color}
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
          >
            S
          </text>

          {/* Status indicator */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 11}
            textAnchor="middle"
            fill={setCoilStatus === 'ON' ? '#4ade80' : '#6b7280'}
            fontSize="5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {setCoilStatus}
          </text>

          {/* Address label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 15}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="7"
            fontFamily="monospace"
          >
            {element.address}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 13}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )

    case 'coil-reset':
      const resetCoilStatus = (state?.outputs[element.address!] || state?.memory[element.address!]) ? 'ON' : 'OFF'

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* RESET Coil - circle with R */}
          <circle
            cx={x + ELEMENT_WIDTH / 2}
            cy={y}
            r={8}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* R label inside circle */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 2.5}
            textAnchor="middle"
            fill={color}
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
          >
            R
          </text>

          {/* Status indicator */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 11}
            textAnchor="middle"
            fill={resetCoilStatus === 'ON' ? '#4ade80' : '#6b7280'}
            fontSize="5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {resetCoilStatus}
          </text>

          {/* Address label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 15}
            textAnchor="middle"
            fill="#9ca3af"
            fontSize="7"
            fontFamily="monospace"
          >
            {element.address}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 13}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )

    case 'timer':
      const timer = state?.timers[element.address!]
      const timerCurrentValue = timer ? (timer.elapsed / 1000).toFixed(1) : '0.0'
      const timerPresetValue = timer ? (timer.preset / 1000).toFixed(1) : ((element.preset || 0) / 1000).toFixed(1)

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* Timer - rectangle */}
          <rect
            x={x}
            y={y - 10}
            width={ELEMENT_WIDTH}
            height={20}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* Timer label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 2}
            textAnchor="middle"
            fill={color}
            fontSize="6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            TON
          </text>

          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 6}
            textAnchor="middle"
            fill={color}
            fontSize="5"
            fontFamily="monospace"
          >
            {element.address}
          </text>

          {/* Current/Preset value below */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 18}
            textAnchor="middle"
            fill={active ? '#4ade80' : '#9ca3af'}
            fontSize="5"
            fontFamily="monospace"
          >
            {timerCurrentValue}s/{timerPresetValue}s
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 12}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )

    case 'counter':
      const counter = state?.counters[element.address!]
      const counterCurrentValue = counter ? counter.count : 0
      const counterPresetValue = counter ? counter.preset : (element.preset || 0)

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* Counter - rectangle */}
          <rect
            x={x}
            y={y - 10}
            width={ELEMENT_WIDTH}
            height={20}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* Counter label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 2}
            textAnchor="middle"
            fill={color}
            fontSize="6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            CTU
          </text>

          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 6}
            textAnchor="middle"
            fill={color}
            fontSize="5"
            fontFamily="monospace"
          >
            {element.address}
          </text>

          {/* Current/Preset value below */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 18}
            textAnchor="middle"
            fill={active ? '#4ade80' : '#9ca3af'}
            fontSize="5"
            fontFamily="monospace"
          >
            {counterCurrentValue}/{counterPresetValue}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 12}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )

    // Comparison operators
    case 'compare-gt':
    case 'compare-lt':
    case 'compare-eq':
    case 'compare-ge':
    case 'compare-le':
    case 'compare-ne': {
      const op1Value = state?.analogInputs[element.operand1!] || state?.analogOutputs[element.operand1!] || state?.memoryWords[element.operand1!] || 0
      const compareValue = element.value || 0

      let operator = '?'
      switch (element.type) {
        case 'compare-gt': operator = '>'; break
        case 'compare-lt': operator = '<'; break
        case 'compare-eq': operator = '=='; break
        case 'compare-ge': operator = '>='; break
        case 'compare-le': operator = '<='; break
        case 'compare-ne': operator = '!='; break
      }

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* Comparison block - rectangle */}
          <rect
            x={x}
            y={y - 10}
            width={ELEMENT_WIDTH}
            height={20}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* Operator symbol */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 2}
            textAnchor="middle"
            fill={color}
            fontSize="6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {operator}
          </text>

          {/* Operand and value */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 6}
            textAnchor="middle"
            fill={color}
            fontSize="5"
            fontFamily="monospace"
          >
            {element.operand1}
          </text>

          {/* Current values below */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 18}
            textAnchor="middle"
            fill={active ? '#4ade80' : '#9ca3af'}
            fontSize="5"
            fontFamily="monospace"
          >
            {op1Value.toFixed(1)}{operator}{compareValue}
          </text>

          {/* Status indicator */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 12}
            textAnchor="middle"
            fill={active ? '#4ade80' : '#6b7280'}
            fontSize="5"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {active ? 'TRUE' : 'FALSE'}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 13}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )
    }

    // Math operations
    case 'math-add':
    case 'math-sub':
    case 'math-mul':
    case 'math-div': {
      let opSymbol = '?'
      switch (element.type) {
        case 'math-add': opSymbol = '+'; break
        case 'math-sub': opSymbol = '-'; break
        case 'math-mul': opSymbol = '*'; break
        case 'math-div': opSymbol = '/'; break
      }

      const op1 = element.operand1 || ''
      const op2 = element.operand2 || element.value?.toString() || '0'
      const result = element.result || ''

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* Math operation block - rectangle */}
          <rect
            x={x}
            y={y - 10}
            width={ELEMENT_WIDTH}
            height={20}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* Operation symbol */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 2}
            textAnchor="middle"
            fill={color}
            fontSize="7"
            fontFamily="monospace"
            fontWeight="bold"
          >
            {opSymbol}
          </text>

          {/* Operands */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 6}
            textAnchor="middle"
            fill={color}
            fontSize="5"
            fontFamily="monospace"
          >
            {op1},{op2}
          </text>

          {/* Result destination below */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 18}
            textAnchor="middle"
            fill={active ? '#4ade80' : '#9ca3af'}
            fontSize="5"
            fontFamily="monospace"
          >
            =&gt;{result}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 12}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )
    }

    case 'move': {
      const source = element.operand1 || element.value?.toString() || '0'
      const dest = element.result || ''

      return (
        <g onClick={onClick} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
          {/* MOVE block - rectangle */}
          <rect
            x={x}
            y={y - 10}
            width={ELEMENT_WIDTH}
            height={20}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
          />

          {/* MOVE label */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y - 2}
            textAnchor="middle"
            fill={color}
            fontSize="6"
            fontFamily="monospace"
            fontWeight="bold"
          >
            MOV
          </text>

          {/* Source */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 6}
            textAnchor="middle"
            fill={color}
            fontSize="5"
            fontFamily="monospace"
          >
            {source}
          </text>

          {/* Destination below */}
          <text
            x={x + ELEMENT_WIDTH / 2}
            y={y + 18}
            textAnchor="middle"
            fill={active ? '#4ade80' : '#9ca3af'}
            fontSize="5"
            fontFamily="monospace"
          >
            =&gt;{dest}
          </text>

          {/* Clickable overlay */}
          {isClickable && (
            <rect
              x={x - 5}
              y={y - 12}
              width={ELEMENT_WIDTH + 10}
              height={35}
              fill="transparent"
            />
          )}
        </g>
      )
    }

    default:
      return <g />
  }
}

// Render parallel branches (OR logic)
function renderParallelBranches(
  rung: LadderRung,
  networkIdx: number,
  state: SimulatorState,
  onContactClick?: (address: string) => void,
  onElementClick?: (networkIdx: number, elementIdx: number, event: React.MouseEvent) => void,
  isEditMode = false
): JSX.Element {
  const branches = rung.branches!
  const BRANCH_HEIGHT = 40
  const BRANCH_SPACING = 10
  const totalHeight = branches.length * BRANCH_HEIGHT + (branches.length - 1) * BRANCH_SPACING
  const viewBoxWidth = POWER_RAIL_RIGHT_X + 10

  // Calculate branch states
  const branchStates = branches.map(branch => {
    let branchCondition = true
    const elementStates: Array<{
      element: LadderElement
      elementActive: boolean
      rungConditionBefore: boolean
      rungConditionAfter: boolean
    }> = []

    branch.forEach(el => {
      const rungConditionBefore = branchCondition
      let elementActive = false

      switch (el.type) {
        case 'contact-no': {
          let contactValue = false
          if (el.address!.includes('.DN')) {
            const cleanAddr = el.address!.replace(/[\[\]\s]/g, '')
            const timerAddr = cleanAddr.split('.')[0]
            contactValue = state.timers[timerAddr]?.done || state.counters[timerAddr]?.done || false
          } else {
            contactValue = state.inputs[el.address!] || state.outputs[el.address!] || state.memory[el.address!] || false
          }
          elementActive = contactValue
          branchCondition = branchCondition && contactValue
          break
        }
        case 'contact-nc': {
          let contactValue = false
          if (el.address!.includes('.DN')) {
            const cleanAddr = el.address!.replace(/[\[\]\s]/g, '')
            const timerAddr = cleanAddr.split('.')[0].replace('/', '')
            contactValue = state.timers[timerAddr]?.done || state.counters[timerAddr]?.done || false
          } else {
            contactValue = state.inputs[el.address!] || state.outputs[el.address!] || state.memory[el.address!] || false
          }
          elementActive = !contactValue
          branchCondition = branchCondition && !contactValue
          break
        }
        case 'compare-gt':
        case 'compare-lt':
        case 'compare-eq':
        case 'compare-ge':
        case 'compare-le':
        case 'compare-ne':
          if (el.operand1 && el.value !== undefined) {
            const op1Value = state.analogInputs[el.operand1] || state.analogOutputs[el.operand1] || state.memoryWords[el.operand1] || 0
            let compResult = false
            switch (el.type) {
              case 'compare-gt': compResult = op1Value > el.value; break
              case 'compare-lt': compResult = op1Value < el.value; break
              case 'compare-eq': compResult = op1Value === el.value; break
              case 'compare-ge': compResult = op1Value >= el.value; break
              case 'compare-le': compResult = op1Value <= el.value; break
              case 'compare-ne': compResult = op1Value !== el.value; break
            }
            elementActive = compResult
            branchCondition = branchCondition && compResult
          }
          break
        default:
          elementActive = branchCondition
          break
      }

      elementStates.push({
        element: el,
        elementActive,
        rungConditionBefore,
        rungConditionAfter: branchCondition
      })
    })

    return { branchCondition, elementStates }
  })

  // Calculate OR result
  const orResult = branchStates.some(b => b.branchCondition)

  return (
    <svg
      viewBox={`0 0 ${viewBoxWidth} ${totalHeight}`}
      className="w-full"
      style={{ height: 'auto', minHeight: `${totalHeight}px` }}
      preserveAspectRatio="xMinYMid meet"
    >
      {/* Left Power Rail */}
      <line
        x1={POWER_RAIL_X}
        y1={0}
        x2={POWER_RAIL_X}
        y2={totalHeight}
        stroke="#4b5563"
        strokeWidth="3"
      />

      {/* Right Power Rail */}
      <line
        x1={POWER_RAIL_RIGHT_X}
        y1={0}
        x2={POWER_RAIL_RIGHT_X}
        y2={totalHeight}
        stroke="#4b5563"
        strokeWidth="3"
      />

      {/* Render each branch */}
      {branchStates.map((branchState, branchIdx) => {
        const branchY = branchIdx * (BRANCH_HEIGHT + BRANCH_SPACING) + RUNG_Y

        return (
          <g key={branchIdx}>
            {/* Branch line from left rail */}
            <line
              x1={POWER_RAIL_X}
              y1={branchY}
              x2={POWER_RAIL_X + 20}
              y2={branchY}
              stroke="#4ade80"
              strokeWidth="2"
            />

            {/* Render elements in this branch */}
            {branchState.elementStates.map((elState, elIdx) => {
              const x = POWER_RAIL_X + 20 + elIdx * ELEMENT_SPACING
              const y = branchY

              return (
                <g key={elIdx}>
                  {renderElement(
                    elState.element,
                    x,
                    y,
                    elState.elementActive,
                    elState.rungConditionBefore,
                    elState.rungConditionAfter,
                    () => {
                      if (isEditMode && onElementClick) {
                        const fakeEvent = {
                          stopPropagation: () => {},
                          target: { getBoundingClientRect: () => ({ left: x, bottom: y + 40, top: y, right: x + 80 }) }
                        } as any
                        onElementClick(networkIdx, elIdx, fakeEvent)
                      } else if (onContactClick && elState.element.address?.startsWith('I')) {
                        onContactClick(elState.element.address)
                      }
                    },
                    isEditMode || (elState.element.address?.startsWith('I') ?? false),
                    state
                  )}

                  {/* Line to next element or right rail */}
                  {elIdx < branchState.elementStates.length - 1 ? (
                    <line
                      x1={x + ELEMENT_WIDTH}
                      y1={y}
                      x2={x + ELEMENT_SPACING}
                      y2={y}
                      stroke={elState.rungConditionAfter ? '#4ade80' : '#4b5563'}
                      strokeWidth="2"
                    />
                  ) : (
                    <line
                      x1={x + ELEMENT_WIDTH}
                      y1={y}
                      x2={POWER_RAIL_RIGHT_X}
                      y2={y}
                      stroke={elState.rungConditionAfter ? '#4ade80' : '#4b5563'}
                      strokeWidth="2"
                    />
                  )}
                </g>
              )
            })}
          </g>
        )
      })}

      {/* OR indicator */}
      <text
        x={POWER_RAIL_RIGHT_X + 15}
        y={totalHeight / 2}
        textAnchor="start"
        fill={orResult ? '#4ade80' : '#6b7280'}
        fontSize="10"
        fontFamily="monospace"
        fontWeight="bold"
      >
        OR={orResult ? 'T' : 'F'}
      </text>
    </svg>
  )
}
