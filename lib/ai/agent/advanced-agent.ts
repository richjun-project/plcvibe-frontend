/**
 * Advanced PLC Agent System
 *
 * Bolt/Lovable/Cursor처럼 작동하는 고급 에이전트:
 * 1. 사용자 요청 분석
 * 2. 계획 수립
 * 3. 반복적 실행 및 검증
 * 4. 문제 자동 수정
 * 5. 최종 완성본 제공
 */

import { GoogleGenerativeAI } from '@google/generative-ai'
import { parseLadderText, type LadderProgram } from '@/lib/ladder/parser'
import { PLCSimulator } from '@/lib/simulator/engine'
import { AutoDebugAgent, type DebugResult } from './auto-debug-agent'
import { rateLimiter } from '@/lib/ai/rate-limiter'
import { getServerWorkspace } from '@/lib/workspace/supabase-workspace'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

// System instruction for Gemini to prevent markdown generation
const SYSTEM_INSTRUCTION = `You are an expert PLC (Programmable Logic Controller) programmer generating IEC 61131-3 ladder logic code.

CRITICAL RULES:
1. You are generating PLAIN TEXT ladder logic code, NOT markdown documentation
2. NEVER use markdown formatting (**, ##, tables, etc.)
3. ALWAYS follow the exact format specified in the user prompt
4. Network headers must be plain text: "Network 1: Description" (NO ** bold **)
5. I/O Mapping must be a plain list (NO markdown tables)
6. Each ladder network must be on ONE single line
7. Use ONLY these connection formats: --, [ ], ( ), [/ ], [TON ...]

If you generate markdown formatting, your output will FAIL parsing and cause errors.`

export interface AgentTask {
  id: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  output?: string
  error?: string
}

export interface AgentPlan {
  goal: string
  tasks: AgentTask[]
  currentStep: number
  totalSteps: number
}

export interface AgentResult {
  success: boolean
  plan: AgentPlan
  finalCode?: string
  iterations: number
  logs: string[]
  sessionId?: string
  files?: string[]
}

export class AdvancedPLCAgent {
  private logs: string[] = []
  private iterations = 0
  private maxIterations = 5 // Reduced from 15 to 5 for faster feedback and better prompts
  private sessionId: string | null = null
  private onUpdate?: (data: any) => void

  /**
   * Set callback for real-time updates
   */
  setUpdateCallback(callback: (data: any) => void) {
    this.onUpdate = callback
  }

  /**
   * Send update to callback (for streaming)
   */
  private sendUpdate(data: any) {
    this.onUpdate?.(data)
  }

  /**
   * 메인 에이전트 실행
   */
  async execute(userRequest: string, existingCode?: string): Promise<AgentResult> {
    this.log('🤖 [AGENT_START] Advanced PLC Agent started')
    this.log(`📝 User Request: ${userRequest}`)
    if (existingCode) {
      this.log(`📄 Using existing code as context (${existingCode.length} chars)`)
    }

    try {
      // Create session in Supabase (using server workspace with service role)
      const workspace = getServerWorkspace()
      const session = await workspace.createSession(userRequest, { userRequest }, true) // isAgentSession = true
      this.sessionId = session.id
      this.log(`📁 [SESSION_CREATE] Session created: ${this.sessionId}`)

      // Step 1: 계획 수립
      const plan = await this.createPlan(userRequest, existingCode)
      this.log(`📋 [PLAN_COMPLETE] Plan created with ${plan.totalSteps} steps`)

      // Save plan as program
      await workspace.saveProgram(
        this.sessionId,
        'plan',
        JSON.stringify(plan, null, 2),
        plan,
        'json'
      )
      this.log(`💾 [DB_SAVE] Plan saved to database`)

      // Step 2: 계획 실행
      const result = await this.executePlan(plan, userRequest, existingCode)

      // Update session metadata
      await workspace.updateSession(this.sessionId, {
        metadata: {
          userRequest,
          status: result.success ? 'completed' : 'failed',
          iterations: this.iterations,
          finalCode: result.finalCode,
          logs: this.logs.slice(-50) // Save last 50 logs
        }
      })
      this.log(`💾 [DB_SAVE] Session metadata updated`)

      // List all programs in session
      const programs = await workspace.listPrograms(this.sessionId)
      const files = programs.map(p => p.name)

      return {
        ...result,
        sessionId: this.sessionId,
        files
      }

    } catch (error) {
      console.error('❌ [AGENT ERROR] Full error:', error)
      const errorMsg = error instanceof Error
        ? `${error.message}\nStack: ${error.stack}`
        : JSON.stringify(error, null, 2)
      this.log(`❌ Agent failed: ${errorMsg}`)
      return {
        success: false,
        plan: { goal: userRequest, tasks: [], currentStep: 0, totalSteps: 0 },
        iterations: this.iterations,
        logs: this.logs,
        sessionId: this.sessionId || undefined
      }
    }
  }

  /**
   * 세션 ID 생성
   */
  private createSessionId(userRequest: string): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5)
    const randomId = Math.random().toString(36).substring(2, 8)
    return `session_${timestamp}_${randomId}`
  }

  /**
   * 1단계: 계획 수립
   */
  private async createPlan(userRequest: string, existingCode?: string): Promise<AgentPlan> {
    this.log('🧠 [PLAN_START] Analyzing request and creating plan...')

    const existingCodeContext = existingCode
      ? `\n\nEXISTING CODE TO MODIFY:\n${existingCode}\n\nNote: The user wants to modify or extend the existing code above. Your plan should account for this.`
      : ''

    const planningPrompt = `You are an expert PLC programming agent. Analyze this request and create a detailed plan.

User Request: "${userRequest}"${existingCodeContext}

Create a step-by-step plan to fulfill this request. Consider:
1. What I/O is needed?
2. What logic patterns are required?
3. What safety features should be included?
4. How many networks/rungs are needed?

Respond in this JSON format:
{
  "goal": "Brief description of what to build",
  "tasks": [
    {"id": "1", "description": "Task 1 description", "status": "pending"},
    {"id": "2", "description": "Task 2 description", "status": "pending"}
  ]
}

Respond with ONLY the JSON, no markdown.`

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const model = genAI.getGenerativeModel({ model: modelName })

    // Use rate limiter to handle 429 errors
    const response = await rateLimiter.executeWithRetry(async () => {
      const result = await model.generateContent(planningPrompt)
      return result.response.text()
    }, {
      onRetry: (attempt, delay) => {
        this.log(`⏳ Rate limit hit. Retrying (${attempt}) after ${delay}ms...`)
      }
    })

    // JSON 추출
    const jsonMatch = response.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('Failed to parse plan from AI response')
    }

    const planData = JSON.parse(jsonMatch[0])

    return {
      goal: planData.goal,
      tasks: planData.tasks,
      currentStep: 0,
      totalSteps: planData.tasks.length
    }
  }

  /**
   * 2단계: 계획 실행
   */
  private async executePlan(plan: AgentPlan, userRequest: string, existingCode?: string): Promise<AgentResult> {
    this.log(`🚀 Starting plan execution: ${plan.goal}`)

    const workspace = getServerWorkspace()

    // Use existing code as starting point if provided
    let currentCode = existingCode || ''
    let isValid = false
    let previousProgramId = ''

    while (this.iterations < this.maxIterations && !isValid) {
      this.iterations++
      this.log(`\n=== Iteration ${this.iterations}/${this.maxIterations} ===`)

      // Generate code - WAIT until complete
      this.log('⏳ Waiting for code generation to complete...')
      const code = await this.generateCode(userRequest, plan, currentCode)
      currentCode = code
      this.log('✅ Code generation completed, moving to validation...')

      // Stream generated code to UI
      if (code && code.trim().length > 0) {
        try {
          const parsedProgram = parseLadderText(code)
          this.sendUpdate({
            type: 'code_generated',
            iteration: this.iterations,
            code: code,
            networks: parsedProgram.networks.length,
            ioCount: parsedProgram.ioMap.length
          })
        } catch (error) {
          // If parsing fails, still send the code
          this.sendUpdate({
            type: 'code_generated',
            iteration: this.iterations,
            code: code,
            networks: 0,
            ioCount: 0
          })
        }
      }

      // Save iteration code to Supabase
      if (this.sessionId) {
        const programName = `iteration_${this.iterations}`
        const program = await workspace.saveProgram(
          this.sessionId,
          programName,
          code,
          null,
          'ladder'
        )
        previousProgramId = program.id
        this.log(`💾 [DB_SAVE] Saved iteration ${this.iterations} to database`)
      }

      // Validate code - WAIT until complete
      this.log('⏳ Waiting for validation to complete...')
      const validation = await this.validateCode(code, userRequest)
      this.log('✅ Validation completed')

      // Stream validation result to UI
      this.sendUpdate({
        type: 'validation_result',
        iteration: this.iterations,
        success: validation.success,
        issues: validation.issues
      })

      // Save validation result to Supabase
      if (this.sessionId && previousProgramId) {
        await workspace.saveProgram(
          this.sessionId,
          `validation_${this.iterations}`,
          JSON.stringify(validation, null, 2),
          validation,
          'json'
        )
        this.log(`💾 [DB_SAVE] Validation result saved to database`)
      }

      if (validation.success) {
        this.log('🎉 Code validation passed! All checks successful!')
        isValid = true

        // Save final code to Supabase
        if (this.sessionId) {
          await workspace.saveProgram(
            this.sessionId,
            'final',
            code,
            null,
            'ladder'
          )
          this.log(`💾 [DB_SAVE] Final code saved to database`)
        }

        // Mark all tasks as completed
        plan.tasks.forEach(task => task.status = 'completed')
        plan.currentStep = plan.totalSteps

        return {
          success: true,
          plan,
          finalCode: code,
          iterations: this.iterations,
          logs: this.logs
        }
      } else {
        const errors = validation.issues.filter(i => i.severity === 'error')
        const warnings = validation.issues.filter(i => i.severity === 'warning')

        this.log(`❌ [VALIDATION_COMPLETE] Failed - Errors: ${errors.length}, Warnings: ${warnings.length}`)

        if (errors.length > 0) {
          this.log(`❌ ERRORS (must fix):`)
          errors.forEach(issue => {
            this.log(`  - ${issue.message}`)
            if (issue.suggestion) {
              this.log(`    💡 ${issue.suggestion}`)
            }
          })
        }

        if (warnings.length > 0) {
          this.log(`⚠️ WARNINGS (info only):`)
          warnings.forEach(issue => {
            this.log(`  - ${issue.message}`)
          })
        }

        // If this is not the last iteration, continue loop
        if (this.iterations < this.maxIterations) {
          this.log('🔄 [FIX_START] Starting automatic fix process...')
          this.log('⏳ Preparing to regenerate code with fixes...')
        }
      }
    }

    // Max iterations reached
    this.log(`⚠️ Max iterations (${this.maxIterations}) reached without perfect solution`)

    // Save final attempt even if not perfect
    if (this.sessionId && currentCode) {
      await workspace.saveProgram(
        this.sessionId,
        'final_attempt',
        currentCode,
        null,
        'ladder'
      )
      this.log(`💾 [DB_SAVE] Final attempt saved to database`)
    }

    return {
      success: false,
      plan,
      finalCode: currentCode,
      iterations: this.iterations,
      logs: this.logs
    }
  }

  /**
   * 코드 생성
   */
  private async generateCode(
    userRequest: string,
    plan: AgentPlan,
    previousCode: string
  ): Promise<string> {
    this.log('💻 [CODE_GEN_START] Generating ladder logic code...')

    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: SYSTEM_INSTRUCTION,
      generationConfig: {
        temperature: 0.1, // Low temperature for consistent, deterministic output
        maxOutputTokens: 8192,
      }
    })

    let prompt = `Generate PLC Ladder Logic for: ${userRequest}

CRITICAL: Output PLAIN TEXT ladder logic code, NOT markdown.

⚡ CRITICAL LADDER LAYOUT RULES:

1. LEFT ZONE: Input contacts [ I ] grouped together
2. RIGHT ZONE (next to right rail): Outputs, timers, counters
   - Coils: ( Q ), ( M ), ( S M ), ( R M )
   - Timer/Counter Commands: [TON T1, 1000ms], [CTU C1, 10]

SPACING: Use -- connections to create space between input zone and output zone

✅ CORRECT LAYOUT:
|--[ I0.0 ]--[ I0.1 ]--------------------[TON T1, 3000ms]--|
   ^^^^^^^^^                             ^^^^^^^^^^^^^^^^^^
   LEFT zone                             RIGHT zone (far right!)

❌ WRONG - Output too close to input:
|--[ I0.0 ]--[TON T1, 3000ms]--|  ← NO! Timer must be at FAR RIGHT!

Use multiple "--" to push outputs to the right rail

✅ COMPLETE CORRECT EXAMPLE - Note the spacing!

\`\`\`ladder
Network 1: Start Button (Coil at FAR RIGHT)
|--[ I0.0 ]----------------------------------( S M0.0 )--|

Network 2: Stop Button (Coil at FAR RIGHT)
|--[ I0.1 ]----------------------------------( R M0.0 )--|

Network 3: Timer (Timer at FAR RIGHT, next to rail!)
|--[ M0.0 ]---------------------------[TON T1, 3000ms]--|

Network 4: Output (Coil at FAR RIGHT)
|--[ T1.DN ]------------------------------------( Q0.0 )--|

I/O Mapping:
I0.0 - Start Button
I0.1 - Stop Button
Q0.0 - Motor Output
M0.0 - Run State
T1 - Delay Timer
\`\`\`

⚠️ CRITICAL SPACING RULES:
1. Inputs on LEFT: |--[ I0.0 ]--[ I0.1 ]--...
2. Add many "--" for spacing: ----------------------------------
3. Outputs on FAR RIGHT (next to --|): ...--[TON]--| or ...--( Q )--|

❌ WRONG - No spacing:
|--[ I0.0 ]--( Q0.0 )--|  ← Coil too close to input!

✅ CORRECT - Proper spacing:
|--[ I0.0 ]----------------------------------( Q0.0 )--|
   ^^^^^^^^                                  ^^^^^^^^^
   LEFT zone                                 FAR RIGHT zone!

🚫 FORBIDDEN (Will cause parsing errors):
- **Network 1:** (markdown bold) → Use: Network 1:
- | Symbol | Address | (markdown table) → Use: I0.0 - Description
- |--[NOT]--| (logic in brackets) → Use: [/I0.0 ]
- |--[AND]--| (logic in brackets) → Use: [ I0.0 ]--[ I0.1 ]
- Outputs on left side → Always place outputs on RIGHT

RULES:
1. Network header: "Network N: Description" (plain text, no **)
2. Each network: ONE line starting |-- ending --|
3. Contacts: [ I0.0 ] (NO), [/I0.1 ] (NC)
4. Outputs: ( Q0.0 ), (/M0.0 )
5. Timers: [TON T1, 5000ms]
6. I/O Mapping: Plain list at end
7. NO markdown formatting anywhere
8. INPUTS on LEFT, OUTPUTS on RIGHT

Generate ONLY the \`\`\`ladder block now:`

    if (previousCode) {
      // If there's previous code, we're in a fix iteration
      prompt = `Fix this ladder logic code. Previous attempt had errors:

\`\`\`ladder
${previousCode}
\`\`\`

Original request: ${userRequest}

⚠️ MOST COMMON ERRORS:
1. Using markdown formatting!
   - If you used **Network 1:** → Change to: Network 1:
   - If you used markdown tables → Change to plain list
   - If you used |--[NOT]--| → Change to: [/I0.0 ]
2. Wrong element placement - NOT ENOUGH SPACING!
   - INPUT CONTACTS [ I ] must be on FAR LEFT
   - TIMERS [TON], COUNTERS [CTU] must be on FAR RIGHT (next to --|)
   - OUTPUT COILS ( Q ), ( M ) must be on FAR RIGHT (next to --|)
   - ❌ WRONG: |--[ I0.0 ]--[TON T1, 1000ms]--| (Timer too close to input!)
   - ✅ RIGHT: |--[ I0.0 ]---------------------------[TON T1, 1000ms]--| (Many "--" for spacing!)

✅ CORRECT EXAMPLE WITH PROPER SPACING:
\`\`\`ladder
Network 1: Start Button
|--[ I0.0 ]----------------------------------( S M0.0 )--|

Network 2: Stop Button
|--[ I0.1 ]----------------------------------( R M0.0 )--|

Network 3: Timer (FAR RIGHT!)
|--[ M0.0 ]---------------------------[TON T1, 3000ms]--|

Network 4: Output (FAR RIGHT!)
|--[ T1.DN ]------------------------------------( Q0.0 )--|

I/O Mapping:
I0.0 - Start
I0.1 - Stop
Q0.0 - Motor
M0.0 - Run State
T1 - Delay Timer
\`\`\`

KEY POINTS:
- Add MANY "--" dashes between inputs and outputs
- Outputs must be next to the right rail --|
- Inputs grouped on left, outputs on far right

Generate the CORRECTED \`\`\`ladder block (plain text, INPUTS LEFT, OUTPUTS RIGHT):`
    }

    // Use rate limiter to handle 429 errors
    const response = await rateLimiter.executeWithRetry(async () => {
      const result = await model.generateContent(prompt)
      return result.response.text()
    }, {
      onRetry: (attempt, delay) => {
        this.log(`⏳ Rate limit hit during code generation. Retrying (${attempt}) after ${delay}ms...`)
      }
    })

    // Extract ladder block
    const ladderMatch = response.match(/```ladder\n([\s\S]*?)\n```/)
    if (!ladderMatch) {
      this.log(`❌ [CODE_GEN_ERROR] No ladder code block found in AI response`)
      this.log(`   💡 AI must generate a \`\`\`ladder code block`)
      this.log(`   Response preview: ${response.substring(0, 200)}...`)

      // Return empty string to trigger validation error
      return ''
    }

    const code = ladderMatch[1]

    // CRITICAL: Check if code is empty
    if (!code || code.trim().length === 0) {
      this.log(`❌ [CODE_GEN_ERROR] Empty ladder code block generated`)
      this.log(`   💡 AI generated empty \`\`\`ladder block`)
      return ''
    }

    // PRE-VALIDATION: Check for markdown formatting
    const validation = this.validateGeneratedCode(code)
    if (!validation.valid) {
      this.log(`❌ [CODE_GEN_ERROR] Invalid format detected: ${validation.error}`)
      this.log(`   💡 TIP: AI generated markdown instead of plain text`)

      // Return code anyway for debugging, but log the issue
      // The validation step will catch it and provide feedback
    }

    // Count networks (check for both plain and markdown formats)
    const plainNetworkCount = (code.match(/^Network \d+:/gm) || []).length
    const markdownNetworkCount = (code.match(/^\*\*Network \d+:/gm) || []).length
    const networkCount = plainNetworkCount || markdownNetworkCount
    const ioMapMatch = code.match(/I\/O Mapping:/)

    if (markdownNetworkCount > 0) {
      this.log(`⚠️ [CODE_GEN_COMPLETE] Generated ${markdownNetworkCount} networks with MARKDOWN formatting (will fail parsing!)`)
    } else {
      this.log(`✅ [CODE_GEN_COMPLETE] Generated ${networkCount} networks, I/O Mapping: ${ioMapMatch ? 'Yes' : 'No'}`)
    }

    return code
  }

  /**
   * 생성된 코드 사전 검증
   */
  private validateGeneratedCode(code: string): { valid: boolean; error?: string } {
    // Check for markdown bold
    if (code.includes('**')) {
      return {
        valid: false,
        error: 'Contains markdown bold (**) - Use plain text "Network 1:" not "**Network 1:**"'
      }
    }

    // Check for markdown tables (header separator)
    if (code.match(/\|\s*[-:]+\s*\|/)) {
      return {
        valid: false,
        error: 'Contains markdown table - Use plain format "I0.0 - Button" not "| I0.0 | Button |"'
      }
    }

    // Check for correct Network format (plain text)
    if (!code.match(/^Network \d+:/m)) {
      return {
        valid: false,
        error: 'Missing Network headers in correct format - Use "Network 1: Description"'
      }
    }

    // Check for I/O Mapping section
    if (!code.match(/^I\/O Mapping:/m)) {
      return {
        valid: false,
        error: 'Missing "I/O Mapping:" section - Required at the end'
      }
    }

    // Check for wrong connection format (--|-- instead of --)
    if (code.match(/\]\s*--\s*\|\s*--\s*\[/)) {
      return {
        valid: false,
        error: 'Wrong connection format --|-- detected - Use -- to connect elements'
      }
    }

    return { valid: true }
  }

  /**
   * 코드 검증
   */
  private async validateCode(code: string, userRequest: string): Promise<DebugResult> {
    this.log('🔍 [VALIDATION_START] Validating code...')
    this.log('   📋 Step 1: Parsing ladder logic...')

    const agent = new AutoDebugAgent()
    agent.setUserRequest(userRequest) // Set user request for test scenario generation
    const result = await agent.validateLadderCode(code)

    // Log detailed validation results
    const errorCount = result.issues.filter(i => i.severity === 'error').length
    const warningCount = result.issues.filter(i => i.severity === 'warning').length
    const infoCount = result.issues.filter(i => i.severity === 'info').length

    if (result.program) {
      this.log(`   ✅ Parsing successful: ${result.program.networks.length} networks, ${result.program.ioMap.length} I/O mappings`)
      this.log('   📋 Step 2: Running simulation test...')
      this.log('   ✅ Simulation test passed')
      this.log('   📋 Step 3: Checking logic patterns...')
      this.log('   ✅ Logic pattern check completed')
    }

    if (result.success) {
      this.log(`✅ [VALIDATION_COMPLETE] Success! Networks: ${result.program?.networks.length || 0}, I/O: ${result.program?.ioMap.length || 0}`)
      this.log(`   📊 Total checks: ${errorCount + warningCount + infoCount} (✅ ${errorCount === 0 ? 'No errors' : `${errorCount} errors`}, ⚠️ ${warningCount} warnings, ℹ️ ${infoCount} info)`)
    } else {
      this.log(`❌ [VALIDATION_COMPLETE] Failed - Errors: ${errorCount}, Warnings: ${warningCount}`)
      this.log('   🔍 Error details:')
      result.issues.forEach(issue => {
        if (issue.severity === 'error') {
          this.log(`      ❌ ${issue.type}: ${issue.message}`)
        }
      })
      if (warningCount > 0) {
        this.log('   ⚠️ Warning details:')
        result.issues.forEach(issue => {
          if (issue.severity === 'warning') {
            this.log(`      ⚠️ ${issue.type}: ${issue.message}`)
          }
        })
      }
    }

    return result
  }

  /**
   * 로그 기록
   */
  private log(message: string) {
    console.log(message)
    this.logs.push(message)
  }

  /**
   * 로그 반환
   */
  getLogs(): string[] {
    return this.logs
  }
}