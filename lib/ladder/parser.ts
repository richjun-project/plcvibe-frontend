// Ladder Logic Parser - converts text to structured data

export type DataType = 'BOOL' | 'INT' | 'REAL'

export interface LadderElement {
  type: 'contact-no' | 'contact-nc' | 'coil' | 'coil-set' | 'coil-reset' |
        'timer' | 'counter' | 'connection' |
        'compare-gt' | 'compare-lt' | 'compare-eq' | 'compare-ge' | 'compare-le' | 'compare-ne' |
        'math-add' | 'math-sub' | 'math-mul' | 'math-div' | 'move' |
        'pid' | 'filter-avg' | 'scale'
  address?: string
  label?: string
  preset?: number
  dataType?: DataType
  value?: number  // For constants and numeric values
  operand1?: string  // First operand for operations
  operand2?: string  // Second operand for operations
  result?: string    // Result destination for operations
  // PID parameters
  kp?: number  // Proportional gain
  ki?: number  // Integral gain
  kd?: number  // Derivative gain
  setpoint?: string  // Setpoint address for PID
  // Scale parameters
  inMin?: number
  inMax?: number
  outMin?: number
  outMax?: number
  // Filter parameters
  samples?: number  // Number of samples for averaging
}

export interface LadderRung {
  id: number
  label?: string
  elements: LadderElement[]  // Legacy: single branch (AND logic)
  branches?: LadderElement[][] // New: multiple parallel branches (OR logic)
  comment?: string
}

export interface LadderProgram {
  networks: LadderRung[]
  ioMap: IOMapping[]
}

export interface IOMapping {
  address: string
  name: string
  type: 'DI' | 'DO' | 'AI' | 'AO' | 'M'
  description?: string
}

const DEBUG = process.env.NODE_ENV === 'development'

export function parseLadderText(text: string): LadderProgram {
  const networks: LadderRung[] = []
  const ioMap: IOMapping[] = []
  const addressSet = new Set<string>()

  if (DEBUG) {
    console.log('[Parser] Starting to parse ladder text...')
    console.log('[Parser] Input text:', text.substring(0, 200))
  }

  // PRE-VALIDATION: Detect markdown formatting
  if (text.includes('**')) {
    const error = '❌ MARKDOWN DETECTED: Code contains ** (bold formatting).\n' +
      '   Use plain text format: "Network 1: Description"\n' +
      '   NOT: "**Network 1: Description**"\n' +
      '   This is ladder logic code, not markdown documentation!'
    console.error('[Parser]', error)
    throw new Error(error)
  }

  // Detect markdown tables
  if (text.match(/\|\s*[-:]+\s*\|/)) {
    const error = '❌ MARKDOWN TABLE DETECTED: Use plain I/O mapping format.\n' +
      '   Use: "I0.0 - Start Button"\n' +
      '   NOT: "| I0.0 | Start Button |"\n' +
      '   Ladder logic uses simple lists, not markdown tables!'
    console.error('[Parser]', error)
    throw new Error(error)
  }

  const lines = text.split('\n')
  let currentNetwork: LadderRung | null = null
  let networkId = 0
  let currentNetworkLines: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimmed = line.trim()

    // Parse network header
    if (trimmed.match(/^Network\s+\d+/i)) {
      // Save previous network
      if (currentNetwork && currentNetworkLines.length > 0) {
        // Check if multiple lines = parallel branches
        if (currentNetworkLines.length > 1) {
          // Parse each line as a separate branch
          const branches = currentNetworkLines.map(line => parseSingleLine(line))
          currentNetwork.branches = branches
          currentNetwork.elements = [] // Keep empty for compatibility
          if (DEBUG) console.log(`[Parser] Completed Network ${currentNetwork.id} with ${branches.length} parallel branches`)
        } else {
          // Single line = legacy single branch
          const elements = parseSingleLine(currentNetworkLines[0])
          currentNetwork.elements = elements
          if (DEBUG) console.log(`[Parser] Completed Network ${currentNetwork.id} with ${elements.length} elements`)
        }
        networks.push(currentNetwork)
      }

      networkId++
      const labelMatch = trimmed.match(/Network\s+\d+:\s*(.+)/i)
      currentNetwork = {
        id: networkId,
        label: labelMatch ? labelMatch[1].trim() : undefined,
        elements: []
      }
      currentNetworkLines = []
      if (DEBUG) console.log(`[Parser] Started Network ${networkId}: ${currentNetwork.label || 'No label'}`)
      continue
    }

    // Collect lines for current network
    if (currentNetwork && (trimmed.startsWith('|') || trimmed.includes('--['))) {
      currentNetworkLines.push(trimmed)
    }

    // Parse I/O mapping (separate section)
    if (trimmed.match(/^([IQM]\d+\.\d+)\s*[-:]\s*(.+)$/)) {
      const ioMapping = parseIOLine(trimmed)
      if (ioMapping) {
        ioMap.push(ioMapping)
        if (DEBUG) console.log(`[Parser] Found I/O mapping: ${ioMapping.address} -> ${ioMapping.name}`)
      }
    }
  }

  // Save last network
  if (currentNetwork && currentNetworkLines.length > 0) {
    // Check if multiple lines = parallel branches
    if (currentNetworkLines.length > 1) {
      // Parse each line as a separate branch
      const branches = currentNetworkLines.map(line => parseSingleLine(line))
      currentNetwork.branches = branches
      currentNetwork.elements = [] // Keep empty for compatibility
      if (DEBUG) console.log(`[Parser] Completed Network ${currentNetwork.id} with ${branches.length} parallel branches`)
    } else {
      // Single line = legacy single branch
      const elements = parseSingleLine(currentNetworkLines[0])
      currentNetwork.elements = elements
      if (DEBUG) console.log(`[Parser] Completed Network ${currentNetwork.id} with ${elements.length} elements`)
    }
    networks.push(currentNetwork)
  }

  // Extract I/O addresses from elements if ioMap is empty
  if (ioMap.length === 0) {
    if (DEBUG) console.log('[Parser] No I/O mapping found, auto-detecting from elements...')
    networks.forEach(network => {
      network.elements.forEach(element => {
        if (element.address && !addressSet.has(element.address)) {
          addressSet.add(element.address)
          const io = autoDetectIO(element.address)
          if (io) {
            ioMap.push(io)
            if (DEBUG) console.log(`[Parser] Auto-detected I/O: ${io.address} (${io.type})`)
          }
        }
      })
    })
  }

  if (DEBUG) console.log(`[Parser] Parsing complete: ${networks.length} networks, ${ioMap.length} I/O`)
  return { networks, ioMap }
}

// Parse a single ladder line into elements
function parseSingleLine(line: string): LadderElement[] {
  const elements: LadderElement[] = []

  if (DEBUG) console.log('[Parser] Parsing single line:', line)

  return parseLineElements(line)
}

// Legacy function for compatibility - now just joins and parses
function parseNetworkLines(lines: string[]): LadderElement[] {
  const fullLine = lines.join(' ')
  if (DEBUG) console.log('[Parser] Parsing network lines:', fullLine)
  return parseLineElements(fullLine)
}

// Core parsing logic extracted
function parseLineElements(fullLine: string): LadderElement[] {
  const elements: LadderElement[] = []

  // Match individual elements separately for better accuracy
  // Timer/Counter Done Bit Contact: [ T1.DN ] or [ C1.DN ]
  const doneBitPattern = /\[\s*([TCD]\w*)\.DN\s*\]/g
  // NO Contact: [ address ]
  const noContactPattern = /\[\s*([IQM]\d+\.\d+)\s*\]/g
  // NC Contact: [/ address ]
  const ncContactPattern = /\[\/\s*([IQM]\d+\.\d+)\s*\]/g
  // SET Coil: ( S address )
  const setCoilPattern = /\(\s*S\s+([IQM]\d+\.\d+)\s*\)/g
  // RESET Coil: ( R address )
  const resetCoilPattern = /\(\s*R\s+([IQM]\d+\.\d+)\s*\)/g
  // Standard Coil: ( address )
  const coilPattern = /\(\s*([IQM]\d+\.\d+)\s*\)/g
  // Timer: [TON address, preset]
  const timerPattern = /\[TON\s+([TCD]\w*),\s*(\d+)ms\]/g

  // Track positions to maintain order
  const foundElements: Array<{ pos: number; element: LadderElement }> = []

  // Find all timer/counter done bits FIRST (to avoid confusion with NO contacts)
  let match
  while ((match = doneBitPattern.exec(fullLine)) !== null) {
    if (match[1]) {
      foundElements.push({
        pos: match.index,
        element: { type: 'contact-no', address: match[0].trim() } // Store as "[ T1.DN ]" for simulator
      })
      if (DEBUG) console.log('[Parser] Found done bit contact:', match[0])
    }
  }

  // Find all NC contacts (check first to avoid confusion with NO contacts)
  const existingPositions = new Set(foundElements.map(e => e.pos))
  ncContactPattern.lastIndex = 0 // Reset regex
  while ((match = ncContactPattern.exec(fullLine)) !== null) {
    if (match[1] && !existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: { type: 'contact-nc', address: match[1] }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found NC contact:', match[1])
    }
  }

  // Find all NO contacts (avoid positions already taken by done bits and NC)
  noContactPattern.lastIndex = 0 // Reset regex
  while ((match = noContactPattern.exec(fullLine)) !== null) {
    if (match[1] && !existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: { type: 'contact-no', address: match[1] }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found NO contact:', match[1])
    }
  }

  // Find all SET coils (check before standard coils)
  setCoilPattern.lastIndex = 0
  while ((match = setCoilPattern.exec(fullLine)) !== null) {
    if (match[1] && !existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: { type: 'coil-set', address: match[1] }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found SET coil:', match[1])
    }
  }

  // Find all RESET coils (check before standard coils)
  resetCoilPattern.lastIndex = 0
  while ((match = resetCoilPattern.exec(fullLine)) !== null) {
    if (match[1] && !existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: { type: 'coil-reset', address: match[1] }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found RESET coil:', match[1])
    }
  }

  // Find all standard coils
  coilPattern.lastIndex = 0 // Reset regex
  while ((match = coilPattern.exec(fullLine)) !== null) {
    if (match[1] && !existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: { type: 'coil', address: match[1] }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found coil:', match[1])
    }
  }

  // Find all timers
  timerPattern.lastIndex = 0 // Reset regex
  while ((match = timerPattern.exec(fullLine)) !== null) {
    if (match[1]) {
      const preset = match[2] ? parseInt(match[2]) : 0
      foundElements.push({
        pos: match.index,
        element: { type: 'timer', address: match[1], preset }
      })
      if (DEBUG) console.log('[Parser] Found timer:', match[1], preset)
    }
  }

  // Comparison operators: [ operand > value ] or [ operand >= value ]
  const comparePattern = /\[\s*([A-Z]\w*)\s*(>|<|==|>=|<=|!=)\s*([\d.]+)\s*\]/g
  comparePattern.lastIndex = 0
  while ((match = comparePattern.exec(fullLine)) !== null) {
    if (!existingPositions.has(match.index)) {
      const operand1 = match[1]
      const operator = match[2]
      const value = parseFloat(match[3])

      let type: LadderElement['type'] = 'compare-eq'
      if (operator === '>') type = 'compare-gt'
      else if (operator === '<') type = 'compare-lt'
      else if (operator === '==') type = 'compare-eq'
      else if (operator === '>=') type = 'compare-ge'
      else if (operator === '<=') type = 'compare-le'
      else if (operator === '!=') type = 'compare-ne'

      foundElements.push({
        pos: match.index,
        element: { type, operand1, value }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found comparison:', operand1, operator, value)
    }
  }

  // Math operations: [ ADD op1 op2 => result ] or [ MUL op1 op2 => result ]
  const mathPattern = /\[\s*(ADD|SUB|MUL|DIV)\s+([A-Z]\w*)\s+([A-Z]\w*|\d+\.?\d*)\s*=>\s*([A-Z]\w*)\s*\]/g
  mathPattern.lastIndex = 0
  while ((match = mathPattern.exec(fullLine)) !== null) {
    if (!existingPositions.has(match.index)) {
      const operation = match[1]
      const operand1 = match[2]
      const operand2 = match[3]
      const result = match[4]

      let type: LadderElement['type'] = 'math-add'
      if (operation === 'ADD') type = 'math-add'
      else if (operation === 'SUB') type = 'math-sub'
      else if (operation === 'MUL') type = 'math-mul'
      else if (operation === 'DIV') type = 'math-div'

      // Check if operand2 is a number or address
      const op2IsNumber = /^\d+\.?\d*$/.test(operand2)

      foundElements.push({
        pos: match.index,
        element: {
          type,
          operand1,
          operand2: op2IsNumber ? undefined : operand2,
          value: op2IsNumber ? parseFloat(operand2) : undefined,
          result
        }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found math operation:', operation, operand1, operand2, '=>', result)
    }
  }

  // MOVE operation: [ MOVE source => dest ]
  const movePattern = /\[\s*MOVE\s+([A-Z]\w*|\d+\.?\d*)\s*=>\s*([A-Z]\w*)\s*\]/g
  movePattern.lastIndex = 0
  while ((match = movePattern.exec(fullLine)) !== null) {
    if (!existingPositions.has(match.index)) {
      const source = match[1]
      const dest = match[2]

      const sourceIsNumber = /^\d+\.?\d*$/.test(source)

      foundElements.push({
        pos: match.index,
        element: {
          type: 'move',
          operand1: sourceIsNumber ? undefined : source,
          value: sourceIsNumber ? parseFloat(source) : undefined,
          result: dest
        }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found MOVE:', source, '=>', dest)
    }
  }

  // PID: [ PID pv=AI0.0 sp=MW0 kp=1.0 ki=0.1 kd=0.01 => AQ0.0 ]
  const pidPattern = /\[\s*PID\s+pv=([A-Z]\w*)\s+sp=([A-Z]\w*)\s+kp=([\d.]+)\s+ki=([\d.]+)\s+kd=([\d.]+)\s*=>\s*([A-Z]\w*)\s*\]/g
  pidPattern.lastIndex = 0
  while ((match = pidPattern.exec(fullLine)) !== null) {
    if (!existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: {
          type: 'pid',
          operand1: match[1],  // process variable
          setpoint: match[2],
          kp: parseFloat(match[3]),
          ki: parseFloat(match[4]),
          kd: parseFloat(match[5]),
          result: match[6]
        }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found PID:', match[1], '=>', match[6])
    }
  }

  // FILTER_AVG: [ FILTER_AVG AI0.0 samples=10 => MW0 ]
  const filterPattern = /\[\s*FILTER_AVG\s+([A-Z]\w*)\s+samples=(\d+)\s*=>\s*([A-Z]\w*)\s*\]/g
  filterPattern.lastIndex = 0
  while ((match = filterPattern.exec(fullLine)) !== null) {
    if (!existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: {
          type: 'filter-avg',
          operand1: match[1],  // input
          samples: parseInt(match[2]),
          result: match[3]
        }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found FILTER_AVG:', match[1], '=>', match[3])
    }
  }

  // SCALE: [ SCALE AI0.0 in=0-100 out=0-1000 => MW0 ]
  const scalePattern = /\[\s*SCALE\s+([A-Z]\w*)\s+in=([\d.]+)-([\d.]+)\s+out=([\d.]+)-([\d.]+)\s*=>\s*([A-Z]\w*)\s*\]/g
  scalePattern.lastIndex = 0
  while ((match = scalePattern.exec(fullLine)) !== null) {
    if (!existingPositions.has(match.index)) {
      foundElements.push({
        pos: match.index,
        element: {
          type: 'scale',
          operand1: match[1],  // input
          inMin: parseFloat(match[2]),
          inMax: parseFloat(match[3]),
          outMin: parseFloat(match[4]),
          outMax: parseFloat(match[5]),
          result: match[6]
        }
      })
      existingPositions.add(match.index)
      if (DEBUG) console.log('[Parser] Found SCALE:', match[1], '=>', match[6])
    }
  }

  // Sort by position to maintain left-to-right order
  foundElements.sort((a, b) => a.pos - b.pos)
  return foundElements.map(e => e.element)
}

function autoDetectIO(address: string): IOMapping | null {
  if (!address) return null

  let type: IOMapping['type']
  let name: string

  // Digital Input (I0.0 format)
  if (address.match(/^I\d+\.\d+$/)) {
    type = 'DI'
    name = `Input_${address.replace('.', '_')}`
  }
  // Analog Input (AI0.0 format)
  else if (address.match(/^AI\d+\.\d+$/)) {
    type = 'AI'
    name = `AnalogInput_${address.replace('.', '_')}`
  }
  // Digital Output (Q0.0 format)
  else if (address.match(/^Q\d+\.\d+$/)) {
    type = 'DO'
    name = `Output_${address.replace('.', '_')}`
  }
  // Analog Output (AQ0.0 format)
  else if (address.match(/^AQ\d+\.\d+$/)) {
    type = 'AO'
    name = `AnalogOutput_${address.replace('.', '_')}`
  }
  // Memory Word (MW0 format for INT/REAL)
  else if (address.match(/^MW\d+$/)) {
    type = 'M'
    name = `MemoryWord_${address}`
  }
  // Memory Bit (M0.0 format)
  else if (address.match(/^M\d+\.\d+$/)) {
    type = 'M'
    name = `Memory_${address.replace('.', '_')}`
  }
  else {
    return null
  }

  return { address, name, type }
}

function parseLadderLine(line: string): LadderElement[] {
  const elements: LadderElement[] = []

  // Match contacts: [ I0.0 ] or [/I0.1 ]
  const contactRegex = /\[\s*([\/]?)([IQM]\d+\.\d+)\s*\]/g
  let match
  while ((match = contactRegex.exec(line)) !== null) {
    elements.push({
      type: match[1] === '/' ? 'contact-nc' : 'contact-no',
      address: match[2]
    })
  }

  // Match coils: ( Q0.0 )
  const coilRegex = /\(\s*([IQM]\d+\.\d+)\s*\)/g
  while ((match = coilRegex.exec(line)) !== null) {
    elements.push({
      type: 'coil',
      address: match[1]
    })
  }

  // Match timers: [TON T1, 5000ms]
  const timerRegex = /\[TON\s+(\w+),\s*(\d+)ms\]/g
  while ((match = timerRegex.exec(line)) !== null) {
    elements.push({
      type: 'timer',
      address: match[1],
      preset: parseInt(match[2])
    })
  }

  return elements
}

function parseIOLine(line: string): IOMapping | null {
  const match = line.match(/([IQM]\d+\.\d+)\s*-\s*(.+)/)
  if (!match) return null

  const address = match[1]
  const name = match[2].trim()

  let type: IOMapping['type'] = 'M'
  if (address.startsWith('I')) type = 'DI'
  else if (address.startsWith('Q')) type = 'DO'

  return { address, name, type }
}

export function generateLadderSVG(program: LadderProgram, activeStates?: Record<string, boolean>): string {
  const leftRail = 60
  const rightRail = 740
  const rungHeight = 120
  const elementWidth = 80
  const height = Math.max(program.networks.length * rungHeight + 120, 300)

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 ${height}" style="width: 100%; height: auto; background: #1a1a1a;">`
  svg += `<style>
    .grid-pattern { stroke: #2a2a2a; stroke-width: 0.5; opacity: 0.3; }
    .rail { stroke: #60a5fa; stroke-width: 4; filter: drop-shadow(0 0 2px #3b82f6); }
    .rung { stroke: #6b7280; stroke-width: 2.5; }
    .rung-active { stroke: #10b981; stroke-width: 3; filter: drop-shadow(0 0 4px #10b981); }
    .contact { fill: none; stroke: #3b82f6; stroke-width: 3; }
    .contact-active { fill: none; stroke: #10b981; stroke-width: 4; filter: drop-shadow(0 0 6px #10b981); }
    .contact-nc { fill: none; stroke: #3b82f6; stroke-width: 3; }
    .contact-nc-active { fill: none; stroke: #10b981; stroke-width: 4; filter: drop-shadow(0 0 6px #10b981); }
    .coil { fill: none; stroke: #ef4444; stroke-width: 3; }
    .coil-active { fill: #10b981; stroke: #10b981; stroke-width: 4; filter: drop-shadow(0 0 8px #10b981); }
    .timer { fill: #1e293b; stroke: #8b5cf6; stroke-width: 2.5; }
    .timer-active { fill: #1e293b; stroke: #10b981; stroke-width: 3; filter: drop-shadow(0 0 6px #10b981); }
    .label { fill: #cbd5e1; font-family: 'Courier New', monospace; font-size: 14px; font-weight: bold; }
    .address { fill: #f1f5f9; font-family: 'Courier New', monospace; font-size: 12px; text-anchor: middle; }
    .network-num { fill: #94a3b8; font-family: 'Courier New', monospace; font-size: 11px; font-weight: bold; }
    .rail-label { fill: #60a5fa; font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; }
  </style>`

  // Draw grid pattern
  for (let x = 0; x < 800; x += 40) {
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${height}" class="grid-pattern"/>`
  }
  for (let y = 0; y < height; y += 40) {
    svg += `<line x1="0" y1="${y}" x2="800" y2="${y}" class="grid-pattern"/>`
  }

  // Draw left and right power rails
  svg += `<line x1="${leftRail}" y1="30" x2="${leftRail}" y2="${height - 30}" class="rail"/>`
  svg += `<line x1="${rightRail}" y1="30" x2="${rightRail}" y2="${height - 30}" class="rail"/>`

  // Rail labels
  svg += `<text x="${leftRail}" y="20" class="rail-label" text-anchor="middle">L+</text>`
  svg += `<text x="${rightRail}" y="20" class="rail-label" text-anchor="middle">L-</text>`

  // Check if program has any networks
  if (program.networks.length === 0) {
    svg += `<text x="400" y="150" class="label" text-anchor="middle" style="opacity: 0.5;">No Ladder Logic Detected</text>`
    svg += `<text x="400" y="180" class="address" text-anchor="middle" style="opacity: 0.5;">Ask AI to generate ladder logic</text>`
  }

  // Draw each network
  program.networks.forEach((network, idx) => {
    const y = 70 + idx * rungHeight

    // Network number
    svg += `<text x="25" y="${y + 5}" class="network-num">N${network.id}</text>`

    // Network label
    if (network.label) {
      svg += `<text x="75" y="${y - 20}" class="label">${escapeXml(network.label)}</text>`
    }

    // Determine if rung is active
    let rungActive = false
    if (activeStates) {
      // Check if any element in this rung is active
      rungActive = network.elements.some(el => activeStates[el.address || ''])
    }

    // Draw horizontal rung from left rail
    const rungClass = rungActive ? 'rung-active' : 'rung'
    svg += `<line x1="${leftRail}" y1="${y}" x2="${leftRail + 25}" y2="${y}" class="${rungClass}"/>`

    const hasElements = network.elements.length > 0

    if (!hasElements) {
      // Empty rung - just draw dashed line
      svg += `<line x1="${leftRail + 20}" y1="${y}" x2="${rightRail}" y2="${y}" class="rung" stroke-dasharray="5,5"/>`
      svg += `<text x="400" y="${y + 5}" class="address" style="opacity: 0.5;">Empty Network</text>`
    } else {
      // Separate contacts and outputs
      const contacts = network.elements.filter(e => e.type === 'contact-no' || e.type === 'contact-nc')
      const outputs = network.elements.filter(e => e.type === 'coil' || e.type === 'timer' || e.type === 'counter')

      // Calculate positions
      let currentX = leftRail + 25

      // Draw contacts from left
      contacts.forEach((element) => {
        const isActive = activeStates?.[element.address || ''] || false

        if (element.type === 'contact-no') {
          const contactClass = isActive ? 'contact-active' : 'contact'
          svg += `<line x1="${currentX}" y1="${y}" x2="${currentX + 15}" y2="${y}" class="${contactClass}"/>`
          svg += `<line x1="${currentX + 15}" y1="${y - 15}" x2="${currentX + 15}" y2="${y + 15}" class="${contactClass}"/>`
          svg += `<line x1="${currentX + 55}" y1="${y - 15}" x2="${currentX + 55}" y2="${y + 15}" class="${contactClass}"/>`
          svg += `<line x1="${currentX + 55}" y1="${y}" x2="${currentX + 70}" y2="${y}" class="${contactClass}"/>`
          svg += `<text x="${currentX + 35}" y="${y + 30}" class="address">${escapeXml(element.address || '')}</text>`
          currentX += elementWidth
        } else if (element.type === 'contact-nc') {
          const contactClass = isActive ? 'contact-nc-active' : 'contact-nc'
          svg += `<line x1="${currentX}" y1="${y}" x2="${currentX + 15}" y2="${y}" class="${contactClass}"/>`
          svg += `<line x1="${currentX + 15}" y1="${y - 15}" x2="${currentX + 15}" y2="${y + 15}" class="${contactClass}"/>`
          svg += `<line x1="${currentX + 55}" y1="${y - 15}" x2="${currentX + 55}" y2="${y + 15}" class="${contactClass}"/>`
          svg += `<line x1="${currentX + 25}" y1="${y - 12}" x2="${currentX + 45}" y2="${y + 12}" class="${contactClass}"/>`
          svg += `<line x1="${currentX + 55}" y1="${y}" x2="${currentX + 70}" y2="${y}" class="${contactClass}"/>`
          svg += `<text x="${currentX + 35}" y="${y + 30}" class="address">${escapeXml(element.address || '')}</text>`
          currentX += elementWidth
        }
      })

      // Calculate output start position (right-aligned)
      const outputTotalWidth = outputs.length * elementWidth
      const outputStartX = Math.max(currentX + 40, rightRail - outputTotalWidth - 25)

      // Draw connecting line from contacts to outputs
      if (outputs.length > 0) {
        svg += `<line x1="${currentX}" y1="${y}" x2="${outputStartX}" y2="${y}" class="${rungClass}"/>`
        currentX = outputStartX
      } else {
        // No outputs, connect to right rail
        svg += `<line x1="${currentX}" y1="${y}" x2="${rightRail}" y2="${y}" class="${rungClass}"/>`
        currentX = rightRail
      }

      // Draw outputs (right-aligned)
      outputs.forEach((element) => {
        const isActive = activeStates?.[element.address || ''] || false

        if (element.type === 'coil') {
          const coilClass = isActive ? 'coil-active' : 'coil'
          svg += `<line x1="${currentX}" y1="${y}" x2="${currentX + 20}" y2="${y}" class="${coilClass}"/>`
          svg += `<circle cx="${currentX + 35}" cy="${y}" r="15" class="${coilClass}"/>`
          svg += `<line x1="${currentX + 50}" y1="${y}" x2="${currentX + 70}" y2="${y}" class="${coilClass}"/>`
          svg += `<text x="${currentX + 35}" y="${y + 30}" class="address">${escapeXml(element.address || '')}</text>`
          currentX += elementWidth
        } else if (element.type === 'timer') {
          const timerClass = isActive ? 'timer-active' : 'timer'
          svg += `<line x1="${currentX}" y1="${y}" x2="${currentX + 10}" y2="${y}" class="${timerClass}"/>`
          svg += `<rect x="${currentX + 10}" y="${y - 18}" width="50" height="36" class="${timerClass}" rx="3"/>`
          svg += `<text x="${currentX + 35}" y="${y + 5}" class="address" style="font-size: 9px;">TON</text>`
          svg += `<line x1="${currentX + 60}" y1="${y}" x2="${currentX + 70}" y2="${y}" class="${timerClass}"/>`
          svg += `<text x="${currentX + 35}" y="${y + 30}" class="address">${escapeXml(element.address || '')}</text>`
          if (element.preset) {
            svg += `<text x="${currentX + 35}" y="${y + 42}" class="address" style="font-size: 9px;">${element.preset}ms</text>`
          }
          currentX += elementWidth
        }
      })

      // Final connection to right rail
      if (outputs.length > 0) {
        svg += `<line x1="${currentX}" y1="${y}" x2="${rightRail}" y2="${y}" class="${rungClass}"/>`
      }
    }
  })

  svg += '</svg>'
  return svg
}

function escapeXml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}