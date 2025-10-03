/**
 * Agent File Tools
 *
 * 에이전트가 파일 시스템과 상호작용할 수 있는 도구들
 * Bolt/Cursor처럼 파일을 저장, 읽기, 검색하는 기능
 */

export interface FileSearchResult {
  file: string
  matches: Array<{
    line: number
    content: string
  }>
}

export interface FileDiff {
  filename1: string
  filename2: string
  additions: number
  deletions: number
  changes: Array<{
    type: 'add' | 'delete' | 'modify'
    lineNumber: number
    content: string
  }>
}

export class AgentFileTools {
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  /**
   * 파일 저장
   */
  async saveFile(filename: string, content: string): Promise<{ success: boolean; filePath?: string; error?: string }> {
    try {
      const response = await fetch('/api/workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: this.sessionId,
          filename,
          content
        })
      })

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error }
      }

      console.log(`[AgentFileTools] File saved: ${filename}`)
      return { success: true, filePath: data.filePath }

    } catch (error) {
      console.error('[AgentFileTools] Save error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to save file'
      }
    }
  }

  /**
   * 파일 읽기
   */
  async readFile(filename: string): Promise<{ success: boolean; content?: string; error?: string }> {
    try {
      const response = await fetch(
        `/api/workspace?sessionId=${this.sessionId}&filename=${encodeURIComponent(filename)}`
      )

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error }
      }

      console.log(`[AgentFileTools] File read: ${filename}`)
      return { success: true, content: data.content }

    } catch (error) {
      console.error('[AgentFileTools] Read error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to read file'
      }
    }
  }

  /**
   * 세션의 모든 파일 목록
   */
  async listFiles(): Promise<{ success: boolean; files?: string[]; error?: string }> {
    try {
      const response = await fetch(`/api/workspace?sessionId=${this.sessionId}&action=list`)

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error }
      }

      return { success: true, files: data.files }

    } catch (error) {
      console.error('[AgentFileTools] List error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list files'
      }
    }
  }

  /**
   * 파일 내용 검색
   */
  async searchInFiles(query: string): Promise<{ success: boolean; results?: FileSearchResult[]; error?: string }> {
    try {
      const response = await fetch(
        `/api/workspace/search?sessionId=${this.sessionId}&query=${encodeURIComponent(query)}`
      )

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error }
      }

      console.log(`[AgentFileTools] Search completed: "${query}" - ${data.totalMatches} matches`)
      return { success: true, results: data.results }

    } catch (error) {
      console.error('[AgentFileTools] Search error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed'
      }
    }
  }

  /**
   * 두 파일 비교 (간단한 diff)
   */
  async compareFiles(filename1: string, filename2: string): Promise<{ success: boolean; diff?: FileDiff; error?: string }> {
    try {
      const [result1, result2] = await Promise.all([
        this.readFile(filename1),
        this.readFile(filename2)
      ])

      if (!result1.success || !result2.success) {
        return {
          success: false,
          error: result1.error || result2.error
        }
      }

      const lines1 = (result1.content || '').split('\n')
      const lines2 = (result2.content || '').split('\n')

      const changes: FileDiff['changes'] = []
      let additions = 0
      let deletions = 0

      // Simple line-by-line comparison
      const maxLines = Math.max(lines1.length, lines2.length)

      for (let i = 0; i < maxLines; i++) {
        const line1 = lines1[i]
        const line2 = lines2[i]

        if (line1 !== line2) {
          if (line1 === undefined) {
            // Line added in file2
            changes.push({
              type: 'add',
              lineNumber: i + 1,
              content: line2
            })
            additions++
          } else if (line2 === undefined) {
            // Line deleted from file1
            changes.push({
              type: 'delete',
              lineNumber: i + 1,
              content: line1
            })
            deletions++
          } else {
            // Line modified
            changes.push({
              type: 'modify',
              lineNumber: i + 1,
              content: `- ${line1}\n+ ${line2}`
            })
            additions++
            deletions++
          }
        }
      }

      const diff: FileDiff = {
        filename1,
        filename2,
        additions,
        deletions,
        changes
      }

      console.log(`[AgentFileTools] Diff completed: +${additions} -${deletions}`)
      return { success: true, diff }

    } catch (error) {
      console.error('[AgentFileTools] Compare error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to compare files'
      }
    }
  }

  /**
   * Diff를 파일로 저장
   */
  async saveDiff(filename1: string, filename2: string): Promise<{ success: boolean; error?: string }> {
    const compareResult = await this.compareFiles(filename1, filename2)

    if (!compareResult.success || !compareResult.diff) {
      return { success: false, error: compareResult.error }
    }

    const diff = compareResult.diff
    const diffContent = this.formatDiff(diff)
    const diffFilename = `diff_${filename1.replace(/\.[^.]+$/, '')}_vs_${filename2.replace(/\.[^.]+$/, '')}.diff`

    return await this.saveFile(diffFilename, diffContent)
  }

  /**
   * Diff를 텍스트로 포맷
   */
  private formatDiff(diff: FileDiff): string {
    let output = `--- ${diff.filename1}\n`
    output += `+++ ${diff.filename2}\n`
    output += `@@ -${diff.deletions} +${diff.additions} @@\n\n`

    diff.changes.forEach(change => {
      const prefix = change.type === 'add' ? '+' : change.type === 'delete' ? '-' : '~'
      output += `${prefix} Line ${change.lineNumber}: ${change.content}\n`
    })

    return output
  }

  /**
   * 파일 삭제
   */
  async deleteFile(filename: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(
        `/api/workspace?sessionId=${this.sessionId}&filename=${encodeURIComponent(filename)}`,
        { method: 'DELETE' }
      )

      const data = await response.json()

      if (!response.ok) {
        return { success: false, error: data.error }
      }

      console.log(`[AgentFileTools] File deleted: ${filename}`)
      return { success: true }

    } catch (error) {
      console.error('[AgentFileTools] Delete error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete file'
      }
    }
  }

  /**
   * 세션 ID 반환
   */
  getSessionId(): string {
    return this.sessionId
  }
}