"use client"

import React, { Component, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Error info:', errorInfo)

    this.setState({
      error,
      errorInfo
    })
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="border-2 border-red-500/50 rounded-lg p-6 bg-red-900/10">
          <div className="flex items-start gap-4">
            <AlertTriangle className="w-8 h-8 text-red-500 flex-shrink-0 mt-1" />
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-lg font-semibold text-red-400 mb-1">
                  Ladder Diagram Error
                </h3>
                <p className="text-sm text-gray-300">
                  Something went wrong while rendering the ladder diagram. This might be due to:
                </p>
                <ul className="list-disc list-inside text-sm text-gray-400 mt-2 space-y-1">
                  <li>Invalid ladder logic format from AI response</li>
                  <li>Parsing error in the ladder code</li>
                  <li>Simulator initialization failure</li>
                </ul>
              </div>

              {this.state.error && (
                <div className="bg-black/30 rounded p-3 border border-red-700/30">
                  <div className="text-xs font-mono text-red-300 mb-1">Error Details:</div>
                  <div className="text-xs font-mono text-gray-400 break-all">
                    {this.state.error.message}
                  </div>
                </div>
              )}

              {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
                <details className="bg-black/30 rounded p-3 border border-gray-700">
                  <summary className="text-xs font-mono text-gray-400 cursor-pointer hover:text-gray-300">
                    Stack Trace (Development Only)
                  </summary>
                  <pre className="text-[10px] font-mono text-gray-500 mt-2 overflow-x-auto">
                    {this.state.errorInfo.componentStack}
                  </pre>
                </details>
              )}

              <div className="flex gap-2">
                <Button
                  onClick={this.handleReset}
                  variant="outline"
                  size="sm"
                  className="border-red-500/50 text-red-400 hover:bg-red-900/20"
                >
                  Try Again
                </Button>
                <Button
                  onClick={() => window.location.reload()}
                  variant="ghost"
                  size="sm"
                  className="text-gray-400"
                >
                  Reload Page
                </Button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}