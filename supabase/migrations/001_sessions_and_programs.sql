-- PLCVibe Database Schema
-- 세션 및 래더 프로그램 관리

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 세션 테이블
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb,
  created_by_agent BOOLEAN DEFAULT FALSE  -- 에이전트가 생성한 세션 표시
);

-- 래더 프로그램 테이블
CREATE TABLE IF NOT EXISTS ladder_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  grid_data JSONB,  -- GridLadderProgram 저장
  file_type TEXT,    -- 파일 타입: ladder, json, xml 등
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 검증 결과 테이블
CREATE TABLE IF NOT EXISTS validation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES ladder_programs(id) ON DELETE CASCADE,
  validation_data JSONB NOT NULL,
  passed BOOLEAN,
  error_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ladder_programs_session_id ON ladder_programs(session_id);
CREATE INDEX IF NOT EXISTS idx_ladder_programs_created_at ON ladder_programs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_validation_results_program_id ON validation_results(program_id);

-- RLS (Row Level Security) 활성화
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ladder_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;

-- RLS 정책: 사용자는 자신의 세션만 접근 가능 (에이전트 세션은 모두 접근 가능)
CREATE POLICY sessions_user_policy ON sessions
  FOR ALL
  USING (
    auth.uid() = user_id OR
    created_by_agent = TRUE OR
    user_id IS NULL
  )
  WITH CHECK (
    auth.uid() = user_id OR
    created_by_agent = TRUE OR
    user_id IS NULL
  );

-- RLS 정책: 프로그램은 세션 소유자만 접근 가능 (에이전트 세션 포함)
CREATE POLICY ladder_programs_user_policy ON ladder_programs
  FOR ALL
  USING (
    session_id IN (
      SELECT id FROM sessions
      WHERE user_id = auth.uid()
         OR created_by_agent = TRUE
         OR user_id IS NULL
    )
  )
  WITH CHECK (
    session_id IN (
      SELECT id FROM sessions
      WHERE user_id = auth.uid()
         OR created_by_agent = TRUE
         OR user_id IS NULL
    )
  );

-- RLS 정책: 검증 결과는 프로그램 소유자만 접근 가능 (에이전트 세션 포함)
CREATE POLICY validation_results_user_policy ON validation_results
  FOR ALL
  USING (
    program_id IN (
      SELECT lp.id FROM ladder_programs lp
      JOIN sessions s ON lp.session_id = s.id
      WHERE s.user_id = auth.uid()
         OR s.created_by_agent = TRUE
         OR s.user_id IS NULL
    )
  )
  WITH CHECK (
    program_id IN (
      SELECT lp.id FROM ladder_programs lp
      JOIN sessions s ON lp.session_id = s.id
      WHERE s.user_id = auth.uid()
         OR s.created_by_agent = TRUE
         OR s.user_id IS NULL
    )
  );

-- 자동 updated_at 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ladder_programs_updated_at
  BEFORE UPDATE ON ladder_programs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
