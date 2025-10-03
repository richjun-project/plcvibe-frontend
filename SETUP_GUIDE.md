# PLCVibe Setup Guide

## ✅ 완료된 작업

### 1. Supabase 마이그레이션
- ✅ 로컬 파일 시스템 → Supabase 클라우드 저장소로 전환
- ✅ WorkspaceManager → SupabaseWorkspace로 교체
- ✅ API 라우트 업데이트 완료

### 2. PLC 파일 Import 지원
- ✅ Rockwell (.L5X) importer 구현
- ✅ Siemens (.S7P, .ZAP13) importer 구현
- ✅ Universal importer (자동 감지)
- ✅ PLCFileUploader UI 컴포넌트
- ✅ ChatInterface에 통합 완료

---

## 🚀 Supabase 설정

### 1단계: Supabase 프로젝트 생성

1. https://supabase.com 방문
2. 새 프로젝트 생성
3. Database Password 설정 및 저장
4. 프로젝트 URL과 API Key 복사

### 2단계: 환경 변수 설정

`.env.local` 파일에 다음 추가:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

### 3단계: 데이터베이스 마이그레이션

Supabase Dashboard → SQL Editor에서 다음 파일 실행:

**파일:** `supabase/migrations/001_sessions_and_programs.sql`

```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Sessions table
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Ladder programs table
CREATE TABLE ladder_programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  grid_data JSONB,
  source_file TEXT,
  file_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Validation results table
CREATE TABLE validation_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id UUID REFERENCES ladder_programs(id) ON DELETE CASCADE,
  validation_data JSONB NOT NULL,
  passed BOOLEAN,
  error_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_programs_session_id ON ladder_programs(session_id);
CREATE INDEX idx_validations_program_id ON validation_results(program_id);

-- RLS Policies
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ladder_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY sessions_user_policy ON sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY programs_session_policy ON ladder_programs
  FOR ALL USING (
    session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
  );

CREATE POLICY validations_program_policy ON validation_results
  FOR ALL USING (
    program_id IN (
      SELECT id FROM ladder_programs
      WHERE session_id IN (SELECT id FROM sessions WHERE user_id = auth.uid())
    )
  );

-- Auto-update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER programs_updated_at
  BEFORE UPDATE ON ladder_programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

### 4단계: Storage Bucket 생성

Supabase Dashboard → Storage → New Bucket

**설정:**
- Bucket name: `plc-files`
- Public: **No** (Private)
- File size limit: `50MB`
- Allowed MIME types: `application/zip, application/xml, text/plain, application/octet-stream`

**RLS Policy 추가:**

```sql
-- Storage policies for plc-files bucket
CREATE POLICY "Users can upload their own files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'plc-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'plc-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own files"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'plc-files' AND
  (storage.foldername(name))[1] = auth.uid()::text
);
```

---

## 📦 패키지 설치

필요한 라이브러리가 이미 설치되어 있습니다:

```bash
npm install jszip fast-xml-parser --legacy-peer-deps
```

---

## 🎯 사용 방법

### 1. PLC 파일 Import

1. **ChatInterface 열기** (`/chat` 페이지)

2. **"Import PLC File" 클릭**
   - 상단에 파일 업로드 패널이 확장됩니다

3. **파일 업로드**
   - 드래그 앤 드롭: PLC 파일을 패널에 드래그
   - 클릭 선택: 패널 클릭 후 파일 선택

4. **지원 형식:**
   - `.L5X` - Rockwell Allen-Bradley Studio 5000 / RSLogix 5000
   - `.ACD` - Rockwell Archive File
   - `.S7P` - Siemens TIA Portal Project
   - `.ZAP13` - Siemens STEP 7 V13 Archive

5. **Import 결과:**
   - 성공 시: 래더 다이어그램이 자동으로 표시됩니다
   - 네트워크 개수, I/O 포인트 개수가 메시지로 표시됩니다
   - Supabase에 자동으로 저장됩니다

### 2. 세션 관리

**세션 자동 생성:**
- 첫 PLC 파일 import 시 세션이 자동으로 생성됩니다
- 세션 이름: `Imported from [filename]`

**API를 통한 세션 관리:**

```typescript
// 세션 목록 조회
GET /api/workspace?action=sessions

// 특정 세션 조회
GET /api/workspace?sessionId=<uuid>

// 세션의 프로그램 목록
GET /api/workspace?sessionId=<uuid>&action=programs

// 세션 삭제 (CASCADE로 모든 프로그램도 삭제)
DELETE /api/workspace?sessionId=<uuid>
```

### 3. 프로그램 관리

```typescript
// 프로그램 저장
POST /api/workspace
{
  "sessionId": "uuid",
  "filename": "program.lad",
  "code": "NETWORK 1\n...",
  "gridData": null
}

// 프로그램 조회
GET /api/workspace?programId=<uuid>

// 프로그램 삭제
DELETE /api/workspace?programId=<uuid>
```

---

## 🔧 코드에서 사용

### SupabaseWorkspace 사용 예시

```typescript
import { getSupabaseWorkspace } from '@/lib/workspace/supabase-workspace'

const workspace = getSupabaseWorkspace()

// 세션 생성
const session = await workspace.createSession('My Project')

// 프로그램 저장
const program = await workspace.saveProgram(
  session.id,
  'motor_control.lad',
  ladderCode,
  gridData
)

// 검증 결과 저장
const validation = await workspace.saveValidation(
  program.id,
  validationData,
  true,
  0
)

// 프로그램 조회
const programs = await workspace.listPrograms(session.id)
```

### PLC 파일 Import 사용 예시

```typescript
import { getUniversalImporter } from '@/lib/plc-parser/importers/universal-importer'

const importer = getUniversalImporter()

// 파일 검증
const validation = await importer.validateFile(file)
if (!validation.valid) {
  console.error(validation.message)
  return
}

// Import
const result = await importer.importFile(file)
if (result.success) {
  console.log('Imported program:', result.program)
  console.log('File type:', result.fileType)
  console.log('Networks:', result.program.networks.length)
}
```

---

## 📊 데이터 구조

### Session
```typescript
{
  id: string              // UUID
  user_id: string         // FK → auth.users
  session_name: string
  created_at: string
  updated_at: string
  metadata: object        // JSON 메타데이터
}
```

### LadderProgram
```typescript
{
  id: string              // UUID
  session_id: string      // FK → sessions
  name: string
  code: string            // 래더 코드 텍스트
  grid_data: object       // GridLadderProgram (JSONB)
  source_file: string     // 원본 파일 경로 (Storage)
  file_type: string       // .s7p, .L5X, etc
  created_at: string
  updated_at: string
}
```

### ValidationResult
```typescript
{
  id: string              // UUID
  program_id: string      // FK → ladder_programs
  validation_data: object // 검증 데이터 (JSONB)
  passed: boolean
  error_count: number
  created_at: string
}
```

---

## 🔄 워크플로우

### 전체 사용 흐름

```
1. 사용자가 TIA Portal에서 .s7p export
   ↓
2. PLCVibe에서 "Import PLC File" 클릭
   ↓
3. .s7p 파일 드래그 앤 드롭
   ↓
4. SiemensImporter가 자동으로 파싱
   ↓
5. LadderProgram 구조로 변환
   ↓
6. Supabase에 저장 (sessions + ladder_programs)
   ↓
7. LadderView에 시각화
   ↓
8. AI 분석 또는 편집 가능
   ↓
9. ST/IL 코드로 Export
   ↓
10. TIA Portal에 다시 import
```

---

## ⚠️ 제한사항

### 1. 인증 (Authentication)

현재 구현에서는 **RLS가 활성화되어 있지만 인증이 구현되지 않았습니다**.

**임시 해결책:**
- RLS 정책을 비활성화하거나
- 익명 사용자를 위한 정책 추가

```sql
-- 개발 중 임시로 RLS 비활성화
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE ladder_programs DISABLE ROW LEVEL SECURITY;
ALTER TABLE validation_results DISABLE ROW LEVEL SECURITY;
```

**프로덕션 해결책:**
- Supabase Auth 통합
- NextAuth.js 사용
- 또는 Custom JWT 인증

### 2. 지원 파일 형식

**현재 지원:**
- ✅ Rockwell .L5X (XML)
- ✅ Siemens .S7P, .ZAP13 (ZIP+XML)

**향후 추가 예정:**
- ⏳ Rockwell .ACD (바이너리 - 복잡)
- ⏳ Mitsubishi .gx2, .gx3 (바이너리 - 매우 복잡)
- ⏳ Schneider .stu, .stp (XML)
- ⏳ CODESYS .project (XML)

### 3. Import 범위

**지원:**
- ✅ 래더 로직 (Networks, Rungs)
- ✅ 기본 명령어 (접점, 코일, 타이머, 카운터)
- ✅ 비교/수학 연산

**미지원:**
- ❌ 하드웨어 I/O 설정
- ❌ 통신 설정
- ❌ 제조사별 고유 Function Block
- ❌ Structured Text/FBD 루틴

---

## 🧪 테스트

### 1. 로컬 개발 서버 실행

```bash
npm run dev
```

### 2. 테스트 파일 준비

**Rockwell L5X 샘플:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<RSLogix5000Content>
  <Controller>
    <Programs>
      <Program Name="MainProgram">
        <Routines>
          <Routine Name="MainRoutine" Type="RLL">
            <RLLContent>
              <Rung Number="0" Type="N">
                <Text>XIC(Start)OTE(Motor);</Text>
                <Comment>Motor Start Logic</Comment>
              </Rung>
            </RLLContent>
          </Routine>
        </Routines>
      </Program>
    </Programs>
  </Controller>
</RSLogix5000Content>
```

### 3. Import 테스트

1. http://localhost:3000/chat 접속
2. "Import PLC File" 클릭
3. 샘플 파일 업로드
4. 결과 확인:
   - ✅ 래더 다이어그램 표시
   - ✅ 메시지에 네트워크/I/O 개수 표시
   - ✅ Supabase에 데이터 저장 확인

### 4. Supabase 데이터 확인

Supabase Dashboard → Table Editor

- `sessions` 테이블에 새 세션 생성됨
- `ladder_programs` 테이블에 프로그램 저장됨
- `code` 필드에 래더 코드 텍스트 확인

---

## 🎯 다음 단계

### Immediate
1. **인증 구현**
   - Supabase Auth 통합
   - 로그인/회원가입 UI
   - RLS 활성화

2. **Grid Editor 통합**
   - GridLadderView 사용
   - 2D 그리드 편집 모드
   - AdvancedToolbox 활성화

3. **Export 연결**
   - Import된 프로그램을 ST/IL로 export
   - 다운로드 기능

### Future
1. **추가 파일 형식 지원**
   - Mitsubishi (.gx2)
   - CODESYS (.project)

2. **실시간 협업**
   - Supabase Realtime
   - 멀티유저 편집

3. **버전 관리**
   - Git 통합
   - Diff/Merge 기능

4. **AI 최적화**
   - Import된 코드 자동 분석
   - 최적화 제안

---

## 📝 변경 사항 요약

### 삭제된 파일
- ❌ `lib/workspace/manager.ts` (로컬 파일 시스템) - **대체됨**

### 새로 생성된 파일
- ✅ `lib/workspace/supabase-workspace.ts` - Supabase 클라우드 저장
- ✅ `lib/plc-parser/importers/rockwell-importer.ts` - Rockwell L5X 파서
- ✅ `lib/plc-parser/importers/siemens-importer.ts` - Siemens S7P 파서
- ✅ `lib/plc-parser/importers/universal-importer.ts` - 통합 importer
- ✅ `components/features/upload/PLCFileUploader.tsx` - 파일 업로드 UI
- ✅ `supabase/migrations/001_sessions_and_programs.sql` - DB 스키마

### 수정된 파일
- 🔄 `app/api/workspace/route.ts` - SupabaseWorkspace 사용
- 🔄 `app/api/workspace/search/route.ts` - SupabaseWorkspace 사용
- 🔄 `components/features/chat/ChatInterface.tsx` - PLCFileUploader 통합

---

## 🏆 완성!

이제 PLCVibe는:
- ✅ 클라우드 기반 저장 (Supabase)
- ✅ 실제 PLC 파일 import (.L5X, .S7P)
- ✅ 자동 파싱 및 변환
- ✅ 세션/프로그램 관리
- ✅ 서버리스 환경 완벽 지원

**실제 PLC 프로그래머들이 사용할 수 있는 도구가 되었습니다! 🚀**
