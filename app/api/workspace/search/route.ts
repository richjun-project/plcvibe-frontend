import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseWorkspace } from '@/lib/workspace/supabase-workspace'

/**
 * Workspace Search API (Supabase)
 *
 * 프로그램 코드 검색
 */

/**
 * GET /api/workspace/search?sessionId=xxx&query=yyy
 * 프로그램 코드 검색
 */
export async function GET(req: NextRequest) {
  try {
    const workspace = getSupabaseWorkspace()
    const { searchParams } = new URL(req.url)
    const sessionId = searchParams.get('sessionId')
    const query = searchParams.get('query')

    if (!sessionId || !query) {
      return NextResponse.json(
        { error: 'Missing required parameters: sessionId, query' },
        { status: 400 }
      )
    }

    // Get all programs in session
    const programs = await workspace.listPrograms(sessionId)

    // Search in program code
    const results = programs
      .filter(program => {
        const code = program.code || ''
        return code.toLowerCase().includes(query.toLowerCase())
      })
      .map(program => {
        const lines = (program.code || '').split('\n')
        const matches = lines
          .map((line, index) => ({ line: index + 1, content: line }))
          .filter(l => l.content.toLowerCase().includes(query.toLowerCase()))

        return {
          program: program.name,
          programId: program.id,
          matches
        }
      })
      .filter(r => r.matches.length > 0)

    return NextResponse.json({
      success: true,
      query,
      sessionId,
      results,
      totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0)
    })

  } catch (error) {
    console.error('[Workspace Search API] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    )
  }
}