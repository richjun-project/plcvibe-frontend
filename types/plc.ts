// PLC Types and Interfaces

export type PLCType = 'siemens' | 'allen-bradley' | 'mitsubishi' | 'schneider' | 'generic'

export type PLCLanguage = 'ladder' | 'st' | 'fbd' | 'sfc' | 'il'

export interface PLCProject {
  id: string
  user_id: string
  name: string
  description?: string
  plc_type: PLCType
  language: PLCLanguage
  created_at: string
  updated_at: string
}

export interface CodeFile {
  id: string
  project_id: string
  name: string
  content: string
  language: PLCLanguage
  file_type: string
  created_at: string
  updated_at: string
}

export interface IOMapping {
  id: string
  project_id: string
  address: string
  name: string
  type: 'digital_input' | 'digital_output' | 'analog_input' | 'analog_output'
  description?: string
  device?: string
  created_at: string
}

export interface AnalysisResult {
  id: string
  project_id: string
  code_file_id?: string
  analysis_type: 'structure' | 'performance' | 'safety' | 'optimization' | 'full'
  result: {
    overview?: string
    issues?: Array<{
      severity: 'critical' | 'warning' | 'info'
      message: string
      line?: number
      suggestion?: string
    }>
    optimizations?: Array<{
      title: string
      description: string
      impact: 'high' | 'medium' | 'low'
    }>
    metrics?: {
      scan_time?: number
      memory_usage?: number
      io_usage?: number
      complexity?: number
    }
  }
  created_at: string
}

export interface AIConversation {
  id: string
  project_id?: string
  user_id: string
  title?: string
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: string
  }>
  created_at: string
  updated_at: string
}

export interface Template {
  id: string
  name: string
  description: string
  plc_type: PLCType
  language: PLCLanguage
  category: 'motor' | 'conveyor' | 'temperature' | 'safety' | 'sequence' | 'custom'
  code: string
  io_mappings?: IOMapping[]
  is_public: boolean
  created_by?: string
  created_at: string
}