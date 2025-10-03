/**
 * Converts LadderProgram back to text format
 */
import type { LadderProgram, LadderRung, LadderElement } from './parser'

export function serializeLadderProgram(program: LadderProgram): string {
  const lines: string[] = []

  // Add I/O Mapping
  if (program.ioMap.length > 0) {
    lines.push('I/O Mapping:')
    program.ioMap.forEach(io => {
      lines.push(`${io.type} ${io.address}: ${io.description || 'No description'}`)
    })
    lines.push('')
  }

  // Add Networks
  program.networks.forEach((network, idx) => {
    lines.push(`Network ${idx + 1}${network.label ? ': ' + network.label : ''}`)
    lines.push(serializeRung(network))
    lines.push('')
  })

  return lines.join('\n')
}

function serializeRung(rung: LadderRung): string {
  const elements = rung.elements.map(el => serializeElement(el))
  // Use ASCII art ladder diagram format with pipes and dashes
  return `|--${elements.join('--')}--|`
}

function serializeElement(element: LadderElement): string {
  switch (element.type) {
    case 'contact-no':
      return `[ ${element.address} ]`
    case 'contact-nc':
      return `[/ ${element.address} ]`
    case 'coil':
      return `( ${element.address} )`
    case 'coil-set':
      return `( S ${element.address} )`
    case 'coil-reset':
      return `( R ${element.address} )`
    case 'timer':
      return `[TON ${element.address}, ${element.preset}ms]`
    case 'counter':
      return `[CTU ${element.address}, ${element.preset}]`
    case 'connection':
      return '--'
    default:
      return '--'
  }
}
