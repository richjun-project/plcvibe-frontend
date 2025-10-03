/**
 * Auto-Debug Agent
 *
 * AI가 생성한 래더 로직을 자동으로:
 * 1. 파싱 시도
 * 2. 시뮬레이션 실행
 * 3. 에러/경고 감지
 * 4. 자동으로 수정 제안
 * 5. 수정 후 다시 검증
 *
 * 최종적으로 정상 작동하는 코드가 나올 때까지 반복
 */

import { parseLadderText } from '@/lib/ladder/parser'
import { PLCSimulator } from '@/lib/simulator/engine'
import type { LadderProgram } from '@/lib/ladder/parser'

export interface DebugResult {
  success: boolean
  issues: DebugIssue[]
  program?: LadderProgram
  iteration: number
  userRequest?: string
}

export interface DebugIssue {
  severity: 'error' | 'warning' | 'info'
  type: 'parsing' | 'simulation' | 'logic' | 'format'
  message: string
  suggestion?: string
  code?: string
}

export class AutoDebugAgent {
  private maxIterations = 10 // Increased from 5 to 10 for 100% success
  private debugHistory: DebugResult[] = []
  private userRequest?: string

  /**
   * Set user request for test scenario generation
   */
  setUserRequest(request: string) {
    this.userRequest = request
  }

  /**
   * 래더 코드를 자동으로 검증하고 문제를 찾습니다
   */
  async validateLadderCode(code: string): Promise<DebugResult> {
    const issues: DebugIssue[] = []
    let program: LadderProgram | undefined

    // 0. 빈 코드 체크 (CRITICAL)
    if (!code || code.trim().length === 0) {
      issues.push({
        severity: 'error',
        type: 'format',
        message: 'Empty code detected - NO CODE WAS GENERATED!',
        suggestion: 'CRITICAL: AI must generate actual ladder logic code. Check if the response contains a ```ladder code block.'
      })

      return {
        success: false,
        issues,
        iteration: 0,
        userRequest: this.userRequest
      }
    }

    // 1. Parsing 검증
    try {
      program = parseLadderText(code)

      // Critical: 네트워크가 없으면 에러
      if (program.networks.length === 0 && code.length > 0) {
        issues.push({
          severity: 'error',
          type: 'parsing',
          message: 'No networks were parsed from the code',
          suggestion: 'CRITICAL: Each network MUST be on ONE line starting with |-- and ending with --| Example: |--[ I0.0 ]--( Q0.0 )--|',
          code: code.substring(0, 200)
        })
      }

      // Critical: I/O 매핑이 없으면 에러로 변경
      if (program.ioMap.length === 0 && program.networks.length > 0) {
        issues.push({
          severity: 'error',
          type: 'format',
          message: 'No I/O mapping found - REQUIRED',
          suggestion: 'CRITICAL: You MUST add I/O Mapping section at the end. Format:\nI/O Mapping:\nI0.0 - Start Button\nQ0.0 - Motor Output'
        })
      }

      // 각 네트워크의 요소 수 체크
      program.networks.forEach((network, idx) => {
        if (network.elements.length === 0) {
          issues.push({
            severity: 'error',
            type: 'parsing',
            message: `Network ${network.id} has no elements`,
            suggestion: 'Each network must have at least one contact or output element'
          })
        }
      })

    } catch (error) {
      issues.push({
        severity: 'error',
        type: 'parsing',
        message: `Parsing failed: ${error instanceof Error ? error.message : String(error)}`,
        suggestion: 'CRITICAL: Fix syntax errors. Format must be: |--[ ADDRESS ]--( ADDRESS )--| on a SINGLE line'
      })

      return {
        success: false,
        issues,
        iteration: 0
      }
    }

    // 2. Simulator 검증
    if (program && program.networks.length > 0) {
      try {
        const simulator = new PLCSimulator(program)

        // 입력이 제대로 초기화되었는지 확인
        const state = simulator.getState()
        const inputCount = Object.keys(state.inputs).length
        const outputCount = Object.keys(state.outputs).length

        if (inputCount === 0 && outputCount === 0) {
          issues.push({
            severity: 'warning',
            type: 'simulation',
            message: 'No inputs or outputs initialized in simulator',
            suggestion: 'Check if addresses (I0.0, Q0.0, M0.0) are properly formatted'
          })
        }

        // 간단한 시뮬레이션 실행 (1초)
        simulator.start()
        await new Promise(resolve => setTimeout(resolve, 100))
        simulator.stop()

        // 무한루프나 크래시 체크는 이미 통과

      } catch (error) {
        issues.push({
          severity: 'error',
          type: 'simulation',
          message: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`,
          suggestion: 'Check logic elements - ensure all addresses are valid'
        })
      }
    }

    // 3. 로직 검증 (일반적인 패턴 체크 - 간단한 것만)
    if (program && program.networks.length > 0) {
      const logicIssues = this.validateLogicPatterns(program)
      issues.push(...logicIssues)
    }

    // Note: 시뮬레이션 기반 자동 테스트는 제거됨
    // 이유: AI가 추측한 테스트가 틀릴 수 있음
    // 대신: 사용자가 직접 테스트하고 피드백 제공

    return {
      success: issues.filter(i => i.severity === 'error').length === 0,
      issues,
      program,
      iteration: 0,
      userRequest: this.userRequest
    }
  }

  /**
   * 일반적인 래더 로직 패턴을 검증
   */
  private validateLogicPatterns(program: LadderProgram): DebugIssue[] {
    const issues: DebugIssue[] = []

    // 출력이 없는 네트워크 체크
    program.networks.forEach((network, idx) => {
      const hasOutput = network.elements.some(e =>
        e.type === 'coil' || e.type === 'timer' || e.type === 'counter'
      )

      if (!hasOutput) {
        issues.push({
          severity: 'warning',
          type: 'logic',
          message: `Network ${network.id}: No output element (coil/timer/counter) found`,
          suggestion: 'Add at least one output element to the network'
        })
      }
    })

    // E-Stop 패턴 체크 (안전 관련)
    const hasEmergencyStop = program.ioMap.some(io =>
      io.name.toLowerCase().includes('stop') ||
      io.name.toLowerCase().includes('e-stop') ||
      io.name.toLowerCase().includes('emergency')
    )

    const hasNormallyClosedContacts = program.networks.some(network =>
      network.elements.some(e => e.type === 'contact-nc')
    )

    if (hasEmergencyStop && !hasNormallyClosedContacts) {
      issues.push({
        severity: 'info',
        type: 'logic',
        message: 'Emergency stop detected but no NC contacts found',
        suggestion: 'Consider using NC contact [/I0.x] for emergency stop (fail-safe)'
      })
    }

    // 자기유지(seal-in) 패턴 체크
    const memoryAddresses = new Set<string>()
    program.networks.forEach(network => {
      network.elements.forEach(element => {
        if (element.address?.startsWith('M') && element.type === 'coil') {
          memoryAddresses.add(element.address)
        }
      })
    })

    memoryAddresses.forEach(addr => {
      const usedInContacts = program.networks.some(network =>
        network.elements.some(e =>
          e.address === addr && (e.type === 'contact-no' || e.type === 'contact-nc')
        )
      )

      if (!usedInContacts) {
        issues.push({
          severity: 'info',
          type: 'logic',
          message: `Memory ${addr} is set but never used in contacts`,
          suggestion: 'If this is for seal-in/latching, add a contact to maintain the state'
        })
      }
    })

    return issues
  }

  /**
   * 문제를 AI에게 보낼 수 있는 프롬프트로 변환
   */
  generateFixPrompt(result: DebugResult, originalCode: string): string {
    const errorMessages = result.issues
      .filter(i => i.severity === 'error')
      .map(i => `- ${i.message}`)
      .join('\n')

    const warningMessages = result.issues
      .filter(i => i.severity === 'warning')
      .map(i => `- ${i.message}`)
      .join('\n')

    const suggestions = result.issues
      .filter(i => i.suggestion)
      .map(i => `- ${i.suggestion}`)
      .join('\n')

    return `⚠️ CRITICAL: The ladder logic code has ERRORS! (NO MARKDOWN ALLOWED!)

**Original Code (BROKEN):**
\`\`\`ladder
${originalCode}
\`\`\`

**❌ ERRORS (MUST FIX):**
${errorMessages || 'None'}

**⚠️ WARNINGS:**
${warningMessages || 'None'}

**💡 REQUIRED FIXES:**
${suggestions}

🚫 MOST COMMON MISTAKE: Using Markdown Formatting!
- If error says "No networks parsed" → You used **Network 1:** instead of Network 1:
- If error says "No I/O mapping" → You used markdown table instead of plain list

🚫 FORBIDDEN:
- NO **bold** formatting
- NO markdown tables (| col1 | col2 |)
- NO --|-- connections (use -- instead)
- NO [NOT], [OR], [AND] in brackets

✅ STRICT FORMAT REQUIREMENTS:
1. Network headers: "Network 1: Description" (plain text, NO ** bold **)
2. Each network MUST be on ONE line
3. Format: |--[ I0.0 ]--( Q0.0 )--|
4. Connect elements with -- (not --|-- or other)
5. I/O Mapping: plain list format (NO markdown tables!)
6. Addresses: I0.x, Q0.x, M0.x, T1, C1
7. Timers: [TON T1, 5000ms]

✅ CORRECT EXAMPLE:
\`\`\`ladder
Network 1: Start Logic
|--[ I0.0 ]--[/I0.1 ]--( M0.0 )--|

Network 2: Seal-in
|--[ M0.0 ]--[/I0.1 ]--( M0.0 )--|

Network 3: Output
|--[ M0.0 ]--( Q0.0 )--|

I/O Mapping:
I0.0 - Start Button
I0.1 - Stop Button
Q0.0 - Motor Output
M0.0 - Run Memory
\`\`\`

❌ WRONG (DO NOT DO):
\`\`\`ladder
**Network 1:** ... ← NO bold!
| I0.0 | Button | ← NO table!
|--[ I0.0 ]--|--[NOT]--|--| ← NO --|--!
\`\`\`

Generate ONLY the corrected \`\`\`ladder code block in PLAIN TEXT. NO markdown formatting!`
  }

  /**
   * 자동 디버그 루프 실행
   */
  async autoDebugLoop(
    initialCode: string,
    generateFixFn: (prompt: string) => Promise<string>
  ): Promise<DebugResult> {
    let currentCode = initialCode
    let iteration = 0

    while (iteration < this.maxIterations) {
      console.log(`[AutoDebugAgent] Iteration ${iteration + 1}/${this.maxIterations}`)

      // 현재 코드 검증
      const result = await this.validateLadderCode(currentCode)
      result.iteration = iteration + 1
      this.debugHistory.push(result)

      // 성공하면 종료
      if (result.success && result.issues.filter(i => i.severity === 'error').length === 0) {
        console.log('[AutoDebugAgent] ✅ Code is valid!')
        return result
      }

      // 실패하면 수정 요청
      console.log(`[AutoDebugAgent] ❌ Found ${result.issues.length} issues`)
      result.issues.forEach(issue => {
        console.log(`  - [${issue.severity}] ${issue.message}`)
      })

      // 마지막 iteration이면 중단
      if (iteration >= this.maxIterations - 1) {
        console.log('[AutoDebugAgent] ⚠️ Max iterations reached')
        return result
      }

      // AI에게 수정 요청
      const fixPrompt = this.generateFixPrompt(result, currentCode)
      console.log('[AutoDebugAgent] 🤖 Requesting fix from AI...')

      try {
        currentCode = await generateFixFn(fixPrompt)
      } catch (error) {
        console.error('[AutoDebugAgent] Failed to get fix from AI:', error)
        return result
      }

      iteration++
    }

    return this.debugHistory[this.debugHistory.length - 1]
  }

  /**
   * 디버그 히스토리 반환
   */
  getHistory(): DebugResult[] {
    return this.debugHistory
  }

  /**
   * 히스토리 초기화
   */
  clearHistory(): void {
    this.debugHistory = []
  }
}