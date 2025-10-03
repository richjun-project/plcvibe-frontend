"use client"

import { useState, useEffect } from 'react'
import { RotateCcw, CheckCircle2, XCircle, Edit3, X, Plus } from 'lucide-react'
import { parseLadderText, type LadderProgram, type LadderElement } from '@/lib/ladder/parser'
import { serializeLadderProgram } from '@/lib/ladder/serializer'
import { PLCSimulator } from '@/lib/simulator/engine'
import type { SimulatorState } from '@/lib/simulator/engine'
import { GraphicalLadderRung } from './GraphicalLadderRung'

export interface LadderViewProps {
  code: string
  validationSuccess?: boolean
  errorCount?: number
  onCodeChange?: (code: string) => void
}

type ElementType = 'contact-no' | 'contact-nc' | 'coil' | 'coil-set' | 'coil-reset' | 'timer' | 'counter'

export function LadderView({
  code,
  validationSuccess = true,
  errorCount = 0,
  onCodeChange
}: LadderViewProps) {
  const [program, setProgram] = useState<LadderProgram | null>(null)
  const [simulator, setSimulator] = useState<PLCSimulator | null>(null)
  const [simulatorState, setSimulatorState] = useState<SimulatorState | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Edit mode
  const [isEditMode, setIsEditMode] = useState(false)
  const [selectedNetwork, setSelectedNetwork] = useState<number | null>(null)

  // Initialize simulator
  useEffect(() => {
    console.log('[LadderView] Code changed, length:', code?.length)
    if (!code || code.trim().length === 0) {
      setSimulator(null)
      setProgram(null)
      return
    }

    try {
      const parsedProgram = parseLadderText(code)
      console.log('[LadderView] Parsed program:', parsedProgram.networks.length, 'networks')
      setProgram(parsedProgram)

      const sim = new PLCSimulator(parsedProgram)
      sim.start()
      setSimulator(sim)
      setSimulatorState(sim.getState())
      setError(null)
    } catch (err) {
      console.error('[LadderView] Parse error:', err)
      setError(err instanceof Error ? err.message : 'Parse error')
      setSimulator(null)
      setProgram(null)
    }
  }, [code])

  // Update state continuously
  useEffect(() => {
    if (!simulator || isEditMode) return

    const interval = setInterval(() => {
      setSimulatorState(simulator.getState())
    }, 50)

    return () => clearInterval(interval)
  }, [simulator, isEditMode])

  // Cleanup
  useEffect(() => {
    return () => {
      simulator?.stop()
    }
  }, [simulator])

  const handleReset = () => {
    if (simulator) {
      simulator.reset()
      // Force update immediately
      const newState = simulator.getState()
      setSimulatorState(newState)
      console.log('[LadderView] Simulator reset')
    }
  }

  const toggleContact = (address: string) => {
    if (simulator && simulatorState) {
      const currentValue = simulatorState.inputs[address] || false
      simulator.setInput(address, !currentValue)
      setSimulatorState(simulator.getState())
    }
  }

  const handleAddElement = (networkIdx: number, elementType: ElementType) => {
    if (!program) return

    try {
      // Get all existing addresses to avoid duplicates
      const existingAddresses = new Set<string>()
      program.networks.forEach(net => {
        net.elements.forEach(el => {
          if (el.address) existingAddresses.add(el.address)
        })
      })

      // Generate appropriate address based on element type
      let address: string
      let index = 0

      if (elementType === 'contact-no' || elementType === 'contact-nc') {
        // Contacts use Input addresses (I0.x)
        while (existingAddresses.has(`I0.${index}`)) index++
        address = `I0.${index}`
      } else if (elementType.startsWith('coil')) {
        // Coils use Output addresses (Q0.x)
        while (existingAddresses.has(`Q0.${index}`)) index++
        address = `Q0.${index}`
      } else if (elementType === 'timer') {
        // Timers use T1, T2, etc.
        index = 1
        while (existingAddresses.has(`T${index}`)) index++
        address = `T${index}`
      } else if (elementType === 'counter') {
        // Counters use C1, C2, etc.
        index = 1
        while (existingAddresses.has(`C${index}`)) index++
        address = `C${index}`
      } else {
        // Memory bits use M0.x
        while (existingAddresses.has(`M0.${index}`)) index++
        address = `M0.${index}`
      }

      // Deep clone and add element
      const newProgram: LadderProgram = {
        networks: program.networks.map((net, idx) => {
          if (idx !== networkIdx) return net

          const newElement: LadderElement = {
            type: elementType,
            address,
            preset: elementType === 'timer' ? 1000 : elementType === 'counter' ? 10 : undefined
          }

          return {
            ...net,
            elements: [...net.elements, newElement]
          }
        }),
        ioMap: [...program.ioMap]
      }

      // Add I/O mapping if address is not already mapped
      const existingMappings = new Set(newProgram.ioMap.map(io => io.address))
      if (!existingMappings.has(address)) {
        const ioType = address.startsWith('I') ? 'DI' :
                       address.startsWith('Q') ? 'DO' : 'M'
        const name = elementType === 'contact-no' ? `Input ${address}` :
                     elementType === 'contact-nc' ? `Input ${address}` :
                     elementType === 'coil' ? `Output ${address}` :
                     elementType === 'coil-set' ? `Set ${address}` :
                     elementType === 'coil-reset' ? `Reset ${address}` :
                     elementType === 'timer' ? `Timer ${address}` :
                     elementType === 'counter' ? `Counter ${address}` :
                     `Memory ${address}`

        newProgram.ioMap.push({
          address,
          name,
          type: ioType,
          description: `Added via Edit mode`
        })
      }

      const newCode = serializeLadderProgram(newProgram)
      console.log('[LadderView] New code generated:', newCode.length, 'chars')
      console.log('[LadderView] Added element:', elementType, 'at', address)
      onCodeChange?.(newCode)
    } catch (err) {
      console.error('[LadderView] Failed to add element:', err)
    }
  }

  const handleEditToggle = () => {
    if (isEditMode) {
      // Exit edit mode
      setIsEditMode(false)
      setSelectedNetwork(null)
    } else {
      // Enter edit mode
      setIsEditMode(true)
    }
  }

  // Debug info for production troubleshooting
  const debugInfo = {
    hasCode: !!code,
    codeLength: code?.length || 0,
    codePreview: code?.substring(0, 100) || '',
    hasProgram: !!program,
    hasSimulator: !!simulator,
    hasSimulatorState: !!simulatorState,
    networkCount: program?.networks?.length || 0,
    error: error || null
  }

  if (!code || code.trim().length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-600 bg-gray-900/30 p-8 text-center">
        <p className="text-sm text-gray-500">No code generated yet</p>
        <details className="mt-4 text-left">
          <summary className="text-xs text-gray-600 cursor-pointer hover:text-gray-500">Debug Info</summary>
          <pre className="mt-2 text-xs text-gray-600 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
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
        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">Debug Info</summary>
          <pre className="mt-2 text-xs text-gray-500 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
      </div>
    )
  }

  if (!program || !simulator || !simulatorState) {
    return (
      <div className="rounded-lg border border-yellow-500/30 bg-yellow-950/10 p-4">
        <p className="text-sm text-yellow-400">Loading ladder diagram...</p>
        <details className="mt-4">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-400">Debug Info (Click to expand)</summary>
          <pre className="mt-2 text-xs text-gray-500 overflow-auto">{JSON.stringify(debugInfo, null, 2)}</pre>
        </details>
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
              {program.networks.length} Networks
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
          {isEditMode && (
            <div className="px-2 py-1 bg-blue-600 rounded text-xs text-white font-medium">
              Edit Mode
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex gap-2">
          <button
            onClick={handleEditToggle}
            className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
              isEditMode
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-blue-600 text-white hover:bg-blue-500'
            }`}
          >
            {isEditMode ? (
              <>
                <X className="h-3.5 w-3.5" />
                Exit Edit
              </>
            ) : (
              <>
                <Edit3 className="h-3.5 w-3.5" />
                Edit
              </>
            )}
          </button>
          {!isEditMode && (
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-gray-200 hover:bg-gray-600 transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* Edit Toolbox */}
      {isEditMode && (
        <div className="border-b border-gray-700 bg-gray-800/50 px-4 py-3">
          <div className="text-xs text-gray-400 mb-2">
            {selectedNetwork !== null ? `Add Element to Network ${selectedNetwork + 1}:` : 'Select a network to add elements'}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => selectedNetwork !== null && handleAddElement(selectedNetwork, 'contact-no')}
              disabled={selectedNetwork === null}
              className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              NO Contact --[ ]--
            </button>
            <button
              onClick={() => selectedNetwork !== null && handleAddElement(selectedNetwork, 'contact-nc')}
              disabled={selectedNetwork === null}
              className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              NC Contact --[/]--
            </button>
            <button
              onClick={() => selectedNetwork !== null && handleAddElement(selectedNetwork, 'coil')}
              disabled={selectedNetwork === null}
              className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Coil --( )--
            </button>
            <button
              onClick={() => selectedNetwork !== null && handleAddElement(selectedNetwork, 'coil-set')}
              disabled={selectedNetwork === null}
              className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Set --(S)--
            </button>
            <button
              onClick={() => selectedNetwork !== null && handleAddElement(selectedNetwork, 'coil-reset')}
              disabled={selectedNetwork === null}
              className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Reset --(R)--
            </button>
            <button
              onClick={() => selectedNetwork !== null && handleAddElement(selectedNetwork, 'timer')}
              disabled={selectedNetwork === null}
              className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Timer [TON]
            </button>
            <button
              onClick={() => selectedNetwork !== null && handleAddElement(selectedNetwork, 'counter')}
              disabled={selectedNetwork === null}
              className="px-3 py-1.5 text-xs rounded bg-gray-700 hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed text-gray-200 flex items-center gap-1"
            >
              <Plus className="h-3 w-3" />
              Counter [CTU]
            </button>
          </div>
        </div>
      )}

      {/* Ladder Rungs */}
      <div className="p-4 space-y-6 overflow-y-auto max-h-[calc(100vh-300px)]">
        {program.networks.map((rung, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-4 transition-colors ${
              isEditMode
                ? selectedNetwork === idx
                  ? 'border-blue-500 bg-blue-900/20 cursor-pointer'
                  : 'border-gray-700 bg-gray-900/50 hover:border-gray-600 cursor-pointer'
                : 'border-gray-700 bg-gray-900/50'
            }`}
            onClick={() => isEditMode && setSelectedNetwork(idx)}
          >
            <div className="mb-2 flex items-center justify-between">
              <div className="text-sm text-gray-400">
                Network {idx + 1}
                {rung.label && <span className="ml-2 text-gray-500">- {rung.label}</span>}
                {isEditMode && selectedNetwork === idx && (
                  <span className="ml-2 text-blue-400 text-xs font-medium">Selected</span>
                )}
              </div>
            </div>
            <GraphicalLadderRung
              rung={rung}
              networkIdx={idx}
              state={simulatorState}
              onContactClick={!isEditMode ? toggleContact : undefined}
              isEditMode={isEditMode}
            />
            {rung.comment && (
              <div className="mt-2 text-xs text-gray-500 italic">
                // {rung.comment}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
