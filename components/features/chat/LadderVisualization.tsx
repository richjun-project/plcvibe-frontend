"use client"

import { useState, useEffect, useMemo, Fragment } from "react"
import { Download, FileCode, Save, Check, Loader2, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { parseLadderText, generateLadderSVG } from "@/lib/ladder/parser"
import { exportToFile, downloadFile } from "@/lib/plc-parser/exporter"
import { useFileStore } from "@/lib/store/fileStore"
import { SimulatorPanel } from "@/components/features/simulator/SimulatorPanel"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import type { ExportOptions } from "@/lib/plc-parser/exporter"
import { toast } from "sonner"

interface LadderVisualizationProps {
  code: string
}

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export function LadderVisualization({ code }: LadderVisualizationProps) {
  const [exportFormat, setExportFormat] = useState<ExportOptions['format']>('text')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [showSimulator, setShowSimulator] = useState(false)
  const [simulatorState, setSimulatorState] = useState<Record<string, boolean>>({})
  const [showDebug, setShowDebug] = useState(false)
  const { files, activeFileId, updateFile, createNewFile } = useFileStore()

  // Memoize parsing and SVG generation
  const program = useMemo(() => parseLadderText(code), [code])
  const svg = useMemo(() => generateLadderSVG(program, simulatorState), [program, simulatorState])

  // Debug info
  const debugInfo = useMemo(() => ({
    networksFound: program.networks.length,
    ioMappings: program.ioMap.length,
    hasCode: code.length > 0,
    codePreview: code.substring(0, 200)
  }), [program, code])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + S: Save file
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault()
        handleSaveToFile()
      }

      // Cmd/Ctrl + E: Export
      if ((e.metaKey || e.ctrlKey) && e.key === 'e') {
        e.preventDefault()
        handleExport()
      }

      // Space: Toggle simulator (only if ladder logic exists)
      if (e.key === ' ' && e.target === document.body && program.networks.length > 0) {
        e.preventDefault()
        setShowSimulator(!showSimulator)
      }

      // D: Toggle debug panel
      if (e.key === 'd' && e.target === document.body) {
        e.preventDefault()
        setShowDebug(!showDebug)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showSimulator, showDebug, program.networks.length])

  // Auto-save to active file when ladder code changes (debounced)
  useEffect(() => {
    const activeFile = files.find(f => f.id === activeFileId)
    if (!activeFile || program.networks.length === 0 || !code) {
      return
    }

    setSaveStatus('saving')

    // Debounce auto-save to avoid excessive updates
    const timeoutId = setTimeout(() => {
      try {
        updateFile(activeFile.id, {
          content: program,
          lastModified: new Date()
        })
        setSaveStatus('saved')

        // Reset to idle after 2 seconds
        setTimeout(() => setSaveStatus('idle'), 2000)
      } catch (error) {
        setSaveStatus('error')
        console.error('Failed to save file:', error)
      }
    }, 1500)

    return () => clearTimeout(timeoutId)
  }, [code, activeFileId])

  const activeFile = files.find(f => f.id === activeFileId)

  const handleSaveToFile = () => {
    if (!activeFile) {
      toast.error('No active file selected')
      return
    }

    updateFile(activeFile.id, {
      content: program,
      lastModified: new Date()
    })
    toast.success(`Saved to ${activeFile.name}`)
  }

  const handleExport = () => {
    const filename = activeFile?.name || `plc_program_${Date.now()}.${getFileExtension(exportFormat)}`
    const options: ExportOptions = {
      format: exportFormat,
      filename,
      projectName: activeFile?.name.replace(/\.[^/.]+$/, "") || 'PLC_Vibe_Project'
    }

    const blob = exportToFile(program, options)
    downloadFile(blob, options.filename)
    toast.success('File exported successfully')
  }

  const getFileExtension = (format: ExportOptions['format']) => {
    switch (format) {
      case 'siemens-s7': return 'awl'
      case 'allen-bradley-l5x': return 'L5X'
      case 'mitsubishi-gx': return 'gx2'
      default: return 'txt'
    }
  }

  return (
    <ErrorBoundary>
      <div className="space-y-4">
        {/* Control Bar */}
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {program.networks.length === 0 && code.length > 0 && (
            <div className="text-xs text-yellow-400 bg-yellow-900/20 px-3 py-1.5 rounded border border-yellow-700/50">
              ⚠️ No ladder logic parsed - Check AI response format
            </div>
          )}
          <Button
            onClick={() => setShowDebug(!showDebug)}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            {showDebug ? "Hide Debug" : "Show Debug"}
          </Button>
        </div>
        <Button
          onClick={() => setShowSimulator(!showSimulator)}
          variant={showSimulator ? "default" : "outline"}
          size="sm"
          disabled={program.networks.length === 0}
        >
          <Play className="w-4 h-4 mr-2" />
          {showSimulator ? "Hide Simulator" : "Show Simulator"}
        </Button>
      </div>

      {/* Debug Panel */}
      {showDebug && (
        <div className="bg-gray-900/70 border border-gray-700 rounded-lg p-4 font-mono text-xs">
          <div className="text-gray-400 mb-2 font-bold">Debug Information:</div>
          <div className="space-y-1 text-gray-300">
            <div>Networks Found: <span className="text-blue-400">{debugInfo.networksFound}</span></div>
            <div>I/O Mappings: <span className="text-green-400">{debugInfo.ioMappings}</span></div>
            <div>Code Length: <span className="text-purple-400">{code.length}</span> chars</div>
            <div className="mt-2 text-gray-500">Code Preview:</div>
            <pre className="text-[10px] bg-black/30 p-2 rounded overflow-x-auto">{debugInfo.codePreview}</pre>
          </div>
        </div>
      )}

      {/* Simulator Panel */}
      {showSimulator && (
        <SimulatorPanel
          program={program}
          onStateChange={setSimulatorState}
        />
      )}

      {/* Ladder Diagram Visualization */}
      <div className="border-2 border-gray-700 rounded-lg p-4 bg-gray-900/50 overflow-x-auto">
        <div dangerouslySetInnerHTML={{ __html: svg }} />
      </div>

      {/* I/O Mapping Table */}
      {program.ioMap.length > 0 && (
        <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/30">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">I/O Mapping</h4>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="font-semibold text-gray-400">Address</div>
            <div className="font-semibold text-gray-400">Name</div>
            <div className="font-semibold text-gray-400">Type</div>
            {program.ioMap.map((io, idx) => (
              <Fragment key={`io-${io.address}-${idx}`}>
                <div className="font-mono text-blue-400">{io.address}</div>
                <div className="text-gray-300">{io.name}</div>
                <div className="text-gray-500">{io.type}</div>
              </Fragment>
            ))}
          </div>
        </div>
      )}

      {/* Export Controls */}
      <div className="space-y-2">
        {activeFile && (
          <div className="flex items-center justify-between p-3 bg-blue-900/20 rounded-lg border border-blue-700/50">
            <div className="flex items-center gap-3">
              <FileCode className="w-4 h-4 text-blue-300" />
              <div className="flex flex-col">
                <span className="text-sm text-blue-300">Editing: {activeFile.name}</span>
                <div className="flex items-center gap-2 text-xs">
                  {saveStatus === 'saving' && (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-yellow-400" />
                      <span className="text-yellow-400">Saving...</span>
                    </>
                  )}
                  {saveStatus === 'saved' && (
                    <>
                      <Check className="w-3 h-3 text-green-400" />
                      <span className="text-green-400">Saved</span>
                    </>
                  )}
                  {saveStatus === 'error' && (
                    <span className="text-red-400">Save failed</span>
                  )}
                </div>
              </div>
            </div>
            <Button onClick={handleSaveToFile} variant="outline" size="sm">
              <Save className="w-4 h-4 mr-2" />
              Save Now
            </Button>
          </div>
        )}
        <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
          <FileCode className="w-5 h-5 text-gray-400" />
          <select
            value={exportFormat}
            onChange={(e) => setExportFormat(e.target.value as ExportOptions['format'])}
            className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="text">Plain Text (.txt)</option>
            <option value="siemens-s7">Siemens S7 (.awl)</option>
            <option value="allen-bradley-l5x">Allen-Bradley (.L5X)</option>
            <option value="mitsubishi-gx">Mitsubishi GX (.gx2)</option>
          </select>
          <Button onClick={handleExport} variant="outline" size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </div>
    </ErrorBoundary>
  )
}