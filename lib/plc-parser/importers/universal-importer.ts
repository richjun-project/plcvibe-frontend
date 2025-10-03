/**
 * Universal PLC File Importer
 *
 * 다양한 PLC 제조사의 파일 형식을 자동 감지하고 import
 */

import { LadderProgram } from '@/lib/ladder/parser'
import { RockwellImporter } from './rockwell-importer'
import { SiemensImporter } from './siemens-importer'
import { TextImporter } from './text-importer'

export interface PLCImporter {
  parseFile(file: File): Promise<LadderProgram>
  getSupportedExtensions(): string[]
}

export interface ImportResult {
  success: boolean
  program?: LadderProgram
  error?: string
  fileType?: string
  fileName?: string
}

export class UniversalPLCImporter {
  private importers: Map<string, PLCImporter>

  constructor() {
    this.importers = new Map()

    // Rockwell Importer 등록
    const rockwell = new RockwellImporter()
    rockwell.getSupportedExtensions().forEach(ext => {
      this.importers.set(ext.toLowerCase(), rockwell)
    })

    // Siemens Importer 등록
    const siemens = new SiemensImporter()
    siemens.getSupportedExtensions().forEach(ext => {
      this.importers.set(ext.toLowerCase(), siemens)
    })

    // Text Importer 등록
    const text = new TextImporter()
    text.getSupportedExtensions().forEach(ext => {
      this.importers.set(ext.toLowerCase(), text)
    })
  }

  /**
   * Import PLC file
   */
  async importFile(file: File): Promise<ImportResult> {
    try {
      const ext = this.getFileExtension(file.name).toLowerCase()
      const importer = this.importers.get(ext)

      if (!importer) {
        return {
          success: false,
          error: `Unsupported file format: .${ext}\n\nSupported formats: ${this.getSupportedFormats().join(', ')}`,
          fileName: file.name
        }
      }

      const program = await importer.parseFile(file)

      return {
        success: true,
        program,
        fileType: ext,
        fileName: file.name
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: file.name
      }
    }
  }

  /**
   * Get file extension
   */
  private getFileExtension(filename: string): string {
    const parts = filename.split('.')
    return parts.length > 1 ? parts[parts.length - 1] : ''
  }

  /**
   * Get all supported file formats
   */
  getSupportedFormats(): string[] {
    return Array.from(new Set(
      Array.from(this.importers.keys()).map(ext => `.${ext.toUpperCase()}`)
    )).sort()
  }

  /**
   * Get file format info
   */
  getFormatInfo(): Array<{
    extensions: string[]
    vendor: string
    description: string
  }> {
    return [
      {
        extensions: ['.L5X', '.l5x'],
        vendor: 'Rockwell Automation',
        description: 'Allen-Bradley Studio 5000 / RSLogix 5000'
      },
      {
        extensions: ['.ACD', '.acd'],
        vendor: 'Rockwell Automation',
        description: 'Allen-Bradley Archive File'
      },
      {
        extensions: ['.S7P', '.s7p'],
        vendor: 'Siemens',
        description: 'TIA Portal Project'
      },
      {
        extensions: ['.ZAP13', '.zap13'],
        vendor: 'Siemens',
        description: 'STEP 7 V13 Archive'
      },
      {
        extensions: ['.TXT', '.txt'],
        vendor: 'Generic',
        description: 'Plain Text Ladder Logic'
      }
    ]
  }

  /**
   * Validate file before import
   */
  async validateFile(file: File): Promise<{
    valid: boolean
    message?: string
  }> {
    // File size check (max 50MB)
    const maxSize = 50 * 1024 * 1024
    if (file.size > maxSize) {
      return {
        valid: false,
        message: `File too large: ${(file.size / 1024 / 1024).toFixed(1)}MB (max 50MB)`
      }
    }

    // Extension check
    const ext = this.getFileExtension(file.name).toLowerCase()
    if (!this.importers.has(ext)) {
      return {
        valid: false,
        message: `Unsupported file format: .${ext}`
      }
    }

    return { valid: true }
  }
}

// Singleton
let importerInstance: UniversalPLCImporter | null = null

export function getUniversalImporter(): UniversalPLCImporter {
  if (!importerInstance) {
    importerInstance = new UniversalPLCImporter()
  }
  return importerInstance
}
