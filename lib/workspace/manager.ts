/**
 * Workspace Manager
 *
 * 에이전트가 생성한 파일을 로컬 파일 시스템에 저장하고 관리합니다.
 * Bolt/Cursor처럼 파일을 실제로 저장하고 검색할 수 있습니다.
 */

import fs from 'fs/promises'
import path from 'path'

export class WorkspaceManager {
  private workspaceRoot: string

  constructor(rootPath?: string) {
    // Default: workspace/ directory in project root
    this.workspaceRoot = rootPath || path.join(process.cwd(), 'workspace')
  }

  /**
   * Workspace 초기화 (디렉토리 생성)
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.workspaceRoot, { recursive: true })
      await fs.mkdir(path.join(this.workspaceRoot, 'sessions'), { recursive: true })
      console.log(`[Workspace] Initialized at: ${this.workspaceRoot}`)
    } catch (error) {
      console.error('[Workspace] Failed to initialize:', error)
      throw error
    }
  }

  /**
   * 세션 디렉토리 생성
   */
  async createSessionDir(sessionId: string): Promise<string> {
    const sessionPath = path.join(this.workspaceRoot, 'sessions', sessionId)
    await fs.mkdir(sessionPath, { recursive: true })
    console.log(`[Workspace] Session directory created: ${sessionPath}`)
    return sessionPath
  }

  /**
   * 파일 저장
   */
  async saveFile(sessionId: string, filename: string, content: string): Promise<string> {
    const sessionPath = path.join(this.workspaceRoot, 'sessions', sessionId)
    const filePath = path.join(sessionPath, filename)

    await fs.writeFile(filePath, content, 'utf-8')
    const stats = await fs.stat(filePath)

    console.log(`[Workspace] File saved: ${filename} (${stats.size} bytes)`)
    return filePath
  }

  /**
   * 파일 읽기
   */
  async readFile(sessionId: string, filename: string): Promise<string> {
    const filePath = path.join(this.workspaceRoot, 'sessions', sessionId, filename)
    const content = await fs.readFile(filePath, 'utf-8')
    console.log(`[Workspace] File read: ${filename}`)
    return content
  }

  /**
   * 파일 존재 확인
   */
  async fileExists(sessionId: string, filename: string): Promise<boolean> {
    try {
      const filePath = path.join(this.workspaceRoot, 'sessions', sessionId, filename)
      await fs.access(filePath)
      return true
    } catch {
      return false
    }
  }

  /**
   * 세션의 모든 파일 목록
   */
  async listFiles(sessionId: string): Promise<string[]> {
    const sessionPath = path.join(this.workspaceRoot, 'sessions', sessionId)

    try {
      const files = await fs.readdir(sessionPath)
      return files.filter(file => !file.startsWith('.'))
    } catch (error) {
      console.error(`[Workspace] Failed to list files in session ${sessionId}:`, error)
      return []
    }
  }

  /**
   * 파일 검색 (내용 검색)
   */
  async searchInFiles(sessionId: string, query: string): Promise<Array<{
    file: string
    matches: Array<{ line: number; content: string }>
  }>> {
    const files = await this.listFiles(sessionId)
    const results: Array<{
      file: string
      matches: Array<{ line: number; content: string }>
    }> = []

    for (const file of files) {
      try {
        const content = await this.readFile(sessionId, file)
        const lines = content.split('\n')
        const matches: Array<{ line: number; content: string }> = []

        lines.forEach((line, index) => {
          if (line.toLowerCase().includes(query.toLowerCase())) {
            matches.push({
              line: index + 1,
              content: line.trim()
            })
          }
        })

        if (matches.length > 0) {
          results.push({ file, matches })
        }
      } catch (error) {
        console.error(`[Workspace] Error searching in file ${file}:`, error)
      }
    }

    return results
  }

  /**
   * 파일 삭제
   */
  async deleteFile(sessionId: string, filename: string): Promise<void> {
    const filePath = path.join(this.workspaceRoot, 'sessions', sessionId, filename)
    await fs.unlink(filePath)
    console.log(`[Workspace] File deleted: ${filename}`)
  }

  /**
   * 세션 전체 삭제
   */
  async deleteSession(sessionId: string): Promise<void> {
    const sessionPath = path.join(this.workspaceRoot, 'sessions', sessionId)
    await fs.rm(sessionPath, { recursive: true, force: true })
    console.log(`[Workspace] Session deleted: ${sessionId}`)
  }

  /**
   * 모든 세션 목록
   */
  async listSessions(): Promise<string[]> {
    const sessionsPath = path.join(this.workspaceRoot, 'sessions')

    try {
      const sessions = await fs.readdir(sessionsPath)
      return sessions.filter(dir => dir.startsWith('session_'))
    } catch (error) {
      console.error('[Workspace] Failed to list sessions:', error)
      return []
    }
  }

  /**
   * 세션 정보 (메타데이터) 저장
   */
  async saveSessionMetadata(sessionId: string, metadata: any): Promise<void> {
    const metadataPath = path.join(this.workspaceRoot, 'sessions', sessionId, 'session.json')
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8')
    console.log(`[Workspace] Session metadata saved: ${sessionId}`)
  }

  /**
   * 세션 정보 (메타데이터) 읽기
   */
  async loadSessionMetadata(sessionId: string): Promise<any> {
    const metadataPath = path.join(this.workspaceRoot, 'sessions', sessionId, 'session.json')

    try {
      const content = await fs.readFile(metadataPath, 'utf-8')
      return JSON.parse(content)
    } catch (error) {
      console.error(`[Workspace] Failed to load metadata for session ${sessionId}:`, error)
      return null
    }
  }

  /**
   * 세션 경로 반환
   */
  getSessionPath(sessionId: string): string {
    return path.join(this.workspaceRoot, 'sessions', sessionId)
  }

  /**
   * Workspace root 경로 반환
   */
  getWorkspaceRoot(): string {
    return this.workspaceRoot
  }
}

// Singleton instance
let workspaceInstance: WorkspaceManager | null = null

export function getWorkspaceManager(): WorkspaceManager {
  if (!workspaceInstance) {
    workspaceInstance = new WorkspaceManager()
  }
  return workspaceInstance
}