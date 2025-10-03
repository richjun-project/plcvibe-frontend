import { GoogleGenerativeAI } from '@google/generative-ai'

export type AIMessage = {
  role: 'user' | 'model'
  parts: string
}

export class GeminiService {
  private client: GoogleGenerativeAI
  private model: any

  constructor(apiKey: string, systemInstruction?: string) {
    this.client = new GoogleGenerativeAI(apiKey)
    // Use stable version instead of experimental for better reliability
    const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
    this.model = this.client.getGenerativeModel({
      model: modelName,
      systemInstruction: systemInstruction
    })
  }

  async chat(messages: AIMessage[], options?: {
    temperature?: number
    maxTokens?: number
  }) {
    const chat = this.model.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.parts }]
      })),
      generationConfig: {
        temperature: options?.temperature ?? 0.1, // Changed default from 0.7 to 0.1 for consistency
        maxOutputTokens: options?.maxTokens || 8192,
      },
    })

    const lastMessage = messages[messages.length - 1]
    const result = await chat.sendMessage(lastMessage.parts)
    const response = result.response

    return {
      content: [{
        text: response.text()
      }]
    }
  }

  async *chatStream(messages: AIMessage[], options?: {
    temperature?: number
    maxTokens?: number
  }) {
    const chat = this.model.startChat({
      history: messages.slice(0, -1).map(msg => ({
        role: msg.role,
        parts: [{ text: msg.parts }]
      })),
      generationConfig: {
        temperature: options?.temperature ?? 0.1, // Changed default from 0.7 to 0.1 for consistency
        maxOutputTokens: options?.maxTokens || 8192,
      },
    })

    const lastMessage = messages[messages.length - 1]
    const result = await chat.sendMessageStream(lastMessage.parts)

    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        yield {
          type: 'content_block_delta' as const,
          delta: {
            type: 'text_delta' as const,
            text: text
          }
        }
      }
    }
  }
}

// Server-side only
export function createAIClient(systemInstruction?: string) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY is not set')
  }
  return new GeminiService(process.env.GEMINI_API_KEY, systemInstruction)
}