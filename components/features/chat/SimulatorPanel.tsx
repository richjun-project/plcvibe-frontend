"use client"

import { useState, useEffect } from 'react'
import { Play, Pause, RotateCcw, Power } from 'lucide-react'
import { parseLadderText } from '@/lib/ladder/parser'
import { PLCSimulator } from '@/lib/simulator/engine'
import type { SimulatorState } from '@/lib/simulator/engine'

export interface SimulatorPanelProps {
  code: string
}

export function SimulatorPanel({ code }: SimulatorPanelProps) {
  const [simulator, setSimulator] = useState<PLCSimulator | null>(null)
  const [isRunning, setIsRunning] = useState(false)
  const [simulatorState, setSimulatorState] = useState<SimulatorState | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Initialize simulator when code changes
  useEffect(() => {
    if (!code || code.trim().length === 0) {
      setSimulator(null)
      setError('No code to simulate')
      return
    }

    try {
      const program = parseLadderText(code)
      const sim = new PLCSimulator(program)
      setSimulator(sim)
      setSimulatorState(sim.getState())
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse code')
      setSimulator(null)
    }
  }, [code])

  // Update state periodically when running
  useEffect(() => {
    if (!simulator || !isRunning) return

    const interval = setInterval(() => {
      setSimulatorState(simulator.getState())
    }, 50) // Update UI every 50ms

    return () => clearInterval(interval)
  }, [simulator, isRunning])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (simulator) {
        simulator.stop()
      }
    }
  }, [simulator])

  const handleStart = () => {
    if (simulator) {
      simulator.start()
      setIsRunning(true)
    }
  }

  const handleStop = () => {
    if (simulator) {
      simulator.stop()
      setIsRunning(false)
    }
  }

  const handleReset = () => {
    if (simulator) {
      simulator.reset()
      setSimulatorState(simulator.getState())
      setIsRunning(false)
    }
  }

  const toggleInput = (address: string) => {
    if (simulator && simulatorState) {
      const currentValue = simulatorState.inputs[address] || false
      simulator.setInput(address, !currentValue)
      setSimulatorState(simulator.getState())
    }
  }

  if (!code || code.trim().length === 0) {
    return null
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-950/20 p-4">
        <p className="text-sm text-red-400">Failed to initialize simulator: {error}</p>
      </div>
    )
  }

  if (!simulator || !simulatorState) {
    return (
      <div className="rounded-lg border border-gray-500/30 bg-gray-900 p-4">
        <p className="text-sm text-gray-400">Initializing simulator...</p>
      </div>
    )
  }

  const inputs = Object.keys(simulatorState.inputs).sort()
  const outputs = Object.keys(simulatorState.outputs).sort()
  const timers = Object.keys(simulatorState.timers).sort()
  const counters = Object.keys(simulatorState.counters).sort()

  return (
    <div className="rounded-lg border border-green-500/30 bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-lg">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-700 pb-2">
        <div className="flex items-center gap-2">
          <Power className="h-5 w-5 text-green-400" />
          <span className="font-semibold text-green-300">PLC Simulator</span>
        </div>
        <div className="flex gap-2">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="flex items-center gap-1 rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              Start
            </button>
          ) : (
            <button
              onClick={handleStop}
              className="flex items-center gap-1 rounded bg-yellow-600 px-3 py-1 text-sm text-white hover:bg-yellow-700 transition-colors"
            >
              <Pause className="h-4 w-4" />
              Stop
            </button>
          )}
          <button
            onClick={handleReset}
            className="flex items-center gap-1 rounded bg-gray-600 px-3 py-1 text-sm text-white hover:bg-gray-700 transition-colors"
          >
            <RotateCcw className="h-4 w-4" />
            Reset
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="mb-3 flex gap-4 text-xs text-gray-400">
        <span>Cycle: {simulatorState.cycleCount}</span>
        <span>Scan Time: {simulatorState.scanTime.toFixed(2)}ms</span>
        <span className={isRunning ? 'text-green-400' : 'text-gray-500'}>
          {isRunning ? '● RUNNING' : '○ STOPPED'}
        </span>
      </div>

      {/* I/O Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Inputs */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-blue-300">Inputs</h4>
          <div className="space-y-1">
            {inputs.length === 0 ? (
              <div className="text-xs text-gray-500">No inputs defined</div>
            ) : (
              inputs.map(address => (
                <button
                  key={address}
                  onClick={() => toggleInput(address)}
                  className={`w-full rounded px-3 py-2 text-left text-sm font-mono transition-colors ${
                    simulatorState.inputs[address]
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  {address}: {simulatorState.inputs[address] ? 'ON' : 'OFF'}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Outputs */}
        <div>
          <h4 className="mb-2 text-sm font-semibold text-yellow-300">Outputs</h4>
          <div className="space-y-1">
            {outputs.length === 0 ? (
              <div className="text-xs text-gray-500">No outputs defined</div>
            ) : (
              outputs.map(address => (
                <div
                  key={address}
                  className={`rounded px-3 py-2 text-sm font-mono transition-colors ${
                    simulatorState.outputs[address]
                      ? 'bg-yellow-600 text-white'
                      : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {address}: {simulatorState.outputs[address] ? 'ON' : 'OFF'}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Timers */}
      {timers.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-purple-300">Timers</h4>
          <div className="space-y-1">
            {timers.map(address => {
              const timer = simulatorState.timers[address]
              const progress = (timer.elapsed / timer.preset) * 100
              return (
                <div key={address} className="rounded bg-gray-700 p-2">
                  <div className="flex justify-between text-xs font-mono text-gray-300">
                    <span>{address}</span>
                    <span>
                      {timer.elapsed.toFixed(0)}ms / {timer.preset}ms
                      {timer.done ? ' ✓' : ''}
                    </span>
                  </div>
                  <div className="mt-1 h-1 w-full rounded bg-gray-600">
                    <div
                      className={`h-1 rounded transition-all ${
                        timer.done ? 'bg-green-500' : 'bg-purple-500'
                      }`}
                      style={{ width: `${Math.min(progress, 100)}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Counters */}
      {counters.length > 0 && (
        <div className="mt-4">
          <h4 className="mb-2 text-sm font-semibold text-cyan-300">Counters</h4>
          <div className="space-y-1">
            {counters.map(address => {
              const counter = simulatorState.counters[address]
              return (
                <div
                  key={address}
                  className={`rounded px-3 py-2 text-sm font-mono ${
                    counter.done ? 'bg-cyan-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  {address}: {counter.count} / {counter.preset}
                  {counter.done ? ' ✓' : ''}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
