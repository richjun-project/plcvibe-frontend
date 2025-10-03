// Modbus TCP Server Simulator
// Simulates a Modbus TCP server for testing and development

import { ModbusRegisterMap, type ModbusRegister } from './register-map'

export interface ModbusRequest {
  deviceId: number
  functionCode: number
  address: number
  quantity?: number
  values?: number[]
}

export interface ModbusResponse {
  deviceId: number
  functionCode: number
  success: boolean
  data?: number[]
  error?: string
}

export class ModbusServer {
  private registerMap: ModbusRegisterMap
  private isRunning = false
  private requestLog: Array<{ timestamp: number; request: ModbusRequest; response: ModbusResponse }> = []

  constructor(registerMap: ModbusRegisterMap) {
    this.registerMap = registerMap
  }

  start(): void {
    this.isRunning = true
    console.log('[Modbus] Server started')
  }

  stop(): void {
    this.isRunning = false
    console.log('[Modbus] Server stopped')
  }

  getStatus(): boolean {
    return this.isRunning
  }

  // Process Modbus request
  processRequest(request: ModbusRequest): ModbusResponse {
    if (!this.isRunning) {
      return {
        deviceId: request.deviceId,
        functionCode: request.functionCode,
        success: false,
        error: 'Server not running'
      }
    }

    let response: ModbusResponse

    switch (request.functionCode) {
      case 1: // Read Coils
        response = this.handleReadCoils(request)
        break

      case 2: // Read Discrete Inputs
        response = this.handleReadDiscreteInputs(request)
        break

      case 3: // Read Holding Registers
        response = this.handleReadHoldingRegisters(request)
        break

      case 4: // Read Input Registers
        response = this.handleReadInputRegisters(request)
        break

      case 5: // Write Single Coil
        response = this.handleWriteSingleCoil(request)
        break

      case 6: // Write Single Register
        response = this.handleWriteSingleRegister(request)
        break

      case 15: // Write Multiple Coils
        response = this.handleWriteMultipleCoils(request)
        break

      case 16: // Write Multiple Registers
        response = this.handleWriteMultipleRegisters(request)
        break

      default:
        response = {
          deviceId: request.deviceId,
          functionCode: request.functionCode,
          success: false,
          error: `Unsupported function code: ${request.functionCode}`
        }
    }

    // Log request/response
    this.requestLog.push({
      timestamp: Date.now(),
      request,
      response
    })

    // Keep only last 100 requests
    if (this.requestLog.length > 100) {
      this.requestLog.shift()
    }

    return response
  }

  private handleReadCoils(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, quantity = 1 } = request
    const values = this.registerMap.readCoils(deviceId, address, quantity)

    return {
      deviceId,
      functionCode: 1,
      success: true,
      data: values
    }
  }

  private handleReadDiscreteInputs(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, quantity = 1 } = request
    const values: number[] = []

    for (let i = 0; i < quantity; i++) {
      const value = this.registerMap.readDiscreteInput(deviceId, address + i)
      values.push(value ?? 0)
    }

    return {
      deviceId,
      functionCode: 2,
      success: true,
      data: values
    }
  }

  private handleReadHoldingRegisters(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, quantity = 1 } = request
    const values = this.registerMap.readHoldingRegisters(deviceId, address, quantity)

    return {
      deviceId,
      functionCode: 3,
      success: true,
      data: values
    }
  }

  private handleReadInputRegisters(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, quantity = 1 } = request
    const values: number[] = []

    for (let i = 0; i < quantity; i++) {
      const value = this.registerMap.readInputRegister(deviceId, address + i)
      values.push(value ?? 0)
    }

    return {
      deviceId,
      functionCode: 4,
      success: true,
      data: values
    }
  }

  private handleWriteSingleCoil(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, values = [] } = request
    const success = this.registerMap.writeSingleCoil(deviceId, address, values[0] || 0)

    return {
      deviceId,
      functionCode: 5,
      success,
      error: success ? undefined : 'Failed to write coil'
    }
  }

  private handleWriteSingleRegister(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, values = [] } = request
    const success = this.registerMap.writeSingleRegister(deviceId, address, values[0] || 0)

    return {
      deviceId,
      functionCode: 6,
      success,
      error: success ? undefined : 'Failed to write register'
    }
  }

  private handleWriteMultipleCoils(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, values = [] } = request
    const success = this.registerMap.writeMultipleCoils(deviceId, address, values)

    return {
      deviceId,
      functionCode: 15,
      success,
      error: success ? undefined : 'Failed to write coils'
    }
  }

  private handleWriteMultipleRegisters(request: ModbusRequest): ModbusResponse {
    const { deviceId, address, values = [] } = request
    const success = this.registerMap.writeMultipleRegisters(deviceId, address, values)

    return {
      deviceId,
      functionCode: 16,
      success,
      error: success ? undefined : 'Failed to write registers'
    }
  }

  // Get request log for debugging
  getRequestLog(): Array<{ timestamp: number; request: ModbusRequest; response: ModbusResponse }> {
    return [...this.requestLog]
  }

  // Clear request log
  clearRequestLog(): void {
    this.requestLog = []
  }

  // Get statistics
  getStatistics(): {
    totalRequests: number
    successfulRequests: number
    failedRequests: number
    requestsByFunction: Record<number, number>
  } {
    const stats = {
      totalRequests: this.requestLog.length,
      successfulRequests: 0,
      failedRequests: 0,
      requestsByFunction: {} as Record<number, number>
    }

    this.requestLog.forEach(({ response }) => {
      if (response.success) {
        stats.successfulRequests++
      } else {
        stats.failedRequests++
      }

      const fc = response.functionCode
      stats.requestsByFunction[fc] = (stats.requestsByFunction[fc] || 0) + 1
    })

    return stats
  }
}
