"use client"

import { CheckCircle2, Clock, Beaker, XCircle, PlayCircle } from "lucide-react"

export interface ValidationReport {
  results: Array<{
    scenario: {
      id: string
      name: string
      description: string
      expectedOutcome: string
      category: string
    }
    passed: boolean
    steps: Array<{
      step: {
        description: string
      }
      passed: boolean
      actualValue?: any
      expectedValue?: any
      error?: string
    }>
    timeline: Array<{
      timestamp: number
      type: string
      address?: string
      value?: any
      description: string
      passed?: boolean
    }>
    duration: number
  }>
  overallPassed: boolean
  totalScenarios: number
  passedScenarios: number
  failedScenarios: number
  totalDuration: number
}

export interface TestResultsProps {
  validationReport: ValidationReport
}

export function TestResults({ validationReport }: TestResultsProps) {
  if (!validationReport || !validationReport.results) {
    return null
  }

  const { results, overallPassed, passedScenarios, totalScenarios } = validationReport

  return (
    <div className="rounded-lg border border-purple-500/30 bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-lg">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-700 pb-2">
        <div className="flex items-center gap-2">
          <Beaker className="h-5 w-5 text-purple-400" />
          <span className="font-semibold text-purple-300">
            Simulation Tests
          </span>
        </div>
        <div className="flex items-center gap-2">
          {overallPassed ? (
            <span className="rounded bg-green-900/30 px-3 py-1 text-sm text-green-400">
              ✅ {passedScenarios}/{totalScenarios} Passed
            </span>
          ) : (
            <span className="rounded bg-red-900/30 px-3 py-1 text-sm text-red-400">
              ❌ {passedScenarios}/{totalScenarios} Passed
            </span>
          )}
        </div>
      </div>

      {/* Test Results */}
      <div className="space-y-3">
        {results.slice(0, 5).map((result, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-3 ${
              result.passed
                ? 'border-green-500/30 bg-green-950/10'
                : 'border-red-500/30 bg-red-950/10'
            }`}
          >
            {/* Test Header */}
            <div className="mb-2 flex items-start justify-between">
              <div className="flex items-start gap-2">
                {result.passed ? (
                  <CheckCircle2 className="h-5 w-5 flex-shrink-0 text-green-400" />
                ) : (
                  <XCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
                )}
                <div>
                  <div className="font-semibold text-gray-200">
                    {result.scenario.name}
                  </div>
                  <div className="text-sm text-gray-400">
                    {result.scenario.description}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <Clock className="h-3 w-3" />
                <span>{result.duration.toFixed(0)}ms</span>
              </div>
            </div>

            {/* Failed Steps */}
            {!result.passed && (
              <div className="mt-2 space-y-1 rounded bg-gray-900/50 p-2">
                {result.steps
                  .filter(s => !s.passed)
                  .slice(0, 3)
                  .map((step, stepIdx) => (
                    <div key={stepIdx} className="flex items-start gap-2 text-sm">
                      <span className="text-red-400">❌</span>
                      <div className="flex-1">
                        <div className="text-gray-300">{step.step.description}</div>
                        {step.error && (
                          <div className="mt-1 text-xs text-gray-500">{step.error}</div>
                        )}
                        {step.expectedValue !== undefined && (
                          <div className="mt-1 flex gap-4 text-xs">
                            <span className="text-gray-500">
                              Expected: <span className="text-yellow-400">{String(step.expectedValue)}</span>
                            </span>
                            <span className="text-gray-500">
                              Actual: <span className="text-red-400">{String(step.actualValue)}</span>
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {/* Timeline (collapsed by default) */}
            {!result.passed && result.timeline && result.timeline.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-400">
                  View timeline ({result.timeline.length} events)
                </summary>
                <div className="mt-2 space-y-1 rounded bg-gray-900/50 p-2">
                  {result.timeline.slice(0, 10).map((event, eventIdx) => {
                    const icon = event.type === 'input' ? '🔧' :
                                 event.type === 'output' ? '💡' :
                                 event.type === 'check' ? '✓' :
                                 event.type === 'timer' ? '⏱' : '⏸'
                    const statusIcon = event.passed === false ? '❌' :
                                      event.passed === true ? '✅' : '  '

                    return (
                      <div key={eventIdx} className="flex gap-2 text-xs font-mono">
                        <span className="text-gray-600">
                          {icon} {event.timestamp.toString().padStart(6)}ms
                        </span>
                        <span className="text-gray-600">{statusIcon}</span>
                        <span className="flex-1 text-gray-400">{event.description}</span>
                      </div>
                    )
                  })}
                </div>
              </details>
            )}

            {/* Expected Outcome */}
            <div className="mt-2 border-t border-gray-700 pt-2 text-xs text-gray-500">
              Expected: {result.scenario.expectedOutcome}
            </div>
          </div>
        ))}

        {results.length > 5 && (
          <div className="text-center text-sm text-gray-500">
            ... and {results.length - 5} more tests
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="mt-3 border-t border-gray-700 pt-2 text-xs text-gray-500">
        <PlayCircle className="mr-1 inline h-3 w-3" />
        Total duration: {validationReport.totalDuration.toFixed(0)}ms
      </div>
    </div>
  )
}