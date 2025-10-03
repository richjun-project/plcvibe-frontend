/**
 * Supabase Workspace Manager
 *
 * 세션 및 래더 프로그램을 Supabase 데이터베이스에 저장/관리
 * 모든 데이터는 DB 테이블에 직접 저장됨 (Storage 사용 안 함)
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface Session {
  id: string
  user_id: string | null
  session_name: string | null
  created_at: string
  updated_at: string
  metadata: Record<string, any>
  created_by_agent: boolean
}

export interface LadderProgram {
  id: string
  session_id: string
  name: string
  code: string
  grid_data: any | null
  file_type: string | null
  created_at: string
  updated_at: string
}

export interface ValidationResult {
  id: string
  program_id: string
  validation_data: any
  passed: boolean
  error_count: number
  created_at: string
}

export class SupabaseWorkspace {
  private supabase: SupabaseClient

  constructor(supabaseUrl?: string, supabaseKey?: string) {
    // 환경 변수 또는 인자로 받은 값 사용
    const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL!
    const key = supabaseKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    this.supabase = createClient(url, key)
  }

  /**
   * 현재 사용자 ID 가져오기
   */
  async getCurrentUserId(): Promise<string | null> {
    const { data: { user } } = await this.supabase.auth.getUser()
    return user?.id || null
  }

  // ==================== 세션 관리 ====================

  /**
   * 새 세션 생성
   */
  async createSession(sessionName?: string, metadata?: Record<string, any>, isAgentSession = false): Promise<Session> {
    const userId = await this.getCurrentUserId()

    // Agent sessions don't require user authentication
    if (!userId && !isAgentSession) {
      throw new Error('User not authenticated')
    }

    const { data, error } = await this.supabase
      .from('sessions')
      .insert({
        user_id: userId,
        session_name: sessionName || `Session ${new Date().toLocaleDateString()}`,
        metadata: metadata || {},
        created_by_agent: isAgentSession
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * 세션 조회
   */
  async getSession(sessionId: string): Promise<Session | null> {
    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single()

    if (error) {
      console.error('Failed to get session:', error)
      return null
    }

    return data
  }

  /**
   * 사용자의 모든 세션 목록
   */
  async listSessions(): Promise<Session[]> {
    const userId = await this.getCurrentUserId()
    if (!userId) return []

    const { data, error } = await this.supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to list sessions:', error)
      return []
    }

    return data || []
  }

  /**
   * 세션 업데이트
   */
  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .update(updates)
      .eq('id', sessionId)

    if (error) throw error
  }

  /**
   * 세션 삭제 (CASCADE로 관련 프로그램도 삭제)
   */
  async deleteSession(sessionId: string): Promise<void> {
    const { error } = await this.supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId)

    if (error) throw error
  }

  // ==================== 프로그램 관리 ====================

  /**
   * 래더 프로그램 저장
   */
  async saveProgram(
    sessionId: string,
    name: string,
    code: string,
    gridData?: any,
    fileType?: string
  ): Promise<LadderProgram> {
    const { data, error } = await this.supabase
      .from('ladder_programs')
      .insert({
        session_id: sessionId,
        name,
        code,
        grid_data: gridData || null,
        file_type: fileType || null
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * 프로그램 조회
   */
  async getProgram(programId: string): Promise<LadderProgram | null> {
    const { data, error } = await this.supabase
      .from('ladder_programs')
      .select('*')
      .eq('id', programId)
      .single()

    if (error) {
      console.error('Failed to get program:', error)
      return null
    }

    return data
  }

  /**
   * 세션의 모든 프로그램 목록
   */
  async listPrograms(sessionId: string): Promise<LadderProgram[]> {
    const { data, error } = await this.supabase
      .from('ladder_programs')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to list programs:', error)
      return []
    }

    return data || []
  }

  /**
   * 프로그램 업데이트
   */
  async updateProgram(programId: string, updates: Partial<LadderProgram>): Promise<void> {
    const { error } = await this.supabase
      .from('ladder_programs')
      .update(updates)
      .eq('id', programId)

    if (error) throw error
  }

  /**
   * 프로그램 삭제
   */
  async deleteProgram(programId: string): Promise<void> {
    const { error } = await this.supabase
      .from('ladder_programs')
      .delete()
      .eq('id', programId)

    if (error) throw error
  }

  // ==================== 검증 결과 관리 ====================

  /**
   * 검증 결과 저장
   */
  async saveValidation(
    programId: string,
    validationData: any,
    passed: boolean,
    errorCount: number = 0
  ): Promise<ValidationResult> {
    const { data, error } = await this.supabase
      .from('validation_results')
      .insert({
        program_id: programId,
        validation_data: validationData,
        passed,
        error_count: errorCount
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  /**
   * 프로그램의 검증 결과 목록
   */
  async getValidations(programId: string): Promise<ValidationResult[]> {
    const { data, error } = await this.supabase
      .from('validation_results')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Failed to get validations:', error)
      return []
    }

    return data || []
  }

  /**
   * 최신 검증 결과 조회
   */
  async getLatestValidation(programId: string): Promise<ValidationResult | null> {
    const { data, error } = await this.supabase
      .from('validation_results')
      .select('*')
      .eq('program_id', programId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (error) {
      console.error('Failed to get latest validation:', error)
      return null
    }

    return data
  }
}

// Singleton instances
let workspaceInstance: SupabaseWorkspace | null = null
let serverWorkspaceInstance: SupabaseWorkspace | null = null

/**
 * 클라이언트 사이드 워크스페이스 (사용자 인증 필요)
 */
export function getSupabaseWorkspace(): SupabaseWorkspace {
  if (!workspaceInstance) {
    workspaceInstance = new SupabaseWorkspace()
  }
  return workspaceInstance
}

/**
 * 서버 사이드 워크스페이스 (Service Role Key 사용, RLS 우회)
 * Agent API 등 서버 사이드에서만 사용
 */
export function getServerWorkspace(): SupabaseWorkspace {
  if (!serverWorkspaceInstance) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    serverWorkspaceInstance = new SupabaseWorkspace(url, serviceKey)
  }
  return serverWorkspaceInstance
}
