"use client"

import { useEffect, useState } from "react"
import { CheckCircle2, Circle, Loader2, AlertCircle, Zap } from "lucide-react"

export interface AgentStep {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  description?: string
  timestamp?: number
}

interface AgentProgressProps {
  steps: AgentStep[]
  currentIteration: number
  maxIterations: number
  currentLog?: string
  isComplete: boolean
}

export function AgentProgress({
  steps,
  currentIteration,
  maxIterations,
  currentLog,
  isComplete
}: AgentProgressProps) {
  const [dots, setDots] = useState('')

  // Animated dots for loading
  useEffect(() => {
    if (isComplete) return

    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    return () => clearInterval(interval)
  }, [isComplete])

  const completedSteps = steps.filter(s => s.status === 'completed').length
  const progress = (completedSteps / steps.length) * 100

  return (
    <div className="relative bg-gradient-to-br from-gray-900 to-gray-800 border-2 border-blue-600/50 rounded-xl p-6 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
              {isComplete ? (
                <CheckCircle2 className="w-6 h-6 text-white" />
              ) : (
                <Loader2 className="w-6 h-6 text-white animate-spin" />
              )}
            </div>
            {!isComplete && (
              <div className="absolute inset-0 bg-blue-600 rounded-full animate-ping opacity-25" />
            )}
          </div>
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-400" />
              Advanced Agent
              {!isComplete && <span className="text-blue-400">{dots}</span>}
            </h3>
            <p className="text-sm text-gray-400">
              {isComplete ? '완료되었습니다' : '작업 진행 중'}
            </p>
          </div>
        </div>

        {/* Iteration Counter */}
        <div className="bg-gray-800/80 px-4 py-2 rounded-lg border border-gray-700">
          <div className="text-xs text-gray-400">Iteration</div>
          <div className="text-2xl font-bold text-white">
            {currentIteration} <span className="text-gray-500">/ {maxIterations}</span>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">전체 진행률</span>
          <span className="text-blue-400 font-semibold">{Math.round(progress)}%</span>
        </div>
        <div className="h-3 bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-600 to-blue-400 transition-all duration-500 ease-out relative"
            style={{ width: `${progress}%` }}
          >
            {!isComplete && (
              <div className="absolute inset-0 bg-white/30 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="space-y-3 mb-4">
        {steps.map((step, index) => (
          <div
            key={step.id}
            className={`flex items-start gap-3 p-3 rounded-lg transition-all ${
              step.status === 'in_progress'
                ? 'bg-blue-900/30 border border-blue-600/50'
                : step.status === 'completed'
                ? 'bg-green-900/20 border border-green-600/30'
                : step.status === 'failed'
                ? 'bg-red-900/20 border border-red-600/30'
                : 'bg-gray-800/50 border border-gray-700/50'
            }`}
          >
            {/* Step Icon */}
            <div className="mt-0.5">
              {step.status === 'completed' ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : step.status === 'in_progress' ? (
                <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
              ) : step.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : (
                <Circle className="w-5 h-5 text-gray-600" />
              )}
            </div>

            {/* Step Content */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className={`text-sm font-medium ${
                  step.status === 'completed' ? 'text-green-300' :
                  step.status === 'in_progress' ? 'text-blue-300' :
                  step.status === 'failed' ? 'text-red-300' :
                  'text-gray-400'
                }`}>
                  {step.title}
                </span>
                {step.status === 'in_progress' && (
                  <span className="text-xs text-blue-400 animate-pulse">진행 중</span>
                )}
              </div>
              {step.description && (
                <p className="text-xs text-gray-500">{step.description}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Current Log */}
      {currentLog && !isComplete && (
        <div className="bg-black/40 border border-gray-700 rounded-lg p-3">
          <div className="text-xs text-gray-400 mb-1">현재 작업:</div>
          <div className="text-sm text-gray-300 font-mono flex items-center gap-2">
            <Loader2 className="w-3 h-3 animate-spin text-blue-400" />
            {currentLog}
          </div>
        </div>
      )}

      {/* Success Message */}
      {isComplete && (
        <div className="bg-green-900/20 border border-green-600/50 rounded-lg p-4 flex items-center gap-3">
          <CheckCircle2 className="w-6 h-6 text-green-400 flex-shrink-0" />
          <div>
            <div className="text-sm font-semibold text-green-300">
              작업이 성공적으로 완료되었습니다!
            </div>
            <div className="text-xs text-gray-400">
              {completedSteps}/{steps.length} 단계 완료 · {currentIteration}회 반복
            </div>
          </div>
        </div>
      )}
    </div>
  )
}