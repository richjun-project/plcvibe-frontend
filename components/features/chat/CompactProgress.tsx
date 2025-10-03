"use client"

import { Loader2, CheckCircle2 } from 'lucide-react'

export interface CompactProgressProps {
  currentStep: number
  totalSteps: number
  stepName: string
  iteration: number
  isComplete: boolean
}

export function CompactProgress({
  currentStep,
  totalSteps,
  stepName,
  iteration,
  isComplete
}: CompactProgressProps) {
  const progress = totalSteps > 0 ? (currentStep / totalSteps) * 100 : 0

  return (
    <div className="rounded-lg border border-gray-700 bg-gray-900/50 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {isComplete ? (
            <CheckCircle2 className="h-4 w-4 text-green-400" />
          ) : (
            <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
          )}
          <span className="text-sm font-medium text-gray-200">{stepName}</span>
        </div>
        <div className="flex items-center gap-3 text-xs text-gray-500">
          <span>Step {currentStep}/{totalSteps}</span>
          <span>Iteration {iteration}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 w-full rounded-full bg-gray-800 overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            isComplete ? 'bg-green-500' : 'bg-blue-500'
          }`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  )
}
