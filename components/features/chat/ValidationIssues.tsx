"use client"

import { AlertCircle, AlertTriangle, Info, Lightbulb } from "lucide-react"

export interface DebugIssue {
  severity: 'error' | 'warning' | 'info'
  type: 'parsing' | 'simulation' | 'logic' | 'format'
  message: string
  suggestion?: string
  code?: string
}

export interface ValidationIssuesProps {
  issues: DebugIssue[]
  success: boolean
}

export function ValidationIssues({ issues, success }: ValidationIssuesProps) {
  if (!issues || issues.length === 0) {
    return null
  }

  const errors = issues.filter(i => i.severity === 'error')
  const warnings = issues.filter(i => i.severity === 'warning')
  const infos = issues.filter(i => i.severity === 'info')

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-400" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-yellow-400" />
      case 'info':
        return <Info className="h-5 w-5 text-blue-400" />
      default:
        return null
    }
  }

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'error':
        return 'border-red-500/30 bg-red-950/20'
      case 'warning':
        return 'border-yellow-500/30 bg-yellow-950/20'
      case 'info':
        return 'border-blue-500/30 bg-blue-950/20'
      default:
        return 'border-gray-500/30 bg-gray-950/20'
    }
  }

  return (
    <div className="rounded-lg border border-orange-500/30 bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-lg">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-700 pb-2">
        <div className="flex items-center gap-2">
          {success ? (
            <>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-500/20">
                <span className="text-lg">✅</span>
              </div>
              <span className="font-semibold text-green-400">
                Validation Passed
              </span>
            </>
          ) : (
            <>
              <AlertCircle className="h-5 w-5 text-red-400" />
              <span className="font-semibold text-red-300">
                Validation Issues ({issues.length})
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2 text-sm">
          {errors.length > 0 && (
            <span className="rounded bg-red-900/30 px-2 py-1 text-red-400">
              {errors.length} Errors
            </span>
          )}
          {warnings.length > 0 && (
            <span className="rounded bg-yellow-900/30 px-2 py-1 text-yellow-400">
              {warnings.length} Warnings
            </span>
          )}
          {infos.length > 0 && (
            <span className="rounded bg-blue-900/30 px-2 py-1 text-blue-400">
              {infos.length} Info
            </span>
          )}
        </div>
      </div>

      {/* Issues */}
      <div className="space-y-2">
        {issues.map((issue, idx) => (
          <div
            key={idx}
            className={`rounded-lg border p-3 ${getSeverityColor(issue.severity)}`}
          >
            <div className="flex items-start gap-2">
              {getSeverityIcon(issue.severity)}
              <div className="flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="font-semibold text-gray-200">
                    {issue.type.toUpperCase()}
                  </span>
                  <span className="text-sm text-gray-400">·</span>
                  <span className="text-sm capitalize text-gray-400">
                    {issue.severity}
                  </span>
                </div>
                <p className="text-sm text-gray-300">{issue.message}</p>

                {issue.suggestion && (
                  <div className="mt-2 flex items-start gap-2 rounded bg-gray-900/50 p-2">
                    <Lightbulb className="h-4 w-4 flex-shrink-0 text-yellow-400" />
                    <p className="text-sm text-gray-400">{issue.suggestion}</p>
                  </div>
                )}

                {issue.code && (
                  <div className="mt-2 rounded bg-gray-900/50 p-2">
                    <pre className="text-xs font-mono text-gray-500">
                      {issue.code}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}