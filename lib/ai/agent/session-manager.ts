/**
 * Session Manager (Supabase)
 *
 * 에이전트 세션을 Supabase에 생성하고 관리합니다.
 * 각 세션은 고유한 UUID를 가지며, 해당 세션의 모든 프로그램을 추적합니다.
 */

import type { Session } from '@/lib/workspace/supabase-workspace'

export interface SessionMetadata {
  userRequest: string
  status: 'running' | 'completed' | 'failed'
  iterations: number
  finalCode?: string
  logs: string[]
}

export class SessionManager {
  /**
   * 새 세션 생성 (Supabase)
   */
  static async createSession(userRequest: string, metadata?: SessionMetadata): Promise<Session> {
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_session',
          sessionName: userRequest.substring(0, 100), // Limit length
          metadata: metadata || { userRequest, status: 'running', iterations: 0, logs: [] }
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to create session')
      }

      const data = await response.json()
      console.log(`[SessionManager] Created session: ${data.session.id}`)
      return data.session
    } catch (error) {
      console.error('[SessionManager] Failed to create session:', error)
      throw error
    }
  }

  /**
   * 세션 조회
   */
  static async getSession(sessionId: string): Promise<Session | null> {
    try {
      const response = await fetch(`/api/workspace?sessionId=${sessionId}`)

      if (!response.ok) {
        return null
      }

      const data = await response.json()
      return data.session
    } catch (error) {
      console.error('[SessionManager] Failed to get session:', error)
      return null
    }
  }

  /**
   * 모든 세션 목록
   */
  static async listSessions(): Promise<Session[]> {
    try {
      const response = await fetch('/api/workspace?action=sessions')

      if (!response.ok) {
        throw new Error('Failed to list sessions')
      }

      const data = await response.json()
      return data.sessions || []
    } catch (error) {
      console.error('[SessionManager] Failed to list sessions:', error)
      return []
    }
  }

  /**
   * 세션 삭제
   */
  static async deleteSession(sessionId: string): Promise<void> {
    try {
      const response = await fetch(
        `/api/workspace?sessionId=${sessionId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to delete session')
      }

      console.log(`[SessionManager] Session deleted: ${sessionId}`)
    } catch (error) {
      console.error('[SessionManager] Failed to delete session:', error)
      throw error
    }
  }

  /**
   * 세션 타임스탬프를 사람이 읽기 쉬운 형식으로 변환
   */
  static formatTimestamp(timestamp: string): string {
    const date = new Date(timestamp)
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    })
  }
}