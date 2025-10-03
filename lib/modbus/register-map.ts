// Modbus Register Mapping System
// Simulates Modbus TCP/RTU registers for PLC integration

export type ModbusRegisterType =
  | 'coil'              // Read/Write bit (FC01, FC05, FC15)
  | 'discrete-input'    // Read-only bit (FC02)
  | 'holding-register'  // Read/Write 16-bit word (FC03, FC06, FC16)
  | 'input-register'    // Read-only 16-bit word (FC04)

export interface ModbusRegister {
  address: number
  type: ModbusRegisterType
  value: number
  description?: string
  plcAddress?: string  // Linked PLC address (I0.0, Q0.0, MW0, etc)
}

export interface ModbusMapping {
  deviceId: number
  deviceName: string
  registers: ModbusRegister[]
}

export class ModbusRegisterMap {
  private mappings: Map<number, ModbusMapping> = new Map()

  constructor() {
    // Initialize with default device
    this.addDevice(1, 'PLC Simulator')
  }

  addDevice(deviceId: number, deviceName: string): void {
    this.mappings.set(deviceId, {
      deviceId,
      deviceName,
      registers: []
    })
  }

  // Auto-map PLC I/O to Modbus registers
  autoMapFromPLC(
    deviceId: number,
    digitalInputs: string[],
    digitalOutputs: string[],
    analogInputs: string[],
    analogOutputs: string[]
  ): void {
    const mapping = this.mappings.get(deviceId)
    if (!mapping) return

    let coilAddr = 0
    let discreteAddr = 10000
    let holdingAddr = 40000
    let inputAddr = 30000

    // Digital Inputs -> Discrete Inputs (read-only bits)
    digitalInputs.forEach(plcAddr => {
      mapping.registers.push({
        address: discreteAddr++,
        type: 'discrete-input',
        value: 0,
        description: `DI ${plcAddr}`,
        plcAddress: plcAddr
      })
    })

    // Digital Outputs -> Coils (read/write bits)
    digitalOutputs.forEach(plcAddr => {
      mapping.registers.push({
        address: coilAddr++,
        type: 'coil',
        value: 0,
        description: `DO ${plcAddr}`,
        plcAddress: plcAddr
      })
    })

    // Analog Inputs -> Input Registers (read-only words)
    analogInputs.forEach(plcAddr => {
      mapping.registers.push({
        address: inputAddr++,
        type: 'input-register',
        value: 0,
        description: `AI ${plcAddr}`,
        plcAddress: plcAddr
      })
    })

    // Analog Outputs -> Holding Registers (read/write words)
    analogOutputs.forEach(plcAddr => {
      mapping.registers.push({
        address: holdingAddr++,
        type: 'holding-register',
        value: 0,
        description: `AO ${plcAddr}`,
        plcAddress: plcAddr
      })
    })
  }

  // Read Coil (FC01)
  readCoil(deviceId: number, address: number): number | null {
    const register = this.findRegister(deviceId, address, 'coil')
    return register ? register.value : null
  }

  // Read Discrete Input (FC02)
  readDiscreteInput(deviceId: number, address: number): number | null {
    const register = this.findRegister(deviceId, address, 'discrete-input')
    return register ? register.value : null
  }

  // Read Holding Register (FC03)
  readHoldingRegister(deviceId: number, address: number): number | null {
    const register = this.findRegister(deviceId, address, 'holding-register')
    return register ? register.value : null
  }

  // Read Input Register (FC04)
  readInputRegister(deviceId: number, address: number): number | null {
    const register = this.findRegister(deviceId, address, 'input-register')
    return register ? register.value : null
  }

  // Write Single Coil (FC05)
  writeSingleCoil(deviceId: number, address: number, value: number): boolean {
    const register = this.findRegister(deviceId, address, 'coil')
    if (register) {
      register.value = value ? 1 : 0
      return true
    }
    return false
  }

  // Write Single Holding Register (FC06)
  writeSingleRegister(deviceId: number, address: number, value: number): boolean {
    const register = this.findRegister(deviceId, address, 'holding-register')
    if (register) {
      register.value = value
      return true
    }
    return false
  }

  // Read Multiple Coils (FC01)
  readCoils(deviceId: number, startAddress: number, quantity: number): number[] {
    const values: number[] = []
    for (let i = 0; i < quantity; i++) {
      const value = this.readCoil(deviceId, startAddress + i)
      values.push(value ?? 0)
    }
    return values
  }

  // Read Multiple Holding Registers (FC03)
  readHoldingRegisters(deviceId: number, startAddress: number, quantity: number): number[] {
    const values: number[] = []
    for (let i = 0; i < quantity; i++) {
      const value = this.readHoldingRegister(deviceId, startAddress + i)
      values.push(value ?? 0)
    }
    return values
  }

  // Write Multiple Coils (FC15)
  writeMultipleCoils(deviceId: number, startAddress: number, values: number[]): boolean {
    let success = true
    values.forEach((value, index) => {
      if (!this.writeSingleCoil(deviceId, startAddress + index, value)) {
        success = false
      }
    })
    return success
  }

  // Write Multiple Registers (FC16)
  writeMultipleRegisters(deviceId: number, startAddress: number, values: number[]): boolean {
    let success = true
    values.forEach((value, index) => {
      if (!this.writeSingleRegister(deviceId, startAddress + index, value)) {
        success = false
      }
    })
    return success
  }

  // Update register value (from PLC simulator)
  updateRegisterFromPLC(deviceId: number, plcAddress: string, value: number | boolean): void {
    const mapping = this.mappings.get(deviceId)
    if (!mapping) return

    const register = mapping.registers.find(r => r.plcAddress === plcAddress)
    if (register) {
      register.value = typeof value === 'boolean' ? (value ? 1 : 0) : value
    }
  }

  // Get PLC address from register
  getPLCAddress(deviceId: number, address: number, type: ModbusRegisterType): string | null {
    const register = this.findRegister(deviceId, address, type)
    return register?.plcAddress || null
  }

  // Get all registers for a device
  getDeviceRegisters(deviceId: number): ModbusRegister[] {
    return this.mappings.get(deviceId)?.registers || []
  }

  // Get device info
  getDevice(deviceId: number): ModbusMapping | null {
    return this.mappings.get(deviceId) || null
  }

  // Get all devices
  getAllDevices(): ModbusMapping[] {
    return Array.from(this.mappings.values())
  }

  private findRegister(
    deviceId: number,
    address: number,
    type: ModbusRegisterType
  ): ModbusRegister | null {
    const mapping = this.mappings.get(deviceId)
    if (!mapping) return null

    return mapping.registers.find(r => r.address === address && r.type === type) || null
  }
}
