/**
 * Rockwell Automation L5X File Importer
 *
 * Imports Allen-Bradley Studio 5000 (.L5X) files
 * and converts them to LadderProgram format
 */

import { XMLParser } from 'fast-xml-parser'
import { LadderProgram, LadderRung, LadderElement, IOMapping } from '@/lib/ladder/parser'

export class RockwellImporter {
  private parser: XMLParser

  constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      textNodeName: '#text',
      parseAttributeValue: true
    })
  }

  /**
   * Parse L5X file
   */
  async parseFile(file: File): Promise<LadderProgram> {
    const text = await file.text()
    const data = this.parser.parse(text)

    // L5X 구조 탐색
    const content = data.RSLogix5000Content || data.RSLogixContent
    if (!content) {
      throw new Error('Invalid L5X file: Missing RSLogix5000Content')
    }

    const controller = content.Controller
    if (!controller) {
      throw new Error('Invalid L5X file: Missing Controller')
    }

    // Programs 추출
    const programs = Array.isArray(controller.Programs?.Program)
      ? controller.Programs.Program
      : controller.Programs?.Program
      ? [controller.Programs.Program]
      : []

    if (programs.length === 0) {
      throw new Error('No programs found in L5X file')
    }

    // 첫 번째 프로그램 사용 (보통 MainProgram)
    const program = programs[0]
    const routines = Array.isArray(program.Routines?.Routine)
      ? program.Routines.Routine
      : program.Routines?.Routine
      ? [program.Routines.Routine]
      : []

    // RLL (Relay Ladder Logic) 루틴만 필터링
    const rllRoutines = routines.filter((r: any) => r['@_Type'] === 'RLL')

    if (rllRoutines.length === 0) {
      throw new Error('No ladder logic routines found')
    }

    // 래더 네트워크 추출
    const networks: LadderRung[] = []
    const ioMap: IOMapping[] = []
    const addressSet = new Set<string>()

    rllRoutines.forEach((routine: any) => {
      const rungs = Array.isArray(routine.RLLContent?.Rung)
        ? routine.RLLContent.Rung
        : routine.RLLContent?.Rung
        ? [routine.RLLContent.Rung]
        : []

      rungs.forEach((rung: any) => {
        const rungNumber = rung['@_Number']
        const rungText = rung.Text || ''
        const comment = rung.Comment || ''

        // Rung Text 파싱 (예: "XIC(Start)OTE(Motor)")
        const elements = this.parseRungText(rungText, addressSet)

        networks.push({
          id: rungNumber,
          label: comment,
          elements,
          comment
        })
      })
    })

    // I/O 매핑 생성
    addressSet.forEach(address => {
      const type = this.detectIOType(address)
      ioMap.push({
        address,
        name: address,
        type,
        description: `${type} - ${address}`
      })
    })

    return {
      networks,
      ioMap
    }
  }

  /**
   * Parse Rockwell Rung Text
   * 예: "XIC(Start)OTE(Motor)" → LadderElement[]
   */
  private parseRungText(text: string, addressSet: Set<string>): LadderElement[] {
    const elements: LadderElement[] = []

    // 정규식 패턴
    const patterns = [
      { regex: /XIC\(([^)]+)\)/g, type: 'contact-no' },      // Normally Open Contact
      { regex: /XIO\(([^)]+)\)/g, type: 'contact-nc' },      // Normally Closed Contact
      { regex: /OTE\(([^)]+)\)/g, type: 'coil' },            // Output Energize
      { regex: /OTL\(([^)]+)\)/g, type: 'coil-set' },        // Output Latch
      { regex: /OTU\(([^)]+)\)/g, type: 'coil-reset' },      // Output Unlatch
      { regex: /TON\(([^,]+),(\d+),(\d+)\)/g, type: 'timer' }, // Timer On-Delay
      { regex: /CTU\(([^,]+),(\d+),(\d+)\)/g, type: 'counter' }, // Counter Up
      { regex: /GRT\(([^,]+),([^)]+)\)/g, type: 'compare-gt' }, // Greater Than
      { regex: /LES\(([^,]+),([^)]+)\)/g, type: 'compare-lt' }, // Less Than
      { regex: /EQU\(([^,]+),([^)]+)\)/g, type: 'compare-eq' }, // Equal
      { regex: /ADD\(([^,]+),([^,]+),([^)]+)\)/g, type: 'math-add' }, // Add
      { regex: /SUB\(([^,]+),([^,]+),([^)]+)\)/g, type: 'math-sub' }, // Subtract
      { regex: /MUL\(([^,]+),([^,]+),([^)]+)\)/g, type: 'math-mul' }, // Multiply
      { regex: /DIV\(([^,]+),([^,]+),([^)]+)\)/g, type: 'math-div' }, // Divide
      { regex: /MOV\(([^,]+),([^)]+)\)/g, type: 'move' }       // Move
    ]

    patterns.forEach(({ regex, type }) => {
      let match
      while ((match = regex.exec(text)) !== null) {
        const element: LadderElement = { type: type as any }

        switch (type) {
          case 'contact-no':
          case 'contact-nc':
          case 'coil':
          case 'coil-set':
          case 'coil-reset':
            element.address = match[1]
            addressSet.add(match[1])
            break

          case 'timer':
            element.address = match[1]
            element.preset = parseInt(match[3])
            addressSet.add(match[1])
            break

          case 'counter':
            element.address = match[1]
            element.preset = parseInt(match[3])
            addressSet.add(match[1])
            break

          case 'compare-gt':
          case 'compare-lt':
          case 'compare-eq':
            element.operand1 = match[1]
            element.operand2 = match[2]
            addressSet.add(match[1])
            addressSet.add(match[2])
            break

          case 'math-add':
          case 'math-sub':
          case 'math-mul':
          case 'math-div':
            element.operand1 = match[1]
            element.operand2 = match[2]
            element.result = match[3]
            addressSet.add(match[1])
            addressSet.add(match[2])
            addressSet.add(match[3])
            break

          case 'move':
            element.operand1 = match[1]
            element.result = match[2]
            addressSet.add(match[1])
            addressSet.add(match[2])
            break
        }

        elements.push(element)
      }
    })

    return elements
  }

  /**
   * Detect I/O type from address
   */
  private detectIOType(address: string): 'DI' | 'DO' | 'AI' | 'AO' | 'M' {
    // Rockwell addressing conventions
    if (address.match(/^Local:\d+:I/)) return 'DI'  // Digital Input
    if (address.match(/^Local:\d+:O/)) return 'DO'  // Digital Output
    if (address.match(/^Local:\d+:C/)) return 'AI'  // Analog Input (Config)
    if (address.match(/^Local:\d+:AI/)) return 'AI' // Analog Input
    if (address.match(/^Local:\d+:AO/)) return 'AO' // Analog Output

    // 간단한 태그명
    if (address.toLowerCase().includes('input')) return 'DI'
    if (address.toLowerCase().includes('output')) return 'DO'
    if (address.toLowerCase().includes('sensor')) return 'AI'
    if (address.toLowerCase().includes('valve')) return 'AO'

    return 'M' // Memory/Internal
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['L5X', 'l5x']
  }
}
