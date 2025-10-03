/**
 * Simulation Validator
 *
 * 테스트 시나리오를 시뮬레이터에서 실제 실행하고
 * 기대값과 실제값을 비교하여 검증합니다.
 */

import { PLCSimulator } from './engine'
import type { LadderProgram } from '@/lib/ladder/parser'
import type { TestScenario, TestStep } from './test-generator'

export interface ValidationResult {
  scenario: TestScenario
  passed: boolean
  steps: StepResult[]
  timeline: TimelineEvent[]
  summary: ValidationSummary
  duration: number // ms
}

export interface StepResult {
  step: TestStep
  passed: boolean
  actualValue?: boolean | any
  expectedValue?: boolean | any
  error?: string
  timestamp: number
}

export interface TimelineEvent {
  timestamp: number // ms from start
  type: 'input' | 'output' | 'check' | 'timer' | 'wait'
  address?: string
  value?: boolean | any
  description: string
  passed?: boolean
}

export interface ValidationSummary {
  totalSteps: number
  passedSteps: number
  failedSteps: number
  skippedSteps: number
}

export interface ValidationReport {
  results: ValidationResult[]
  overallPassed: boolean
  totalScenarios: number
  passedScenarios: number
  failedScenarios: number
  totalDuration: number
}

/**
 * 모든 테스트 시나리오를 실행하고 검증
 */
export async function validateScenarios(
  scenarios: TestScenario[],
  program: LadderProgram
): Promise<ValidationReport> {
  const results: ValidationResult[] = []
  const startTime = Date.now()

  for (const scenario of scenarios) {
    const result = await validateSingleScenario(scenario, program)
    results.push(result)
  }

  const totalDuration = Date.now() - startTime
  const passedScenarios = results.filter(r => r.passed).length

  return {
    results,
    overallPassed: passedScenarios === scenarios.length,
    totalScenarios: scenarios.length,
    passedScenarios,
    failedScenarios: scenarios.length - passedScenarios,
    totalDuration
  }
}

/**
 * 단일 시나리오 실행 및 검증
 */
export async function validateSingleScenario(
  scenario: TestScenario,
  program: LadderProgram
): Promise<ValidationResult> {
  const simulator = new PLCSimulator(program)
  const stepResults: StepResult[] = []
  const timeline: TimelineEvent[] = []
  const startTime = performance.now()

  // 시뮬레이터 시작
  simulator.start()

  let currentTime = 0 // ms
  let allPassed = true

  for (const step of scenario.steps) {
    const stepStartTime = performance.now()

    try {
      switch (step.type) {
        case 'set_input': {
          if (step.address && step.value !== undefined) {
            simulator.setInput(step.address, step.value)

            timeline.push({
              timestamp: currentTime,
              type: 'input',
              address: step.address,
              value: step.value,
              description: step.description,
              passed: true
            })

            stepResults.push({
              step,
              passed: true,
              actualValue: step.value,
              timestamp: currentTime
            })
          }
          break
        }

        case 'wait': {
          if (step.duration) {
            // 실제 시간 대기
            await sleep(step.duration)
            currentTime += step.duration

            timeline.push({
              timestamp: currentTime,
              type: 'wait',
              description: step.description,
              passed: true
            })

            stepResults.push({
              step,
              passed: true,
              timestamp: currentTime
            })
          }
          break
        }

        case 'check_output': {
          if (step.address && step.expected !== undefined) {
            const state = simulator.getState()
            const actualValue = state.outputs[step.address]
            const passed = actualValue === step.expected

            timeline.push({
              timestamp: currentTime,
              type: 'check',
              address: step.address,
              value: actualValue,
              description: step.description,
              passed
            })

            stepResults.push({
              step,
              passed,
              actualValue,
              expectedValue: step.expected,
              error: passed ? undefined : `Expected ${step.expected} but got ${actualValue}`,
              timestamp: currentTime
            })

            if (!passed) {
              allPassed = false
            }
          }
          break
        }

        case 'check_timer': {
          if (step.address && step.expected !== undefined) {
            const state = simulator.getState()
            const timer = state.timers[step.address]

            if (!timer) {
              stepResults.push({
                step,
                passed: false,
                error: `Timer ${step.address} not found`,
                timestamp: currentTime
              })
              allPassed = false
            } else {
              const expectedTimer = step.expected as { elapsed: number; done: boolean }
              const passed = timer.done === expectedTimer.done

              timeline.push({
                timestamp: currentTime,
                type: 'timer',
                address: step.address,
                value: timer,
                description: step.description,
                passed
              })

              stepResults.push({
                step,
                passed,
                actualValue: timer,
                expectedValue: expectedTimer,
                error: passed ? undefined : `Timer state mismatch`,
                timestamp: currentTime
              })

              if (!passed) {
                allPassed = false
              }
            }
          }
          break
        }
      }
    } catch (error) {
      // 스텝 실행 실패
      stepResults.push({
        step,
        passed: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: currentTime
      })
      allPassed = false
    }
  }

  // 시뮬레이터 정지
  simulator.stop()

  const duration = performance.now() - startTime

  // 요약 생성
  const summary: ValidationSummary = {
    totalSteps: stepResults.length,
    passedSteps: stepResults.filter(r => r.passed).length,
    failedSteps: stepResults.filter(r => !r.passed).length,
    skippedSteps: 0
  }

  return {
    scenario,
    passed: allPassed,
    steps: stepResults,
    timeline,
    summary,
    duration
  }
}

/**
 * Sleep 유틸리티
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 검증 리포트를 사람이 읽을 수 있는 텍스트로 포맷
 */
export function formatValidationReport(report: ValidationReport): string {
  let output = ''

  output += '═══════════════════════════════════════════════\n'
  output += '  🧪 SIMULATION VALIDATION REPORT\n'
  output += '═══════════════════════════════════════════════\n\n'

  output += `Overall Result: ${report.overallPassed ? '✅ PASSED' : '❌ FAILED'}\n`
  output += `Total Scenarios: ${report.totalScenarios}\n`
  output += `Passed: ${report.passedScenarios} | Failed: ${report.failedScenarios}\n`
  output += `Total Duration: ${report.totalDuration.toFixed(0)}ms\n\n`

  report.results.forEach((result, idx) => {
    output += `\n───────────────────────────────────────────────\n`
    output += `Scenario ${idx + 1}: ${result.scenario.name}\n`
    output += `───────────────────────────────────────────────\n`
    output += `Category: ${result.scenario.category}\n`
    output += `Description: ${result.scenario.description}\n`
    output += `Result: ${result.passed ? '✅ PASSED' : '❌ FAILED'}\n`
    output += `Duration: ${result.duration.toFixed(0)}ms\n`
    output += `Steps: ${result.summary.passedSteps}/${result.summary.totalSteps} passed\n\n`

    // Timeline
    output += 'Timeline:\n'
    result.timeline.forEach(event => {
      const icon = event.type === 'input' ? '🔧' :
                   event.type === 'output' ? '💡' :
                   event.type === 'check' ? '✓' :
                   event.type === 'timer' ? '⏱' : '⏸'
      const status = event.passed === false ? '❌' : event.passed === true ? '✅' : '  '
      output += `  ${icon} ${event.timestamp.toString().padStart(6)}ms ${status} ${event.description}\n`

      if (event.address && event.value !== undefined) {
        output += `     └─ ${event.address} = ${event.value}\n`
      }
    })

    // Failed steps details
    const failedSteps = result.steps.filter(s => !s.passed)
    if (failedSteps.length > 0) {
      output += `\n❌ Failed Steps:\n`
      failedSteps.forEach(step => {
        output += `  • ${step.step.description}\n`
        if (step.error) {
          output += `    Error: ${step.error}\n`
        }
        if (step.expectedValue !== undefined) {
          output += `    Expected: ${step.expectedValue}\n`
          output += `    Actual:   ${step.actualValue}\n`
        }
      })
    }

    output += `\nExpected Outcome: ${result.scenario.expectedOutcome}\n`
  })

  output += '\n═══════════════════════════════════════════════\n\n'

  return output
}

/**
 * 간단한 요약만 출력 (로그용)
 */
export function formatValidationSummary(report: ValidationReport): string {
  const icon = report.overallPassed ? '✅' : '❌'
  return `${icon} Validation: ${report.passedScenarios}/${report.totalScenarios} scenarios passed (${report.totalDuration.toFixed(0)}ms)`
}

/**
 * 특정 시나리오의 상세 결과 포맷
 */
export function formatScenarioResult(result: ValidationResult): string {
  let output = ''

  output += `\n${result.passed ? '✅' : '❌'} ${result.scenario.name}\n`
  output += `   ${result.scenario.description}\n`
  output += `   Steps: ${result.summary.passedSteps}/${result.summary.totalSteps} | Duration: ${result.duration.toFixed(0)}ms\n`

  if (!result.passed) {
    const failedSteps = result.steps.filter(s => !s.passed)
    failedSteps.forEach(step => {
      output += `   ❌ ${step.step.description}\n`
      if (step.error) {
        output += `      ${step.error}\n`
      }
    })
  }

  return output
}