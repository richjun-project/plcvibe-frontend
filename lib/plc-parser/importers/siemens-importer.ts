/**
 * Siemens TIA Portal S7P File Importer
 *
 * Imports Siemens TIA Portal (.s7p, .zap13) files
 * and converts them to LadderProgram format
 */

import JSZip from 'jszip'
import { XMLParser } from 'fast-xml-parser'
import { LadderProgram, LadderRung, LadderElement, IOMapping } from '@/lib/ladder/parser'

export class SiemensImporter {
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
   * Parse S7P file
   */
  async parseFile(file: File): Promise<LadderProgram> {
    // 1. ZIP 압축 해제
    const arrayBuffer = await file.arrayBuffer()
    const zip = await JSZip.loadAsync(arrayBuffer)

    // 2. 프로젝트 구조 탐색
    const xmlFiles = Object.keys(zip.files).filter(name =>
      (name.includes('PEData') || name.includes('IM0') || name.includes('Block')) &&
      name.toLowerCase().endsWith('.xml')
    )

    if (xmlFiles.length === 0) {
      throw new Error('No valid XML files found in S7P archive')
    }

    // 3. 래더 로직 XML 파일 찾기
    let ladderData: any = null

    for (const xmlFile of xmlFiles) {
      const content = await zip.files[xmlFile].async('string')
      const parsed = this.parser.parse(content)

      // 래더 로직이 포함된 XML 확인
      if (this.hasLadderLogic(parsed)) {
        ladderData = parsed
        break
      }
    }

    if (!ladderData) {
      throw new Error('No ladder logic found in S7P file')
    }

    // 4. Siemens XML → LadderProgram 변환
    return this.convertToLadder(ladderData)
  }

  /**
   * Check if XML contains ladder logic
   */
  private hasLadderLogic(data: any): boolean {
    const jsonStr = JSON.stringify(data).toLowerCase()
    return (
      jsonStr.includes('network') ||
      jsonStr.includes('contact') ||
      jsonStr.includes('coil') ||
      jsonStr.includes('ladder')
    )
  }

  /**
   * Convert Siemens XML to LadderProgram
   */
  private convertToLadder(data: any): LadderProgram {
    const networks: LadderRung[] = []
    const ioMap: IOMapping[] = []
    const addressSet = new Set<string>()

    // Siemens 구조 탐색 (TIA Portal 버전마다 다를 수 있음)
    const networkData = this.findNetworks(data)

    networkData.forEach((network: any, idx: number) => {
      const elements = this.parseNetwork(network, addressSet)

      networks.push({
        id: idx,
        label: network.title || network.comment || `Network ${idx + 1}`,
        elements,
        comment: network.comment
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
   * Find networks in Siemens XML structure
   */
  private findNetworks(data: any): any[] {
    const networks: any[] = []

    // 재귀적으로 네트워크 찾기
    const search = (obj: any) => {
      if (!obj || typeof obj !== 'object') return

      // Network 키 확인
      if (obj.Network || obj.network) {
        const netArr = Array.isArray(obj.Network || obj.network)
          ? (obj.Network || obj.network)
          : [obj.Network || obj.network]
        networks.push(...netArr)
        return
      }

      // 하위 탐색
      Object.values(obj).forEach(val => search(val))
    }

    search(data)
    return networks
  }

  /**
   * Parse Siemens network
   */
  private parseNetwork(network: any, addressSet: Set<string>): LadderElement[] {
    const elements: LadderElement[] = []

    // Siemens 명령어 구조
    const parts = Array.isArray(network.Parts?.Part)
      ? network.Parts.Part
      : network.Parts?.Part
      ? [network.Parts.Part]
      : []

    parts.forEach((part: any) => {
      const instruction = part.Instruction || part

      // 명령어 타입별 처리
      const name = instruction['@_Name'] || instruction.name
      const address = instruction.Operand || instruction['@_Operand']

      switch (name) {
        case 'A':   // And (NO Contact)
        case 'AN':  // And Not (NC Contact)
          elements.push({
            type: name === 'A' ? 'contact-no' : 'contact-nc',
            address: this.normalizeAddress(address)
          })
          if (address) addressSet.add(this.normalizeAddress(address))
          break

        case '=':   // Assignment (Coil)
          elements.push({
            type: 'coil',
            address: this.normalizeAddress(address)
          })
          if (address) addressSet.add(this.normalizeAddress(address))
          break

        case 'S':   // Set
          elements.push({
            type: 'coil-set',
            address: this.normalizeAddress(address)
          })
          if (address) addressSet.add(this.normalizeAddress(address))
          break

        case 'R':   // Reset
          elements.push({
            type: 'coil-reset',
            address: this.normalizeAddress(address)
          })
          if (address) addressSet.add(this.normalizeAddress(address))
          break

        case 'TON': // Timer On-Delay
          elements.push({
            type: 'timer',
            address: this.normalizeAddress(address),
            preset: parseInt(instruction.Preset || instruction['@_Preset'] || '1000')
          })
          if (address) addressSet.add(this.normalizeAddress(address))
          break

        case 'CTU': // Counter Up
          elements.push({
            type: 'counter',
            address: this.normalizeAddress(address),
            preset: parseInt(instruction.Preset || instruction['@_Preset'] || '10')
          })
          if (address) addressSet.add(this.normalizeAddress(address))
          break

        case '>':   // Greater Than
        case '<':   // Less Than
        case '==':  // Equal
          elements.push({
            type: name === '>' ? 'compare-gt' : name === '<' ? 'compare-lt' : 'compare-eq',
            operand1: this.normalizeAddress(instruction.Operand1 || instruction['@_Operand1']),
            operand2: this.normalizeAddress(instruction.Operand2 || instruction['@_Operand2'])
          })
          break
      }
    })

    return elements
  }

  /**
   * Normalize Siemens address format
   * 예: "I 0.0" → "I0.0", "M 10.5" → "M10.5"
   */
  private normalizeAddress(address: string | undefined): string {
    if (!address) return 'UNKNOWN'
    return address.replace(/\s+/g, '')
  }

  /**
   * Detect I/O type from Siemens address
   */
  private detectIOType(address: string): 'DI' | 'DO' | 'AI' | 'AO' | 'M' {
    const addr = address.toUpperCase()

    if (addr.startsWith('I') || addr.startsWith('E')) return 'DI'  // Input (Eingang)
    if (addr.startsWith('Q') || addr.startsWith('A')) return 'DO'  // Output (Ausgang)
    if (addr.startsWith('PIW') || addr.startsWith('PEW')) return 'AI' // Analog Input
    if (addr.startsWith('PAW') || addr.startsWith('PQW')) return 'AO' // Analog Output
    if (addr.startsWith('M') || addr.startsWith('MB')) return 'M'   // Memory (Merker)

    return 'M'
  }

  /**
   * Get supported file extensions
   */
  getSupportedExtensions(): string[] {
    return ['s7p', 'S7P', 'zap13', 'ZAP13']
  }
}
