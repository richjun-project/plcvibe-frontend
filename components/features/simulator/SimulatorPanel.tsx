"use client"

import { useState, useEffect } from "react"
import { Play, Pause, RotateCcw, Activity, Clock, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PLCSimulator, type SimulatorState } from "@/lib/simulator/engine"
import type { LadderProgram } from "@/lib/ladder/parser"
import { cn } from "@/lib/utils/cn"

interface SimulatorPanelProps {
  program: LadderProgram
  onStateChange?: (state: Record<string, boolean>) => void
}

export function SimulatorPanel({ program, onStateChange }: SimulatorPanelProps) {
  const [simulator] = useState(() => new PLCSimulator(program))
  const [state, setState] = useState<SimulatorState>(simulator.getState())
  const [isRunning, setIsRunning] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      if (simulator.getState().isRunning) {
        const newState = simulator.getState()
        setState(newState)

        // Build active states for ladder visualization
        if (onStateChange) {
          const activeStates: Record<string, boolean> = {
            ...newState.inputs,
            ...newState.outputs,
            ...newState.memory
          }
          // Add timer done states
          Object.entries(newState.timers).forEach(([addr, timer]) => {
            activeStates[addr] = timer.done
          })
          onStateChange(activeStates)
        }
      }
    }, 50) // Update UI every 50ms

    return () => clearInterval(interval)
  }, [simulator, onStateChange])

  const handleStart = () => {
    simulator.start()
    setIsRunning(true)
  }

  const handleStop = () => {
    simulator.stop()
    setIsRunning(false)
    // Clear visualization
    if (onStateChange) {
      onStateChange({})
    }
  }

  const handleReset = () => {
    simulator.reset()
    setIsRunning(false)
    setState(simulator.getState())
    // Clear visualization
    if (onStateChange) {
      onStateChange({})
    }
  }

  const handleInputToggle = (address: string) => {
    const currentValue = state.inputs[address] || false
    simulator.setInput(address, !currentValue)
    setState(simulator.getState())
  }

  const inputs = Object.entries(state.inputs)
  const outputs = Object.entries(state.outputs)
  const memory = Object.entries(state.memory)
  const timers = Object.entries(state.timers)

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Activity className={cn(
              "w-5 h-5",
              isRunning ? "text-green-400 animate-pulse" : "text-gray-500"
            )} />
            <h3 className="text-sm font-semibold text-gray-200">
              PLC Simulator
            </h3>
            <Badge variant={isRunning ? "default" : "secondary"} className="text-xs">
              {isRunning ? "RUNNING" : "STOPPED"}
            </Badge>
          </div>

          <div className="flex items-center gap-2">
            {!isRunning ? (
              <Button onClick={handleStart} size="sm" variant="default">
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            ) : (
              <Button onClick={handleStop} size="sm" variant="destructive">
                <Pause className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}
            <Button onClick={handleReset} size="sm" variant="outline">
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 text-xs">
          <div className="bg-gray-900/50 rounded p-2">
            <div className="flex items-center gap-1 text-gray-400 mb-1">
              <Clock className="w-3 h-3" />
              <span>Scan Time</span>
            </div>
            <div className="text-lg font-mono text-blue-400">
              {state.scanTime.toFixed(2)}ms
            </div>
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="flex items-center gap-1 text-gray-400 mb-1">
              <Zap className="w-3 h-3" />
              <span>Cycles</span>
            </div>
            <div className="text-lg font-mono text-green-400">
              {state.cycleCount}
            </div>
          </div>
          <div className="bg-gray-900/50 rounded p-2">
            <div className="flex items-center gap-1 text-gray-400 mb-1">
              <Activity className="w-3 h-3" />
              <span>Frequency</span>
            </div>
            <div className="text-lg font-mono text-purple-400">
              {state.scanTime > 0 ? (1000 / state.scanTime).toFixed(0) : '0'}Hz
            </div>
          </div>
        </div>
      </div>

      {/* I/O Panel */}
      <div className="grid grid-cols-2 gap-4">
        {/* Inputs */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Digital Inputs</h4>
          <div className="space-y-2">
            {inputs.length > 0 ? (
              inputs.map(([address, value]) => (
                <div
                  key={address}
                  className="flex items-center justify-between p-2 bg-gray-900/50 rounded hover:bg-gray-900/70 transition-colors cursor-pointer"
                  onClick={() => handleInputToggle(address)}
                >
                  <span className="text-xs font-mono text-gray-300">{address}</span>
                  <div className={cn(
                    "w-8 h-4 rounded-full transition-colors",
                    value ? "bg-green-500" : "bg-gray-600"
                  )}>
                    <div className={cn(
                      "w-4 h-4 rounded-full bg-white transition-transform",
                      value ? "translate-x-4" : "translate-x-0"
                    )} />
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">No inputs defined</p>
            )}
          </div>
        </div>

        {/* Outputs */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Digital Outputs</h4>
          <div className="space-y-2">
            {outputs.length > 0 ? (
              outputs.map(([address, value]) => (
                <div
                  key={address}
                  className="flex items-center justify-between p-2 bg-gray-900/50 rounded"
                >
                  <span className="text-xs font-mono text-gray-300">{address}</span>
                  <div className={cn(
                    "w-6 h-6 rounded-full border-2 transition-all",
                    value
                      ? "bg-red-500 border-red-400 shadow-lg shadow-red-500/50"
                      : "bg-gray-700 border-gray-600"
                  )} />
                </div>
              ))
            ) : (
              <p className="text-xs text-gray-500">No outputs defined</p>
            )}
          </div>
        </div>
      </div>

      {/* Timers */}
      {timers.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Timers</h4>
          <div className="space-y-2">
            {timers.map(([address, timer]) => (
              <div key={address} className="p-2 bg-gray-900/50 rounded">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-mono text-gray-300">{address}</span>
                  <Badge
                    variant={timer.done ? "default" : "secondary"}
                    className="text-xs"
                  >
                    {timer.done ? "DONE" : "TIMING"}
                  </Badge>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <div className="flex-1">
                    <div className="w-full bg-gray-700 rounded-full h-1.5">
                      <div
                        className="bg-blue-500 h-1.5 rounded-full transition-all"
                        style={{ width: `${(timer.elapsed / timer.preset) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="font-mono">
                    {timer.elapsed.toFixed(0)}/{timer.preset}ms
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Memory */}
      {memory.length > 0 && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Internal Memory</h4>
          <div className="grid grid-cols-4 gap-2">
            {memory.map(([address, value]) => (
              <div
                key={address}
                className={cn(
                  "p-2 rounded text-center transition-colors",
                  value ? "bg-purple-600/30 border border-purple-500" : "bg-gray-900/50"
                )}
              >
                <span className="text-xs font-mono text-gray-300">{address}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}