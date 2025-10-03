import { create } from 'zustand'
import type { PLCFile } from '@/components/features/editor/FileManager'
import { parseSiemensS7File } from '@/lib/plc-parser/formats/siemens'
import { parseAllenBradleyL5X } from '@/lib/plc-parser/formats/allen-bradley'
import { parseLadderText } from '@/lib/ladder/parser'
import { toast } from 'sonner'

interface FileStore {
  files: PLCFile[]
  activeFileId: string | undefined
  setActiveFile: (fileId: string) => void
  addFile: (file: PLCFile) => void
  deleteFile: (fileId: string) => void
  updateFile: (fileId: string, updates: Partial<PLCFile>) => void
  uploadFile: (file: File) => Promise<void>
  createNewFile: () => void
}

export const useFileStore = create<FileStore>((set, get) => ({
  files: [],
  activeFileId: undefined,

  setActiveFile: (fileId: string) => {
    set({ activeFileId: fileId })
  },

  addFile: (file: PLCFile) => {
    set((state) => ({
      files: [...state.files, file],
      activeFileId: file.id
    }))
  },

  deleteFile: (fileId: string) => {
    set((state) => ({
      files: state.files.filter(f => f.id !== fileId),
      activeFileId: state.activeFileId === fileId ? undefined : state.activeFileId
    }))
    toast.success('File deleted')
  },

  updateFile: (fileId: string, updates: Partial<PLCFile>) => {
    set((state) => ({
      files: state.files.map(f =>
        f.id === fileId ? { ...f, ...updates } : f
      )
    }))
  },

  uploadFile: async (file: File) => {
    try {
      const extension = file.name.match(/\.(s7p|zap16|L5X|ACD|gx2)$/i)?.[1]
      if (!extension) {
        toast.error('Unsupported file format')
        return
      }

      let plcFile: PLCFile
      let content: any

      // Parse based on file type
      if (extension === 's7p' || extension === 'zap16') {
        content = await parseSiemensS7File(file)
        plcFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: 'siemens',
          format: `.${extension}` as any,
          size: file.size,
          lastModified: new Date(file.lastModified),
          content
        }
      } else if (extension === 'L5X' || extension === 'ACD') {
        content = await parseAllenBradleyL5X(file)
        plcFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: 'allen-bradley',
          format: `.${extension}` as any,
          size: file.size,
          lastModified: new Date(file.lastModified),
          content
        }
      } else if (extension === 'gx2') {
        // Mitsubishi format - placeholder for now
        plcFile = {
          id: crypto.randomUUID(),
          name: file.name,
          type: 'mitsubishi',
          format: '.gx2',
          size: file.size,
          lastModified: new Date(file.lastModified),
          content: { name: file.name, networks: [] }
        }
        toast.info('Mitsubishi format support coming soon')
      } else {
        throw new Error('Unsupported format')
      }

      get().addFile(plcFile)
      toast.success(`File uploaded: ${file.name}`)
    } catch (error) {
      console.error('File upload error:', error)
      toast.error('Failed to parse file')
    }
  },

  createNewFile: (plcType?: 'siemens' | 'allen-bradley' | 'mitsubishi' | 'generic') => {
    const type = plcType || 'generic'
    const formatMap = {
      'siemens': '.s7p',
      'allen-bradley': '.L5X',
      'mitsubishi': '.gx2',
      'generic': '.txt'
    }

    const newFile: PLCFile = {
      id: crypto.randomUUID(),
      name: `New_Project_${Date.now()}${formatMap[type]}`,
      type,
      format: formatMap[type] as any,
      size: 0,
      lastModified: new Date(),
      content: {
        name: 'New Project',
        networks: [],
        ioMap: []
      }
    }
    get().addFile(newFile)
    toast.success(`New ${type} file created`)
  }
}))