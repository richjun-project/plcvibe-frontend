import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseWorkspace } from '@/lib/workspace/supabase-workspace'

/**
 * Workspace API (Supabase)
 *
 * 세션과 프로그램을 Supabase에 저장, 읽기, 관리하는 API
 */

/**
 * POST /api/workspace
 * 프로그램 저장 또는 세션 생성
 */
export async function POST(req: NextRequest) {
  try {
    const workspace = getSupabaseWorkspace()
    const body = await req.json()
    const { action, sessionId, sessionName, filename, content, code, gridData, metadata } = body

    // Create new session
    if (action === 'create_session') {
      const session = await workspace.createSession(sessionName, metadata)
      return NextResponse.json({
        success: true,
        session
      })
    }

    // Save program/file
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Missing sessionId' },
        { status: 400 }
      )
    }

    // Ensure session exists (get or create)
    let session = await workspace.getSession(sessionId)
    if (!session) {
      session = await workspace.createSession(sessionName || 'Unnamed Session')
    }

    // Save as ladder program
    const programName = filename || 'program.lad'
    const programCode = code || content || ''

    const program = await workspace.saveProgram(
      session.id,
      programName,
      programCode,
      gridData
    )

    return NextResponse.json({
      success: true,
      program,
      sessionId: session.id
    })

  } catch (error) {
    console.error('[Workspace API] Save error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/workspace?sessionId=xxx&programId=yyy
 * 세션/프로그램 조회
 */
export async function GET(req: NextRequest) {
  try {
    const workspace = getSupabaseWorkspace()
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const programId = searchParams.get('programId')
    const action = searchParams.get('action') // 'sessions' | 'programs' | 'program'

    // List all sessions
    if (action === 'sessions') {
      const sessions = await workspace.listSessions()
      return NextResponse.json({ success: true, sessions })
    }

    // Get specific session
    if (sessionId && !programId && action !== 'programs') {
      const session = await workspace.getSession(sessionId)
      if (!session) {
        return NextResponse.json(
          { error: 'Session not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, session })
    }

    // List programs in session
    if (sessionId && (action === 'programs' || !programId)) {
      const programs = await workspace.listPrograms(sessionId)
      return NextResponse.json({ success: true, programs, sessionId })
    }

    // Get specific program
    if (programId) {
      const program = await workspace.getProgram(programId)
      if (!program) {
        return NextResponse.json(
          { error: 'Program not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ success: true, program })
    }

    return NextResponse.json(
      { error: 'Missing required parameters' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[Workspace API] Read error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to read' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/workspace
 * 세션 또는 프로그램 삭제
 */
export async function DELETE(req: NextRequest) {
  try {
    const workspace = getSupabaseWorkspace()
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const programId = searchParams.get('programId')

    // Delete specific program
    if (programId) {
      await workspace.deleteProgram(programId)
      return NextResponse.json({
        success: true,
        message: `Program ${programId} deleted`
      })
    }

    // Delete entire session (CASCADE will delete all programs)
    if (sessionId) {
      await workspace.deleteSession(sessionId)
      return NextResponse.json({
        success: true,
        message: `Session ${sessionId} deleted`
      })
    }

    return NextResponse.json(
      { error: 'Missing sessionId or programId parameter' },
      { status: 400 }
    )

  } catch (error) {
    console.error('[Workspace API] Delete error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to delete' },
      { status: 500 }
    )
  }
}