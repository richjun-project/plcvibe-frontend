"use client"

import { useState, useRef } from 'react'
import { Upload, FileUp, CheckCircle2, XCircle, Loader2, Info } from 'lucide-react'
import { getUniversalImporter, ImportResult } from '@/lib/plc-parser/importers/universal-importer'
import { LadderProgram } from '@/lib/ladder/parser'

interface PLCFileUploaderProps {
  onImport: (program: LadderProgram, fileName: string, fileType: string) => void
  onError?: (error: string) => void
}

export function PLCFileUploader({ onImport, onError }: PLCFileUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const importer = getUniversalImporter()
  const supportedFormats = importer.getSupportedFormats()
  const formatInfo = importer.getFormatInfo()

  const handleFile = async (file: File) => {
    setIsProcessing(true)
    setResult(null)

    try {
      // 파일 검증
      const validation = await importer.validateFile(file)
      if (!validation.valid) {
        setResult({
          success: false,
          error: validation.message || 'Invalid file',
          fileName: file.name
        })
        onError?.(validation.message || 'Invalid file')
        return
      }

      // Import
      const importResult = await importer.importFile(file)
      setResult(importResult)

      if (importResult.success && importResult.program) {
        onImport(importResult.program, importResult.fileName!, importResult.fileType!)
      } else {
        onError?.(importResult.error || 'Import failed')
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      setResult({
        success: false,
        error: errorMsg,
        fileName: file.name
      })
      onError?.(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 transition-all cursor-pointer
          ${isDragging
            ? 'border-blue-500 bg-blue-500/10'
            : 'border-gray-600 hover:border-gray-500 bg-gray-900/30 hover:bg-gray-800/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept={supportedFormats.map(f => f.toLowerCase()).join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />

        <div className="flex flex-col items-center text-center space-y-4">
          {/* Icon */}
          {isProcessing ? (
            <Loader2 className="h-12 w-12 text-blue-500 animate-spin" />
          ) : (
            <Upload className={`h-12 w-12 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
          )}

          {/* Text */}
          <div>
            <p className="text-lg font-semibold text-gray-200">
              {isProcessing ? 'Processing PLC File...' : 'Upload PLC Project File'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              {isDragging
                ? 'Drop file here'
                : 'Click to browse or drag and drop'
              }
            </p>
          </div>

          {/* Supported Formats */}
          <div className="flex flex-wrap gap-2 justify-center">
            {supportedFormats.map(format => (
              <span
                key={format}
                className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-xs font-mono text-gray-300"
              >
                {format}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Result Message */}
      {result && (
        <div className={`
          rounded-lg p-4 border
          ${result.success
            ? 'bg-green-950/20 border-green-500/30'
            : 'bg-red-950/20 border-red-500/30'
          }
        `}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 mt-0.5" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500 mt-0.5" />
            )}
            <div className="flex-1">
              <p className={`font-medium ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                {result.success ? 'Import Successful' : 'Import Failed'}
              </p>
              <p className="text-sm text-gray-400 mt-1">
                {result.success
                  ? `${result.fileName} (${result.fileType?.toUpperCase()}) imported successfully`
                  : result.error
                }
              </p>
              {result.success && result.program && (
                <div className="mt-2 text-xs text-gray-500">
                  {result.program.networks.length} networks, {result.program.ioMap.length} I/O points
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Format Info */}
      <div className="rounded-lg border border-gray-700 bg-gray-800/30 p-4">
        <div className="flex items-center gap-2 mb-3">
          <Info className="h-4 w-4 text-blue-400" />
          <h3 className="text-sm font-semibold text-gray-300">Supported Formats</h3>
        </div>
        <div className="space-y-2">
          {formatInfo.map((info, idx) => (
            <div key={idx} className="text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-blue-400">{info.extensions.join(', ')}</span>
                <span className="text-gray-500">-</span>
                <span className="text-gray-400">{info.vendor}</span>
              </div>
              <p className="text-xs text-gray-500 ml-1">{info.description}</p>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-700">
          <p className="text-xs text-gray-500">
            <strong>Note:</strong> Files are parsed to extract ladder logic only.
            Hardware configuration and other project settings are not imported.
          </p>
        </div>
      </div>
    </div>
  )
}
