"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, Upload as UploadIcon, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { MessageBubble } from "./MessageBubble"
import { LadderView } from "./LadderView"
import { CompactProgress } from "./CompactProgress"
import { PLCFileUploader } from "@/components/features/upload/PLCFileUploader"
import { useFileStore } from "@/lib/store/fileStore"
import { toast } from "sonner"
import { LadderProgram } from "@/lib/ladder/parser"
import { serializeLadderProgram } from "@/lib/ladder/serializer"

export interface Message {
  role: "user" | "assistant"
  content: string
}

export function ChatInterface() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [agentMode, setAgentMode] = useState<'normal' | 'advanced'>('advanced')

  // Compact state
  const [currentCode, setCurrentCode] = useState('')
  const [currentStep, setCurrentStep] = useState(0)
  const [totalSteps] = useState(4)
  const [stepName, setStepName] = useState('')
  const [iteration, setIteration] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [validationSuccess, setValidationSuccess] = useState(true)
  const [errorCount, setErrorCount] = useState(0)

  // Upload panel state
  const [showUploader, setShowUploader] = useState(false)
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [importedProgram, setImportedProgram] = useState<LadderProgram | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { files, createNewFile } = useFileStore()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!input.trim() || isLoading) return

    if (files.length === 0) {
      createNewFile()
    }

    const userMessage: Message = {
      role: "user",
      content: input.trim(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      let assistantContent = ''

      if (agentMode === 'advanced') {
        // Reset state
        setCurrentStep(0)
        setStepName('Initializing...')
        setIteration(0)
        setIsComplete(false)
        setValidationSuccess(true)
        setErrorCount(0)

        const response = await fetch('/api/agent/execute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            request: input.trim(),
            existingCode: currentCode // Pass existing code for context
          })
        })

        if (!response.body) {
          throw new Error('No response body')
        }

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''
        let result: any = null

        // Read streaming response
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n\n')
          buffer = lines.pop() || ''

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6))

              // Handle different event types
              if (data.type === 'step') {
                const { step, status, title, description } = data
                setCurrentStep(step)
                if (title) setStepName(title)
                if (description) setStepName(description)
              } else if (data.type === 'log') {
                const message = data.message

                // Update iteration
                if (message.includes('=== Iteration')) {
                  const match = message.match(/Iteration (\d+)/)
                  if (match) {
                    setIteration(parseInt(match[1]))
                  }
                }

                // Update step names based on markers
                if (message.includes('[PLAN_START]')) {
                  setCurrentStep(1)
                  setStepName('Planning')
                } else if (message.includes('[PLAN_COMPLETE]')) {
                  setCurrentStep(1)
                  setStepName('Plan Complete')
                } else if (message.includes('[CODE_GEN_START]')) {
                  setCurrentStep(2)
                  setStepName('Generating Code')
                } else if (message.includes('[CODE_GEN_COMPLETE]')) {
                  setCurrentStep(2)
                  setStepName('Code Generated')
                } else if (message.includes('[VALIDATION_START]')) {
                  setCurrentStep(3)
                  setStepName('Validating')
                } else if (message.includes('[VALIDATION_COMPLETE]')) {
                  setCurrentStep(3)
                  setStepName('Validation Complete')
                } else if (message.includes('[FIX_START]')) {
                  setCurrentStep(4)
                  setStepName('Fixing Issues')
                }
              } else if (data.type === 'code_generated') {
                // Update code immediately
                setCurrentCode(data.code)
              } else if (data.type === 'validation_result') {
                // Update validation status
                setValidationSuccess(data.success)
                setErrorCount(data.issues?.filter((i: any) => i.severity === 'error').length || 0)
              } else if (data.type === 'complete') {
                result = data.result
                console.log('[ChatInterface] Complete event received:', result)
                console.log('[ChatInterface] finalCode length:', result.finalCode?.length)
                if (result.finalCode) {
                  setCurrentCode(result.finalCode)
                  console.log('[ChatInterface] currentCode updated')
                }
                setIsComplete(true)
                setCurrentStep(4)
                assistantContent = result.success
                  ? `✅ Code generated successfully in ${result.iterations} iteration(s)`
                  : `⚠️ Generation completed with issues after ${result.iterations} iteration(s)`
              } else if (data.type === 'error') {
                throw new Error(data.message)
              }
            }
          }
        }

        if (!assistantContent) {
          assistantContent = '✅ Code generation complete'
        }

      } else {
        // Normal Chat Mode
        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [...messages, userMessage],
          })
        })

        if (!response.ok) {
          throw new Error('Failed to get response')
        }

        const data = await response.json()
        assistantContent = data.message
      }

      // Add assistant message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: assistantContent
      }])

    } catch (error) {
      console.error('[Chat] Error:', error)
      toast.error(error instanceof Error ? error.message : 'Unknown error')
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Error: ' + (error instanceof Error ? error.message : 'Unknown error')
      }])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  // Handle PLC file import
  const handleFileImport = async (program: LadderProgram, fileName: string, fileType: string) => {
    try {
      // Serialize program to ladder text
      const code = serializeLadderProgram(program)

      // Create or get session
      let sessionId = currentSessionId
      if (!sessionId) {
        const sessionResponse = await fetch('/api/workspace', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'create_session',
            sessionName: `Imported from ${fileName}`
          })
        })
        const sessionData = await sessionResponse.json()
        sessionId = sessionData.session.id
        setCurrentSessionId(sessionId)
      }

      // Save program to Supabase
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          filename: fileName,
          code,
          gridData: null // TODO: Convert to grid format
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save program')
      }

      const data = await response.json()

      // Update UI
      setImportedProgram(program)
      setCurrentCode(code)

      // Add system message
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `✅ Successfully imported ${fileName} (${fileType.toUpperCase()})\n\n${program.networks.length} networks imported with ${program.ioMap.length} I/O points.`
      }])

      toast.success(`Imported ${fileName}`)
      setShowUploader(false)

    } catch (error) {
      console.error('[Import] Error:', error)
      toast.error(error instanceof Error ? error.message : 'Import failed')
    }
  }

  const handleImportError = (error: string) => {
    toast.error(error)
  }

  return (
    <div className="flex flex-col h-full">
      {/* File Upload Section */}
      <div className="border-b border-gray-800 bg-gray-900/50">
        <button
          onClick={() => setShowUploader(!showUploader)}
          className="w-full px-4 py-2 flex items-center justify-between hover:bg-gray-800/50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <UploadIcon className="w-4 h-4 text-blue-400" />
            <span className="text-sm font-medium text-gray-300">Import PLC File</span>
            {currentSessionId && (
              <span className="text-xs text-gray-500 ml-2">
                (Session active)
              </span>
            )}
          </div>
          {showUploader ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </button>

        {showUploader && (
          <div className="px-4 pb-4 pt-2">
            <PLCFileUploader
              onImport={handleFileImport}
              onError={handleImportError}
            />
          </div>
        )}
      </div>

      {/* Agent Mode Toggle */}
      <div className="px-4 py-2 border-b border-gray-800 bg-gray-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Mode:</span>
            <button
              onClick={() => setAgentMode('advanced')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                agentMode === 'advanced'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Advanced
            </button>
            <button
              onClick={() => setAgentMode('normal')}
              className={`px-3 py-1 text-xs rounded transition-colors ${
                agentMode === 'normal'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
              }`}
            >
              Chat
            </button>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center mb-4">
              <Send className="w-8 h-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-2">PLC Code Generator</h3>
            <p className="text-gray-400 max-w-md">
              Generate, analyze, and test PLC ladder logic code
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 w-full max-w-2xl">
              <button
                onClick={() => setInput("3개 컨베이어 벨트를 5초 간격으로 순차 작동")}
                className="p-4 text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
              >
                <p className="text-sm font-medium text-gray-200 mb-1">컨베이어 순차 제어</p>
                <p className="text-xs text-gray-400">Sequential Conveyor</p>
              </button>
              <button
                onClick={() => setInput("자동 세차 시스템: 시작버튼 누르면 물분사(5초) → 세제분사(10초) → 헹굼(8초) → 건조(15초) 순서로 자동 실행")}
                className="p-4 text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
              >
                <p className="text-sm font-medium text-gray-200 mb-1">자동 세차 시스템</p>
                <p className="text-xs text-gray-400">Multi-stage Process</p>
              </button>
              <button
                onClick={() => setInput("신호등 제어: 빨강(30초) → 초록(25초) → 노랑(5초) 반복, 비상버튼 누르면 모든 신호등 빨강 점멸")}
                className="p-4 text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
              >
                <p className="text-sm font-medium text-gray-200 mb-1">신호등 자동 제어</p>
                <p className="text-xs text-gray-400">Traffic Light System</p>
              </button>
              <button
                onClick={() => setInput("모터 기동 회로")}
                className="p-4 text-left bg-gray-800/50 hover:bg-gray-800 border border-gray-700 rounded-lg transition-colors"
              >
                <p className="text-sm font-medium text-gray-200 mb-1">기본 모터 제어</p>
                <p className="text-xs text-gray-400">Motor Start/Stop</p>
              </button>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => (
              <MessageBubble key={index} message={message} />
            ))}

            {/* Loading State */}
            {isLoading && agentMode === 'advanced' && (
              <div className="space-y-4">
                <CompactProgress
                  currentStep={currentStep}
                  totalSteps={totalSteps}
                  stepName={stepName}
                  iteration={iteration}
                  isComplete={isComplete}
                />
              </div>
            )}

            {isLoading && agentMode === 'normal' && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            )}

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Ladder View - shown when code exists */}
      {currentCode && (
        <div className="px-4 pb-4">
          <LadderView
            code={currentCode}
            validationSuccess={validationSuccess}
            errorCount={errorCount}
            onCodeChange={(newCode) => setCurrentCode(newCode)}
          />
        </div>
      )}

      {/* Input Area */}
      <div className="border-t border-gray-800 p-4 bg-gray-900/50 backdrop-blur-sm">
        <form onSubmit={handleSubmit} className="flex gap-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe PLC logic... (Shift+Enter for new line)"
            className="min-h-[60px] max-h-[200px] resize-none"
            disabled={isLoading}
          />
          <Button
            type="submit"
            size="lg"
            disabled={!input.trim() || isLoading}
            className="self-end"
          >
            {isLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  )
}
