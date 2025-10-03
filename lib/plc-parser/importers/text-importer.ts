/**
 * Text File Importer
 *
 * .txt 파일에서 래더 로직을 import
 */

import { LadderProgram, parseLadderText } from '@/lib/ladder/parser'
import { PLCImporter } from './universal-importer'

export class TextImporter implements PLCImporter {
  async parseFile(file: File): Promise<LadderProgram> {
    try {
      // Read file as text
      const text = await file.text()

      if (!text || text.trim().length === 0) {
        throw new Error('Empty file')
      }

      // Parse using existing ladder parser
      const program = parseLadderText(text)

      if (!program.networks || program.networks.length === 0) {
        throw new Error('No ladder networks found in file')
      }

      return program
    } catch (error) {
      throw new Error(
        `Failed to parse text file: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }

  getSupportedExtensions(): string[] {
    return ['txt']
  }
}
