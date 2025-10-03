import { NextRequest } from 'next/server'
import { createAIClient } from '@/lib/ai/client'
import { PLC_SYSTEM_PROMPT } from '@/lib/ai/prompts/system'

export async function POST(req: NextRequest) {
  try {
    const { messages } = await req.json()

    if (!messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid messages format' }),
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

    const stream = ai.chatStream(geminiMessages)

    const encoder = new TextEncoder()

    const readableStream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of stream) {
            if (chunk.type === 'content_block_delta' && chunk.delta?.type === 'text_delta') {
              const text = chunk.delta.text
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
            }
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'))
          controller.close()
        } catch (error) {
          controller.error(error)
        }
      },
    })

    return new Response(readableStream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })
  } catch (error) {
    console.error('Gemini streaming error:', error)
    return new Response(
      JSON.stringify({ error: 'Failed to stream from AI' }),
      { status: 500 }
    )
  }
}