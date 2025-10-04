// Supabase Edge Function for PLC Agent
// No timeout limitations! Can run up to 150 seconds

import { GoogleGenerativeAI } from "npm:@google/generative-ai@^0.21.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { request, existingCode } = await req.json()

    if (!request) {
      return new Response(
        JSON.stringify({ error: 'No request provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY')
    const GEMINI_MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash-exp'

    if (!GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    console.log('[Agent API] Starting advanced agent for:', request)

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY)

    // Create streaming response
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()

        const sendUpdate = (data: any) => {
          const message = `data: ${JSON.stringify(data)}\n\n`
          controller.enqueue(encoder.encode(message))
        }

        try {
          sendUpdate({ type: 'start', message: 'Agent started' })
          sendUpdate({ type: 'log', message: '🤖 [AGENT_START] Advanced PLC Agent started' })
          sendUpdate({ type: 'log', message: `📝 User Request: ${request}` })

          // Step 1: Planning
          sendUpdate({ type: 'step', step: 1, status: 'in_progress', title: '요청 분석 및 계획 수립' })
          sendUpdate({ type: 'log', message: '🧠 [PLAN_START] Analyzing request and creating plan...' })

          const planningModel = genAI.getGenerativeModel({ model: GEMINI_MODEL })
          const planningPrompt = `You are an expert PLC programming agent. Analyze this request and create a detailed plan.

User Request: "${request}"${existingCode ? `\n\nEXISTING CODE TO MODIFY:\n${existingCode}` : ''}

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

          let planResponse = ''
          const planResult = await planningModel.generateContentStream(planningPrompt)

          for await (const chunk of planResult.stream) {
            planResponse += chunk.text()
            sendUpdate({ type: 'heartbeat', message: 'Planning...' })
          }

          const jsonMatch = planResponse.match(/\{[\s\S]*\}/)
          if (!jsonMatch) {
            throw new Error('Failed to parse plan from AI response')
          }

          const planData = JSON.parse(jsonMatch[0])
          sendUpdate({ type: 'log', message: `📋 [PLAN_COMPLETE] Plan created with ${planData.tasks.length} steps` })
          sendUpdate({ type: 'step', step: 1, status: 'completed', description: `✅ ${planData.tasks.length}개의 작업 단계로 실행 계획 수립 완료` })

          // Step 2: Code Generation
          sendUpdate({ type: 'step', step: 2, status: 'in_progress', title: '래더 로직 코드 생성' })
          sendUpdate({ type: 'log', message: '💻 [CODE_GEN_START] Generating ladder logic code...' })
          sendUpdate({ type: 'log', message: '⏱️ [API_CALL] Starting Gemini streaming API call...' })

          const codeModel = genAI.getGenerativeModel({
            model: GEMINI_MODEL,
            systemInstruction: `You are an expert PLC (Programmable Logic Controller) programmer generating IEC 61131-3 ladder logic code.

CRITICAL RULES:
1. You are generating PLAIN TEXT ladder logic code, NOT markdown documentation
2. NEVER use markdown formatting (**, ##, tables, etc.)
3. ALWAYS follow the exact format specified in the user prompt
4. Network headers must be plain text: "Network 1: Description" (NO ** bold **)
5. I/O Mapping must be a plain list (NO markdown tables)
6. Each ladder network must be on ONE single line
7. Use ONLY these connection formats: --, [ ], ( ), [/ ], [TON ...]

If you generate markdown formatting, your output will FAIL parsing and cause errors.`,
            generationConfig: {
              temperature: 0.1,
              maxOutputTokens: 8192,
            }
          })

          const codePrompt = `Generate PLC Ladder Logic for: ${request}

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

          let codeResponse = ''
          let chunkCount = 0
          const codeResult = await codeModel.generateContentStream(codePrompt)

          for await (const chunk of codeResult.stream) {
            codeResponse += chunk.text()
            chunkCount++

            if (chunkCount % 3 === 0) {
              const partialMatch = codeResponse.match(/```ladder\n([\s\S]*?)($|```)/i)
              if (partialMatch && partialMatch[1].length > 0) {
                sendUpdate({
                  type: 'partial_code',
                  code: partialMatch[1],
                  progress: 'generating'
                })
              } else {
                sendUpdate({ type: 'heartbeat', message: `Generating code... ${chunkCount} chunks` })
              }
            }
          }

          const ladderMatch = codeResponse.match(/```ladder\n([\s\S]*?)\n```/)
          if (!ladderMatch) {
            throw new Error('No ladder code block found in AI response')
          }

          const finalCode = ladderMatch[1]
          const networkCount = (finalCode.match(/^Network \d+:/gm) || []).length

          sendUpdate({ type: 'log', message: `✅ [CODE_GEN_COMPLETE] Generated ${networkCount} networks` })
          sendUpdate({ type: 'code_generated', code: finalCode })
          sendUpdate({ type: 'step', step: 2, status: 'completed', description: `✅ ${networkCount}개 네트워크 생성 완료` })

          // Complete
          const result = {
            success: true,
            finalCode,
            iterations: 1,
            logs: []
          }

          sendUpdate({ type: 'complete', result })
          sendUpdate({ type: 'done' })

          controller.close()

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          console.error('[Agent API] Error:', errorMessage)
          sendUpdate({ type: 'error', message: errorMessage })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    })

  } catch (error) {
    console.error('[Agent API] Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
