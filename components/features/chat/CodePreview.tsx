"use client"

import { FileCode, Network, Zap } from "lucide-react"

export interface CodePreviewProps {
  code: string
  iteration: number
  networks: number
  ioCount: number
}

export function CodePreview({ code, iteration, networks, ioCount }: CodePreviewProps) {
  if (!code || code.trim().length === 0) {
    return null
  }

  // Truncate code if too long (show first 20 lines)
  const lines = code.split('\n')
  const displayLines = lines.slice(0, 20)
  const isTruncated = lines.length > 20

  return (
    <div className="rounded-lg border border-blue-500/30 bg-gradient-to-br from-gray-900 to-gray-800 p-4 shadow-lg">
      {/* Header */}
      <div className="mb-3 flex items-center justify-between border-b border-gray-700 pb-2">
        <div className="flex items-center gap-2">
          <FileCode className="h-5 w-5 text-blue-400" />
          <span className="font-semibold text-blue-300">
            Iteration {iteration} - Generated Code
          </span>
        </div>
        <div className="flex gap-3 text-sm">
          <div className="flex items-center gap-1 text-gray-400">
            <Network className="h-4 w-4" />
            <span>{networks} Networks</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Zap className="h-4 w-4" />
            <span>{ioCount} I/O</span>
          </div>
        </div>
      </div>

      {/* Code */}
      <div className="overflow-x-auto">
        <pre className="font-mono text-sm text-gray-300">
          {displayLines.join('\n')}
        </pre>
        {isTruncated && (
          <div className="mt-2 text-sm text-gray-500 italic">
            ... ({lines.length - 20} more lines)
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="mt-3 border-t border-gray-700 pt-2 text-xs text-gray-500">
        💡 Full code saved in workspace/iteration_{iteration}.ladder
      </div>
    </div>
  )
}