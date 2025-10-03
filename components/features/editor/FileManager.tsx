"use client"

import { useState } from "react"
import { File, FileUp, FolderOpen, Trash2, Download, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils/cn"
import { toast } from "sonner"

export interface PLCFile {
  id: string
  name: string
  type: 'siemens' | 'allen-bradley' | 'mitsubishi' | 'generic'
  format: '.s7p' | '.zap16' | '.L5X' | '.ACD' | '.gx2' | '.txt'
  size: number
  lastModified: Date
  content: any
}

interface FileManagerProps {
  files: PLCFile[]
  activeFileId?: string
  onFileSelect: (file: PLCFile) => void
  onFileUpload: (file: File) => Promise<void>
  onFileDelete: (fileId: string) => void
  onNewFile: () => void
}

export function FileManager({
  files,
  activeFileId,
  onFileSelect,
  onFileUpload,
  onFileDelete,
  onNewFile
}: FileManagerProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const droppedFiles = Array.from(e.dataTransfer.files)
    const plcFile = droppedFiles.find(f =>
      f.name.match(/\.(s7p|zap16|L5X|ACD|gx2)$/i)
    )

    if (plcFile) {
      await onFileUpload(plcFile)
    } else {
      toast.error('Please upload a valid PLC file')
    }
  }

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      await onFileUpload(file)
    }
  }

  const getFileIcon = (type: PLCFile['type']) => {
    return <File className="w-4 h-4" />
  }

  const getFileTypeColor = (type: PLCFile['type']) => {
    switch (type) {
      case 'siemens': return 'bg-blue-600/20 text-blue-400 border-blue-500/30'
      case 'allen-bradley': return 'bg-red-600/20 text-red-400 border-red-500/30'
      case 'mitsubishi': return 'bg-green-600/20 text-green-400 border-green-500/30'
      default: return 'bg-gray-600/20 text-gray-400 border-gray-500/30'
    }
  }

  return (
    <div className="w-80 h-full border-r border-gray-800 bg-gray-900/50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-200 flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            Project Files
          </h3>
          <Button size="sm" variant="ghost" onClick={onNewFile}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>

        {/* Upload Area */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            "relative border-2 border-dashed rounded-lg p-4 transition-all cursor-pointer hover:border-blue-500/50",
            isDragging ? "border-blue-500 bg-blue-500/10" : "border-gray-700"
          )}
        >
          <input
            type="file"
            accept=".s7p,.zap16,.L5X,.ACD,.gx2"
            onChange={handleFileInput}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
          <div className="flex flex-col items-center gap-2 pointer-events-none">
            <FileUp className="w-5 h-5 text-gray-400" />
            <p className="text-xs text-gray-400 text-center">
              Drop PLC file or click to upload
            </p>
            <p className="text-[10px] text-gray-500">
              .s7p, .L5X, .ACD, .gx2
            </p>
          </div>
        </div>
      </div>

      {/* File List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {files.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-4">
            <File className="w-12 h-12 text-gray-600 mb-2" />
            <p className="text-sm text-gray-500">No files yet</p>
            <p className="text-xs text-gray-600 mt-1">
              Upload or create a new PLC project
            </p>
          </div>
        ) : (
          files.map(file => (
            <div
              key={file.id}
              onClick={() => onFileSelect(file)}
              className={cn(
                "group p-3 rounded-lg cursor-pointer transition-all border",
                activeFileId === file.id
                  ? "bg-blue-600/20 border-blue-500/50"
                  : "bg-gray-800/30 border-gray-700 hover:bg-gray-800/50 hover:border-gray-600"
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {getFileIcon(file.type)}
                    <span className="text-sm text-gray-200 truncate font-medium">
                      {file.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", getFileTypeColor(file.type))}>
                      {file.type}
                    </Badge>
                    <span className="text-[10px] text-gray-500">
                      {(file.size / 1024).toFixed(1)} KB
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => {
                    e.stopPropagation()
                    onFileDelete(file.id)
                  }}
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Stats */}
      <div className="p-3 border-t border-gray-800 bg-gray-900/80">
        <div className="text-xs text-gray-500">
          {files.length} file{files.length !== 1 ? 's' : ''}
        </div>
      </div>
    </div>
  )
}