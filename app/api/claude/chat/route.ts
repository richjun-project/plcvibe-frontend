import { NextRequest, NextResponse } from 'next/server'
import { createAIClient } from '@/lib/ai/client'
import { PLC_SYSTEM_PROMPT } from '@/lib/ai/prompts/system'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: 'Invalid messages format' },
        { status: 400 }
      )
    }

    const ai = createAIClient()

    // Convert messages format and add system prompt
    const geminiMessages = [
      { role: 'user' as const, parts: PLC_SYSTEM_PROMPT },
      { role: 'model' as const, parts: 'I understand. I am ready to assist with PLC programming.' },
      ...messages.map((msg: any) => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: msg.content
      })),
    ]

    const response = await ai.chat(geminiMessages)

    return NextResponse.json(response)
  } catch (error) {
    console.error('Gemini API error:', error)
    return NextResponse.json(
      { error: 'Failed to get response from AI' },
      { status: 500 }
    )
  }
}