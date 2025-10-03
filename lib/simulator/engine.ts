// PLC Runtime Simulator
import type { LadderProgram, LadderElement, LadderRung } from '@/lib/ladder/parser'
import { ModbusRegisterMap } from '@/lib/modbus/register-map'
import { ModbusServer } from '@/lib/modbus/server'

const DEBUG = process.env.NODE_ENV === 'development'

export interface SimulatorState {
  inputs: Record<string, boolean>  // Digital inputs (I0.0)
  outputs: Record<string, boolean>  // Digital outputs (Q0.0)
  memory: Record<string, boolean>  // Memory bits (M0.0)
  analogInputs: Record<string, number>  // Analog inputs (AI0.0)
  analogOutputs: Record<string, number>  // Analog outputs (AQ0.0)
  memoryWords: Record<string, number>  // Memory words (MW0)
  timers: Record<string, { running: boolean; elapsed: number; preset: number; done: boolean }>
  counters: Record<string, { count: number; preset: number; done: boolean }>
  // Function block states
  pidStates: Record<string, { integral: number; lastError: number; lastTime: number }>
  filterBuffers: Record<string, number[]>  // Circular buffers for filters
  isRunning: boolean
  scanTime: number
  cycleCount: number
}

export class PLCSimulator {
  private program: LadderProgram
  private state: SimulatorState
  private intervalId: NodeJS.Timeout | null = null
  private scanCycleMs: number = 10 // 10ms scan cycle (100Hz)

  // Modbus integration
  private modbusRegisterMap: ModbusRegisterMap
  private modbusServer: ModbusServer
  private modbusEnabled: boolean = false

  constructor(program: LadderProgram) {
    this.program = program
    this.state = {
      inputs: {},
      outputs: {},
      memory: {},
      analogInputs: {},
      analogOutputs: {},
      memoryWords: {},
      timers: {},
      counters: {},
      pidStates: {},
      filterBuffers: {},
      isRunning: false,
      scanTime: 0,
      cycleCount: 0
    }

    // Initialize I/O from program
    this.initializeIO()

    // Initialize Modbus
    this.modbusRegisterMap = new ModbusRegisterMap()
    this.modbusServer = new ModbusServer(this.modbusRegisterMap)
    this.initializeModbus()

    if (DEBUG) {
      console.log('[Simulator] Initialized with:', {
        inputs: Object.keys(this.state.inputs),
        outputs: Object.keys(this.state.outputs),
        analogInputs: Object.keys(this.state.analogInputs),
        memoryWords: Object.keys(this.state.memoryWords),
        networks: this.program.networks.length,
        modbusEnabled: this.modbusEnabled
      })
    }
  }

  private initializeIO() {
    // Initialize from I/O map
    this.program.ioMap.forEach(io => {
      if (io.type === 'DI') {
        this.state.inputs[io.address] = false
      } else if (io.type === 'DO') {
        this.state.outputs[io.address] = false
      } else if (io.type === 'AI') {
        this.state.analogInputs[io.address] = 0
      } else if (io.type === 'AO') {
        this.state.analogOutputs[io.address] = 0
      } else if (io.type === 'M') {
        // Check if it's memory word (MW0) or bit (M0.0)
        if (io.address.match(/^MW\d+$/)) {
          this.state.memoryWords[io.address] = 0
        } else {
          this.state.memory[io.address] = false
        }
      }
    })

    // Also scan all ladder elements to ensure all I/O is initialized
    this.program.networks.forEach(network => {
      network.elements.forEach(element => {
        // Initialize from operand1, operand2, result
        const addresses = [element.address, element.operand1, element.operand2, element.result].filter(Boolean) as string[]

        addresses.forEach(addr => {
          if (addr.match(/^I\d+\.\d+$/) && !(addr in this.state.inputs)) {
            this.state.inputs[addr] = false
          } else if (addr.match(/^AI\d+\.\d+$/) && !(addr in this.state.analogInputs)) {
            this.state.analogInputs[addr] = 0
          } else if (addr.match(/^Q\d+\.\d+$/) && !(addr in this.state.outputs)) {
            this.state.outputs[addr] = false
          } else if (addr.match(/^AQ\d+\.\d+$/) && !(addr in this.state.analogOutputs)) {
            this.state.analogOutputs[addr] = 0
          } else if (addr.match(/^MW\d+$/) && !(addr in this.state.memoryWords)) {
            this.state.memoryWords[addr] = 0
          } else if (addr.match(/^M\d+\.\d+$/) && !(addr in this.state.memory)) {
            this.state.memory[addr] = false
          }
        })
      })
    })
  }

  start() {
    if (this.state.isRunning) return

    this.state.isRunning = true
    this.intervalId = setInterval(() => {
      this.executeScanCycle()
    }, this.scanCycleMs)
  }

  stop() {
    this.state.isRunning = false
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
  }

  reset() {
    this.stop()
    this.state = {
      inputs: {},
      outputs: {},
      memory: {},
      analogInputs: {},
      analogOutputs: {},
      memoryWords: {},
      timers: {},
      counters: {},
      pidStates: {},
      filterBuffers: {},
      isRunning: false,
      scanTime: 0,
      cycleCount: 0
    }
    this.initializeIO()
  }

  setInput(address: string, value: boolean | number) {
    if (typeof value === 'boolean') {
      this.state.inputs[address] = value
    } else {
      // Analog input
      this.state.analogInputs[address] = value
    }
  }

  getOutput(address: string): boolean {
    return this.state.outputs[address] || false
  }

  getAnalogValue(address: string): number {
    if (address in this.state.analogInputs) return this.state.analogInputs[address]
    if (address in this.state.analogOutputs) return this.state.analogOutputs[address]
    if (address in this.state.memoryWords) return this.state.memoryWords[address]
    return 0
  }

  setAnalogValue(address: string, value: number) {
    if (address.match(/^AI\d+\.\d+$/)) {
      this.state.analogInputs[address] = value
    } else if (address.match(/^AQ\d+\.\d+$/)) {
      this.state.analogOutputs[address] = value
    } else if (address.match(/^MW\d+$/)) {
      this.state.memoryWords[address] = value
    }
  }

  getState(): SimulatorState {
    return { ...this.state }
  }

  private executeScanCycle() {
    const startTime = performance.now()

    // Sync Modbus inputs to PLC (read from Modbus registers)
    if (this.modbusEnabled) {
      this.syncModbusToPLC()
    }

    // Execute each network/rung in order
    this.program.networks.forEach(network => {
      this.executeRung(network)
    })

    // Update timers
    this.updateTimers()

    // Sync PLC outputs to Modbus (write to Modbus registers)
    if (this.modbusEnabled) {
      this.syncPLCToModbus()
    }

    // Update scan time and cycle count
    this.state.scanTime = performance.now() - startTime
    this.state.cycleCount++
  }

  private executeRung(rung: LadderRung) {
    if (DEBUG) console.log(`[Simulator] Executing rung ${rung.id}: ${rung.label || 'No label'}`)

    // Check if this rung has parallel branches (OR logic)
    if (rung.branches && rung.branches.length > 0) {
      this.executeParallelBranches(rung)
      return
    }

    // Legacy single branch execution (AND logic)
    let rungCondition = true
    let lastContactResult = true

    for (let i = 0; i < rung.elements.length; i++) {
      const element = rung.elements[i]

      switch (element.type) {
        case 'contact-no':
          lastContactResult = this.evaluateContact(element.address!, false)
          rungCondition = rungCondition && lastContactResult
          if (DEBUG) console.log(`  NO Contact ${element.address}: ${lastContactResult} -> Rung: ${rungCondition}`)
          break

        case 'contact-nc':
          lastContactResult = this.evaluateContact(element.address!, true)
          rungCondition = rungCondition && lastContactResult
          if (DEBUG) console.log(`  NC Contact ${element.address}: ${lastContactResult} -> Rung: ${rungCondition}`)
          break

        case 'coil':
          if (element.address) {
            this.setCoil(element.address, rungCondition)
            if (DEBUG) console.log(`  Coil ${element.address} set to: ${rungCondition}`)
          }
          break

        case 'coil-set':
          if (element.address && rungCondition) {
            this.setCoil(element.address, true)
            if (DEBUG) console.log(`  SET Coil ${element.address} latched ON`)
          }
          break

        case 'coil-reset':
          if (element.address && rungCondition) {
            this.setCoil(element.address, false)
            if (DEBUG) console.log(`  RESET Coil ${element.address} forced OFF`)
          }
          break

        case 'timer':
          if (element.address && element.preset) {
            this.executeTimer(element.address, element.preset, rungCondition)
            if (DEBUG) {
              const timerDone = this.state.timers[element.address]?.done || false
              console.log(`  Timer ${element.address}: enabled=${rungCondition}, done=${timerDone}`)
            }
          }
          break

        case 'counter':
          if (element.address && element.preset) {
            this.executeCounter(element.address, element.preset, rungCondition)
          }
          break

        // Comparison operators
        case 'compare-gt':
        case 'compare-lt':
        case 'compare-eq':
        case 'compare-ge':
        case 'compare-le':
        case 'compare-ne':
          if (element.operand1 && element.value !== undefined) {
            const result = this.evaluateComparison(element.type, element.operand1, element.value)
            rungCondition = rungCondition && result
            if (DEBUG) console.log(`  Comparison ${element.operand1} ${element.type} ${element.value}: ${result}`)
          }
          break

        // Math operations
        case 'math-add':
        case 'math-sub':
        case 'math-mul':
        case 'math-div':
          if (rungCondition && element.operand1 && element.result) {
            this.executeMathOperation(element.type, element.operand1, element.operand2, element.value, element.result)
          }
          break

        case 'move':
          if (rungCondition && element.result) {
            const sourceValue = element.operand1 ? this.getAnalogValue(element.operand1) : (element.value || 0)
            this.setAnalogValue(element.result, sourceValue)
            if (DEBUG) console.log(`  MOVE ${sourceValue} => ${element.result}`)
          }
          break
      }
    }
  }

  private evaluateComparison(type: string, operand1: string, value: number): boolean {
    const op1Value = this.getAnalogValue(operand1)

    switch (type) {
      case 'compare-gt': return op1Value > value
      case 'compare-lt': return op1Value < value
      case 'compare-eq': return op1Value === value
      case 'compare-ge': return op1Value >= value
      case 'compare-le': return op1Value <= value
      case 'compare-ne': return op1Value !== value
      default: return false
    }
  }

  private executeMathOperation(
    type: string,
    operand1: string,
    operand2: string | undefined,
    value: number | undefined,
    result: string
  ) {
    const op1 = this.getAnalogValue(operand1)
    const op2 = operand2 ? this.getAnalogValue(operand2) : (value || 0)

    let resultValue = 0

    switch (type) {
      case 'math-add':
        resultValue = op1 + op2
        break
      case 'math-sub':
        resultValue = op1 - op2
        break
      case 'math-mul':
        resultValue = op1 * op2
        break
      case 'math-div':
        resultValue = op2 !== 0 ? op1 / op2 : 0
        break
    }

    this.setAnalogValue(result, resultValue)
    if (DEBUG) console.log(`  Math: ${op1} ${type} ${op2} => ${result} = ${resultValue}`)
  }

  private evaluateContact(address: string, isNC: boolean): boolean {
    let value = false

    // Check for done bit syntax: "[ T1.DN ]" or "T1.DN"
    const doneBitMatch = address.match(/^\[?\s*([TCD]\w*)\.DN\s*\]?$/)
    if (doneBitMatch) {
      const timerOrCounterName = doneBitMatch[1]
      if (timerOrCounterName in this.state.timers) {
        value = this.state.timers[timerOrCounterName].done
      } else if (timerOrCounterName in this.state.counters) {
        value = this.state.counters[timerOrCounterName].done
      }
      return isNC ? !value : value
    }

    // Check all possible sources
    if (address in this.state.inputs) {
      value = this.state.inputs[address]
    } else if (address in this.state.outputs) {
      value = this.state.outputs[address]
    } else if (address in this.state.memory) {
      value = this.state.memory[address]
    } else if (address in this.state.timers) {
      value = this.state.timers[address].done
    } else if (address in this.state.counters) {
      value = this.state.counters[address].done
    }

    return isNC ? !value : value
  }

  private setCoil(address: string, value: boolean) {
    if (address.startsWith('Q')) {
      this.state.outputs[address] = value
    } else if (address.startsWith('M')) {
      this.state.memory[address] = value
    }
  }

  private executeTimer(address: string, preset: number, enable: boolean) {
    if (!this.state.timers[address]) {
      this.state.timers[address] = {
        running: false,
        elapsed: 0,
        preset,
        done: false
      }
    }

    const timer = this.state.timers[address]

    if (enable) {
      timer.running = true
      timer.elapsed += this.scanCycleMs

      if (timer.elapsed >= preset) {
        timer.done = true
        timer.elapsed = preset
      }
    } else {
      // Reset timer when disabled
      timer.running = false
      timer.elapsed = 0
      timer.done = false
    }
  }

  private executeCounter(address: string, preset: number, countUp: boolean) {
    if (!this.state.counters[address]) {
      this.state.counters[address] = {
        count: 0,
        preset,
        done: false
      }
    }

    const counter = this.state.counters[address]

    // Count on rising edge
    if (countUp && counter.count < preset) {
      counter.count++
    }

    counter.done = counter.count >= preset
  }

  private updateTimers() {
    Object.values(this.state.timers).forEach(timer => {
      if (timer.running && !timer.done) {
        timer.elapsed += this.scanCycleMs
        if (timer.elapsed >= timer.preset) {
          timer.done = true
          timer.elapsed = timer.preset
        }
      }
    })
  }

  // Execute parallel branches with OR logic
  private executeParallelBranches(rung: LadderRung) {
    if (!rung.branches || rung.branches.length === 0) return

    if (DEBUG) console.log(`[Simulator] Executing ${rung.branches.length} parallel branches (OR logic)`)

    // Evaluate each branch independently
    const branchResults: boolean[] = []
    const outputElements: Array<{element: LadderElement, condition: boolean}> = []

    rung.branches.forEach((branch, branchIdx) => {
      let branchCondition = true

      if (DEBUG) console.log(`  Branch ${branchIdx + 1}:`)

      for (const element of branch) {
        switch (element.type) {
          case 'contact-no':
            const noResult = this.evaluateContact(element.address!, false)
            branchCondition = branchCondition && noResult
            if (DEBUG) console.log(`    NO Contact ${element.address}: ${noResult} -> Branch: ${branchCondition}`)
            break

          case 'contact-nc':
            const ncResult = this.evaluateContact(element.address!, true)
            branchCondition = branchCondition && ncResult
            if (DEBUG) console.log(`    NC Contact ${element.address}: ${ncResult} -> Branch: ${branchCondition}`)
            break

          // Comparison operators
          case 'compare-gt':
          case 'compare-lt':
          case 'compare-eq':
          case 'compare-ge':
          case 'compare-le':
          case 'compare-ne':
            if (element.operand1 && element.value !== undefined) {
              const result = this.evaluateComparison(element.type, element.operand1, element.value)
              branchCondition = branchCondition && result
              if (DEBUG) console.log(`    Comparison ${element.operand1} ${element.type} ${element.value}: ${result}`)
            }
            break

          // Outputs - collect for later execution with OR'd condition
          case 'coil':
          case 'coil-set':
          case 'coil-reset':
          case 'timer':
          case 'counter':
          case 'math-add':
          case 'math-sub':
          case 'math-mul':
          case 'math-div':
          case 'move':
            outputElements.push({element, condition: branchCondition})
            break
        }
      }

      branchResults.push(branchCondition)
    })

    // Combine branch results with OR logic
    const finalCondition = branchResults.some(result => result)
    if (DEBUG) console.log(`  OR Result: ${branchResults.join(' OR ')} = ${finalCondition}`)

    // Execute all output elements with the OR'd condition
    outputElements.forEach(({element, condition}) => {
      switch (element.type) {
        case 'coil':
          if (element.address) {
            this.setCoil(element.address, finalCondition)
            if (DEBUG) console.log(`  Coil ${element.address} set to: ${finalCondition}`)
          }
          break

        case 'coil-set':
          if (element.address && finalCondition) {
            this.setCoil(element.address, true)
            if (DEBUG) console.log(`  SET Coil ${element.address} latched ON`)
          }
          break

        case 'coil-reset':
          if (element.address && finalCondition) {
            this.setCoil(element.address, false)
            if (DEBUG) console.log(`  RESET Coil ${element.address} forced OFF`)
          }
          break

        case 'timer':
          if (element.address && element.preset) {
            this.executeTimer(element.address, element.preset, finalCondition)
          }
          break

        case 'counter':
          if (element.address && element.preset) {
            this.executeCounter(element.address, element.preset, finalCondition)
          }
          break

        case 'math-add':
        case 'math-sub':
        case 'math-mul':
        case 'math-div':
          if (finalCondition && element.operand1 && element.result) {
            this.executeMathOperation(element.type, element.operand1, element.operand2, element.value, element.result)
          }
          break

        case 'move':
          if (finalCondition && element.result) {
            const sourceValue = element.operand1 ? this.getAnalogValue(element.operand1) : (element.value || 0)
            this.setAnalogValue(element.result, sourceValue)
          }
          break
      }
    })
  }

  // Modbus integration methods
  private initializeModbus(): void {
    // Auto-map PLC I/O to Modbus registers
    const digitalInputs = Object.keys(this.state.inputs)
    const digitalOutputs = Object.keys(this.state.outputs)
    const analogInputs = Object.keys(this.state.analogInputs)
    const analogOutputs = Object.keys(this.state.analogOutputs)

    this.modbusRegisterMap.autoMapFromPLC(
      1, // Device ID
      digitalInputs,
      digitalOutputs,
      analogInputs,
      analogOutputs
    )

    if (DEBUG) {
      console.log('[Modbus] Register map initialized:', {
        digitalInputs: digitalInputs.length,
        digitalOutputs: digitalOutputs.length,
        analogInputs: analogInputs.length,
        analogOutputs: analogOutputs.length
      })
    }
  }

  private syncModbusToPLC(): void {
    // Read Modbus coils and update PLC outputs
    Object.keys(this.state.outputs).forEach(plcAddr => {
      // Modbus coils can write to PLC outputs
      const registers = this.modbusRegisterMap.getDeviceRegisters(1)
      const register = registers.find(r => r.plcAddress === plcAddr && r.type === 'coil')
      if (register) {
        this.state.outputs[plcAddr] = register.value === 1
      }
    })

    // Read Modbus holding registers and update analog outputs
    Object.keys(this.state.analogOutputs).forEach(plcAddr => {
      const registers = this.modbusRegisterMap.getDeviceRegisters(1)
      const register = registers.find(r => r.plcAddress === plcAddr && r.type === 'holding-register')
      if (register) {
        this.state.analogOutputs[plcAddr] = register.value
      }
    })
  }

  private syncPLCToModbus(): void {
    // Write PLC inputs to Modbus discrete inputs
    Object.keys(this.state.inputs).forEach(plcAddr => {
      const value = this.state.inputs[plcAddr] ? 1 : 0
      this.modbusRegisterMap.updateRegisterFromPLC(1, plcAddr, value)
    })

    // Write PLC outputs to Modbus coils
    Object.keys(this.state.outputs).forEach(plcAddr => {
      const value = this.state.outputs[plcAddr] ? 1 : 0
      this.modbusRegisterMap.updateRegisterFromPLC(1, plcAddr, value)
    })

    // Write analog inputs to Modbus input registers
    Object.keys(this.state.analogInputs).forEach(plcAddr => {
      const value = this.state.analogInputs[plcAddr]
      this.modbusRegisterMap.updateRegisterFromPLC(1, plcAddr, value)
    })

    // Write analog outputs to Modbus holding registers
    Object.keys(this.state.analogOutputs).forEach(plcAddr => {
      const value = this.state.analogOutputs[plcAddr]
      this.modbusRegisterMap.updateRegisterFromPLC(1, plcAddr, value)
    })
  }

  // Public Modbus API
  enableModbus(): void {
    this.modbusEnabled = true
    this.modbusServer.start()
    if (DEBUG) console.log('[Modbus] Enabled')
  }

  disableModbus(): void {
    this.modbusEnabled = false
    this.modbusServer.stop()
    if (DEBUG) console.log('[Modbus] Disabled')
  }

  isModbusEnabled(): boolean {
    return this.modbusEnabled
  }

  getModbusServer(): ModbusServer {
    return this.modbusServer
  }

  getModbusRegisterMap(): ModbusRegisterMap {
    return this.modbusRegisterMap
  }
}