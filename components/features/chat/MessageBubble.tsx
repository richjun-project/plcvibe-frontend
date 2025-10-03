"use client"

import { User, Bot, Brain } from "lucide-react"
import { cn } from "@/lib/utils/cn"
import { LadderVisualization } from "./LadderVisualization"
import type { Message } from "./ChatInterface"

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === "user"

  // Parse message content for code blocks
  const renderContent = () => {
    const content = message.content
    const parts: JSX.Element[] = []
    let lastIndex = 0

    // Match thinking blocks
    const thinkingRegex = /```thinking\n([\s\S]*?)```/g
    // Match ladder blocks
    const ladderRegex = /```ladder\n([\s\S]*?)```/g
    // Match explanation blocks
    const explanationRegex = /```explanation\n([\s\S]*?)```/g

    let match

    // Process all code blocks
    const allMatches: Array<{ type: string; start: number; end: number; content: string }> = []

    while ((match = thinkingRegex.exec(content)) !== null) {
      allMatches.push({ type: 'thinking', start: match.index, end: match.index + match[0].length, content: match[1] })
    }

    thinkingRegex.lastIndex = 0
    while ((match = ladderRegex.exec(content)) !== null) {
      allMatches.push({ type: 'ladder', start: match.index, end: match.index + match[0].length, content: match[1] })
    }

    ladderRegex.lastIndex = 0
    while ((match = explanationRegex.exec(content)) !== null) {
      allMatches.push({ type: 'explanation', start: match.index, end: match.index + match[0].length, content: match[1] })
    }

    // Sort by position
    allMatches.sort((a, b) => a.start - b.start)

    allMatches.forEach((match, idx) => {
      // Add text before this match
      if (match.start > lastIndex) {
        const text = content.substring(lastIndex, match.start)
        if (text.trim()) {
          parts.push(
            <div key={`text-${idx}`} className="whitespace-pre-wrap break-words text-sm leading-relaxed mb-3">
              {text}
            </div>
          )
        }
      }

      // Add the matched block
      if (match.type === 'thinking') {
        parts.push(
          <div key={`thinking-${idx}`} className="mb-4 p-3 bg-purple-600/10 border border-purple-500/30 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-purple-400" />
              <span className="text-xs font-semibold text-purple-400">Thinking Process</span>
            </div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap">{match.content.trim()}</div>
          </div>
        )
      } else if (match.type === 'ladder') {
        parts.push(
          <div key={`ladder-${idx}`} className="mb-4">
            <div className="text-xs font-semibold text-blue-400 mb-2">Ladder Logic</div>
            <LadderVisualization code={match.content} />
          </div>
        )
      } else if (match.type === 'explanation') {
        parts.push(
          <div key={`explanation-${idx}`} className="mb-4 p-3 bg-green-600/10 border border-green-500/30 rounded-lg">
            <div className="text-xs font-semibold text-green-400 mb-2">Explanation</div>
            <div className="text-sm text-gray-300 whitespace-pre-wrap">{match.content.trim()}</div>
          </div>
        )
      }

      lastIndex = match.end
    })

    // Add remaining text
    if (lastIndex < content.length) {
      const text = content.substring(lastIndex)
      if (text.trim()) {
        parts.push(
          <div key="text-final" className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {text}
          </div>
        )
      }
    }

    return parts.length > 0 ? parts : <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{content}</div>
  }

  return (
    <div
      className={cn(
        "flex gap-3 max-w-5xl",
        isUser ? "ml-auto flex-row-reverse" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
          isUser
            ? "bg-gradient-to-br from-gray-700 to-gray-800"
            : "bg-gradient-to-br from-blue-600 to-blue-700"
        )}
      >
        {isUser ? (
          <User className="w-5 h-5 text-gray-100" />
        ) : (
          <Bot className="w-5 h-5 text-white" />
        )}
      </div>

      <div
        className={cn(
          "flex-1 rounded-2xl px-4 py-3 backdrop-blur-sm",
          isUser
            ? "bg-gray-800/50 border border-gray-700"
            : "bg-gradient-to-br from-blue-600/10 to-blue-700/10 border border-blue-500/20 shadow-lg shadow-blue-500/5"
        )}
      >
        <div className="prose prose-invert max-w-none">
          {renderContent()}
        </div>
      </div>
    </div>
  )
}