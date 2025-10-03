import { NextRequest, NextResponse } from 'next/server'
import { AutoDebugAgent } from '@/lib/ai/agent/auto-debug-agent'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { rateLimiter } from '@/lib/ai/rate-limiter'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json()

    if (!code) {
      return NextResponse.json(
        { error: 'No code provided' },
        { status: 400 }
      )
    }

    const agent = new AutoDebugAgent()

    // AI 수정 함수 정의
    const generateFix = async (prompt: string): Promise<string> => {
      const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
      const model = genAI.getGenerativeModel({ model: modelName })

      // Use rate limiter to handle 429 errors
      const response = await rateLimiter.executeWithRetry(async () => {
        const result = await model.generateContent(prompt)
        return result.response.text()
      }, {
        onRetry: (attempt, delay) => {
          console.log(`[AutoDebug] Rate limit hit. Retrying (${attempt}) after ${delay}ms...`)
        }
      })

      // ```ladder 블록 추출
      const ladderMatch = response.match(/```ladder\n([\s\S]*?)\n```/)
      if (ladderMatch) {
        return ladderMatch[1]
      }

      return response
    }

    console.log('[API] Starting auto-debug loop...')

    // 자동 디버그 루프 실행
    const finalResult = await agent.autoDebugLoop(code, generateFix)

    return NextResponse.json({
      success: finalResult.success,
      issues: finalResult.issues,
      iteration: finalResult.iteration,
      history: agent.getHistory(),
      program: finalResult.program
    })

  } catch (error) {
    console.error('[API] Auto-debug error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}