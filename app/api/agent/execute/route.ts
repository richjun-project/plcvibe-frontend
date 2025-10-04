import { NextRequest } from 'next/server'
import { AdvancedPLCAgent } from '@/lib/ai/agent/advanced-agent'

export async function POST(req: NextRequest) {
  try {
    const { request, existingCode } = await req.json()

    if (!request) {
      return new Response(
        JSON.stringify({ error: 'No request provided' }),
        { status: 400 }
      )
    }

    console.log('[Agent API] Starting advanced agent for:', request)
    if (existingCode) {
      console.log('[Agent API] Using existing code as context')
    }

    const encoder = new TextEncoder()

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Helper function to send updates
          const sendUpdate = (data: any) => {
            const message = `data: ${JSON.stringify(data)}\n\n`
            controller.enqueue(encoder.encode(message))
          }

          // Create agent with custom callback
          const agent = new AdvancedPLCAgent()

          // Track current step to prevent premature transitions
          let currentStep = 0

          // Set update callback for code/validation streaming
          agent.setUpdateCallback((data: any) => {
            // Forward all update events to client
            sendUpdate(data)
          })

          // Override log method to stream updates with explicit step management
          const originalLog = agent['log'].bind(agent)
          agent['log'] = (message: string) => {
            originalLog(message)

            // Send log message
            sendUpdate({ type: 'log', message })

            // Send explicit step updates based on markers
            if (message.includes('[PLAN_START]') && currentStep === 0) {
              currentStep = 1
              sendUpdate({
                type: 'step',
                step: 1,
                status: 'in_progress',
                title: '요청 분석 및 계획 수립',
                description: '사용자 요구사항을 분석하고 실행 계획을 생성하는 중...'
              })
            } else if (message.includes('[PLAN_COMPLETE]') && currentStep === 1) {
              const tasksMatch = message.match(/(\d+) steps/)
              const taskCount = tasksMatch ? tasksMatch[1] : '?'
              sendUpdate({
                type: 'step',
                step: 1,
                status: 'completed',
                description: `✅ ${taskCount}개의 작업 단계로 실행 계획 수립 완료`
              })
              // Mark step 1 as complete, allow step 2 to start
              currentStep = 1.5 // Intermediate state: step 1 done, step 2 can start
            } else if (message.includes('[CODE_GEN_START]') && currentStep >= 1.5) {
              if (currentStep < 2) currentStep = 2
              sendUpdate({
                type: 'step',
                step: 2,
                status: 'in_progress',
                title: '래더 로직 코드 생성',
                description: 'IEC 61131-3 표준에 따라 PLC 래더 로직을 생성하는 중...'
              })
            } else if (message.includes('[CODE_GEN_COMPLETE]') && currentStep === 2) {
              const networkMatch = message.match(/(\d+) networks/)
              const ioMatch = message.match(/I\/O Mapping: (\w+)/)
              const networks = networkMatch ? networkMatch[1] : '?'
              const hasIO = ioMatch && ioMatch[1] === 'Yes'
              sendUpdate({
                type: 'step',
                step: 2,
                status: 'completed',
                description: `✅ ${networks}개 네트워크 생성 완료${hasIO ? ', I/O 매핑 포함' : ''}`
              })
              // Mark step 2 as complete, allow step 3 to start
              currentStep = 2.5
            } else if (message.includes('[VALIDATION_START]') && currentStep >= 2.5) {
              if (currentStep < 3) currentStep = 3
              sendUpdate({
                type: 'step',
                step: 3,
                status: 'in_progress',
                title: '코드 검증',
                description: '파싱, 시뮬레이션, 로직 패턴을 검증하는 중...'
              })
            } else if (message.includes('[VALIDATION_COMPLETE]') && currentStep === 3) {
              if (message.includes('Success!')) {
                const networkMatch = message.match(/Networks: (\d+)/)
                const ioMatch = message.match(/I\/O: (\d+)/)
                const networks = networkMatch ? networkMatch[1] : '?'
                const ioCount = ioMatch ? ioMatch[1] : '?'
                sendUpdate({
                  type: 'step',
                  step: 3,
                  status: 'completed',
                  description: `✅ 검증 성공! ${networks}개 네트워크, ${ioCount}개 I/O 확인됨`
                })
                // Validation successful, no need for step 4
                currentStep = 3.5
              } else if (message.includes('Failed')) {
                const errorMatch = message.match(/Errors: (\d+)/)
                const warningMatch = message.match(/Warnings: (\d+)/)
                const errors = errorMatch ? errorMatch[1] : '?'
                const warnings = warningMatch ? warningMatch[1] : '0'
                sendUpdate({
                  type: 'step',
                  step: 3,
                  status: 'completed',
                  description: `⚠️ 검증 완료 - ${errors}개 에러, ${warnings}개 경고 발견 (자동 수정 진행)`
                })
                // Validation failed, allow step 4 (fix) to start
                currentStep = 3.5
              } else {
                sendUpdate({
                  type: 'step',
                  step: 3,
                  status: 'completed',
                  description: '검증 완료'
                })
                currentStep = 3.5
              }
            } else if (message.includes('[FIX_START]') && currentStep >= 3.5) {
              if (currentStep < 4) currentStep = 4
              sendUpdate({
                type: 'step',
                step: 4,
                status: 'in_progress',
                title: '문제 자동 수정',
                description: '발견된 문제를 AI가 자동으로 수정하는 중...'
              })
            } else if (message.includes('Preparing to regenerate') && currentStep === 4) {
              // Fix step completed, reset to allow next iteration
              sendUpdate({
                type: 'step',
                step: 4,
                status: 'completed',
                description: '문제 분석 완료, 다음 반복에서 코드 재생성 시작'
              })
              // Reset to allow next code generation
              currentStep = 1.5
            }
          }

          // Send initial status
          sendUpdate({ type: 'start', message: 'Agent started' })

          // Execute agent - NO TIMEOUT because we're streaming keep-alive messages
          // As long as we keep sending data, Netlify won't timeout
          const result = await agent.execute(request, existingCode)

          // Send final result
          sendUpdate({ type: 'complete', result })
          sendUpdate({ type: 'done' })

          controller.close()

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error('[Agent API] Execution error:', errorMessage)
          console.error('[Agent API] Error stack:', error instanceof Error ? error.stack : 'No stack')

          controller.enqueue(encoder.encode(`data: ${JSON.stringify({
            type: 'error',
            message: errorMessage,
            details: error instanceof Error ? error.stack : undefined
          })}\n\n`))
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('[Agent API] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500 }
    )
  }
}

export const maxDuration = 300 // 5 minutes for complex requests