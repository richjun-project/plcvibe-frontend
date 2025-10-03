# 📁 Agent Workspace System

## 개요

Advanced PLC Agent는 이제 **Bolt/Cursor/Lovable처럼 작동**합니다:
- 생성한 코드를 **실제 파일로 저장**
- 각 iteration마다 **버전 관리**
- 이전 파일을 **읽고 검색**
- **변경사항 추적** (diff)
- **완전한 컨텍스트 유지**

## 🚀 작동 방식

### Before (이전)
```
사용자 요청 → Agent가 메모리에서 코드 생성 → 검증 → 끝
❌ 파일 없음
❌ 버전 추적 불가
❌ 이전 시도 참조 불가
```

### After (현재)
```
사용자 요청
  → Agent가 세션 생성 (session_20250101_120000/)
  → Iteration 1:
    - 코드 생성
    - 📄 iteration_1.ladder 저장
    - 검증
    - 📄 validation_1.json 저장
  → Iteration 2:
    - 🔍 이전 파일 읽기 (iteration_1.ladder)
    - 🔎 파일 검색 ("I/O Mapping" 확인)
    - 코드 재생성
    - 📄 iteration_2.ladder 저장
    - 📊 Diff 생성 (변경사항 추적)
  → 최종:
    - 📄 final.ladder 저장
    - 📄 session.json (메타데이터) 저장
✅ 모든 과정 추적 가능
✅ 디버깅 용이
✅ 컨텍스트 유지
```

---

## 📂 디렉토리 구조

```
plcvibe/
└── workspace/
    └── sessions/
        ├── session_2025-01-01T12-00-00_abc123/
        │   ├── plan.json              # 실행 계획
        │   ├── iteration_1.ladder     # 1번째 생성 코드
        │   ├── validation_1.json      # 1번째 검증 결과
        │   ├── iteration_2.ladder     # 2번째 생성 코드
        │   ├── validation_2.json      # 2번째 검증 결과
        │   ├── iteration_3.ladder     # 3번째 생성 코드
        │   ├── validation_3.json      # 3번째 검증 결과
        │   ├── final.ladder           # 최종 완성 코드
        │   └── session.json           # 세션 메타데이터
        │
        └── session_2025-01-01T13-30-00_def456/
            ├── ...
```

---

## 🔧 주요 기능

### 1. Session Management (세션 관리)

**세션 자동 생성:**
```typescript
// Agent 실행 시 자동으로 세션 생성
sessionId: "session_2025-01-01T12-00-00_abc123"
```

**세션 폴더:**
```
workspace/sessions/session_2025-01-01T12-00-00_abc123/
```

### 2. File Operations (파일 작업)

**파일 저장:**
```typescript
// 각 iteration마다 자동 저장
await workspace.saveFile(sessionId, 'iteration_1.ladder', code)
→ 📄 workspace/sessions/session_xxx/iteration_1.ladder
```

**파일 읽기:**
```typescript
// 이전 iteration 파일 읽기
const previousCode = await workspace.readFile(sessionId, 'iteration_1.ladder')
→ 이전 코드 참조 가능
```

**파일 검색:**
```typescript
// 파일 내용 검색
const results = await workspace.searchInFiles(sessionId, 'I/O Mapping')
→ "I/O Mapping"이 포함된 파일 찾기
```

### 3. Version Tracking (버전 추적)

**각 iteration 저장:**
- `iteration_1.ladder` → 첫 번째 시도
- `iteration_2.ladder` → 두 번째 시도
- `iteration_3.ladder` → 세 번째 시도
- ...
- `final.ladder` → 최종 완성본

**Diff 생성:**
```typescript
// 변경사항 자동 추적
Lines changed: +15 (prev: 120, current: 135)
→ 15줄 추가됨
```

### 4. Context Preservation (컨텍스트 유지)

**이전 시도 참조:**
```
Iteration 2:
  1. 이전 파일 읽기 → iteration_1.ladder
  2. 검색 → "I/O Mapping" 확인
  3. 개선된 코드 생성 (이전 내용 참조)
```

### 5. Metadata (메타데이터)

**session.json:**
```json
{
  "sessionId": "session_2025-01-01T12-00-00_abc123",
  "userRequest": "모터 제어 회로 만들어줘",
  "createdAt": "2025-01-01T12:00:00.000Z",
  "status": "completed",
  "iterations": 3,
  "finalCode": "...",
  "logs": [...]
}
```

---

## 📊 로그 메시지

### 파일 작업 로그

```
📁 [SESSION_CREATE] Session created: session_2025-01-01T12-00-00_abc123
💾 [FILE_SAVE] Plan saved: plan.json
💾 [FILE_SAVE] Saved iteration 1: iteration_1.ladder
🔍 [FILE_READ] Read previous iteration: iteration_1.ladder
🔎 [FILE_SEARCH] Found 3 file(s) with I/O Mapping
📊 [FILE_DIFF] Lines changed: +15 (prev: 120, current: 135)
💾 [FILE_SAVE] Validation result saved: validation_1.json
💾 [FILE_SAVE] Final code saved: final.ladder
💾 [FILE_SAVE] Session metadata saved
```

---

## 🎯 사용 예시

### Example 1: 성공적인 실행

```
사용자: "3개의 컨베이어 벨트를 순차적으로 제어하는 회로 만들어줘"

Agent:
  📁 [SESSION_CREATE] session_2025-01-01T12-00-00_abc123
  📋 [PLAN_COMPLETE] 4개의 작업 단계로 실행 계획 수립 완료

  Iteration 1:
    💻 [CODE_GEN_START] Generating ladder logic code...
    ✅ [CODE_GEN_COMPLETE] Generated 8 networks, I/O Mapping: Yes
    💾 [FILE_SAVE] Saved iteration 1: iteration_1.ladder
    🔍 [VALIDATION_START] Validating code...
    ❌ [VALIDATION_COMPLETE] Failed - Errors: 2, Warnings: 0
    💾 [FILE_SAVE] Validation result saved: validation_1.json

  Iteration 2:
    🔍 [FILE_READ] Read previous iteration: iteration_1.ladder
    🔎 [FILE_SEARCH] Found 1 file(s) with I/O Mapping
    💻 [CODE_GEN_START] Generating ladder logic code...
    ✅ [CODE_GEN_COMPLETE] Generated 9 networks, I/O Mapping: Yes
    💾 [FILE_SAVE] Saved iteration 2: iteration_2.ladder
    📊 [FILE_DIFF] Lines changed: +12 (prev: 95, current: 107)
    🔍 [VALIDATION_START] Validating code...
    ✅ [VALIDATION_COMPLETE] Success! Networks: 9, I/O: 15
    💾 [FILE_SAVE] Final code saved: final.ladder

  💾 [FILE_SAVE] Session metadata saved

결과:
  ✅ 성공 (2회 반복)
  📁 Workspace: session_2025-01-01T12-00-00_abc123
  📄 Generated Files (7):
    - plan.json
    - iteration_1.ladder
    - validation_1.json
    - iteration_2.ladder
    - validation_2.json
    - final.ladder
    - session.json
```

---

## 🔍 파일 내용 확인

### Iteration 파일 비교

**iteration_1.ladder** (첫 시도):
```ladder
Network 1: Start Button
|--[ I0.0 ]--( Q0.0 )--|

Network 2: Conveyor 1
|--[ Q0.0 ]--( Q0.1 )--|
```

**iteration_2.ladder** (수정 후):
```ladder
Network 1: Start Button with E-Stop
|--[ I0.0 ]--[/I0.1 ]--( M0.0 )--|

Network 2: Seal-in
|--[ M0.0 ]--[/I0.1 ]--( M0.0 )--|

Network 3: Conveyor 1
|--[ M0.0 ]--[TON T1, 5000ms]--( Q0.1 )--|

I/O Mapping:
I0.0 - Start Button
I0.1 - E-Stop
Q0.1 - Conveyor 1
M0.0 - Run Memory
```

**변경사항:**
- ✅ E-Stop 추가
- ✅ Seal-in 회로 추가
- ✅ Timer 추가
- ✅ I/O Mapping 추가

---

## 📡 API Endpoints

### 파일 저장
```typescript
POST /api/workspace
{
  sessionId: "session_xxx",
  filename: "iteration_1.ladder",
  content: "..." // 파일 내용
}
```

### 파일 읽기
```typescript
GET /api/workspace?sessionId=session_xxx&filename=iteration_1.ladder
→ { content: "...", success: true }
```

### 파일 목록
```typescript
GET /api/workspace?sessionId=session_xxx&action=list
→ { files: ["plan.json", "iteration_1.ladder", ...] }
```

### 파일 검색
```typescript
GET /api/workspace/search?sessionId=session_xxx&query=I/O Mapping
→ {
  results: [
    {
      file: "iteration_1.ladder",
      matches: [
        { line: 25, content: "I/O Mapping:" }
      ]
    }
  ]
}
```

### 세션 목록
```typescript
GET /api/workspace?action=sessions
→ { sessions: ["session_2025-01-01T12-00-00_abc123", ...] }
```

---

## 🛠 개발자 가이드

### Workspace Manager 사용

```typescript
import { getWorkspaceManager } from '@/lib/workspace/manager'

const workspace = getWorkspaceManager()

// 초기화
await workspace.initialize()

// 세션 생성
await workspace.createSessionDir(sessionId)

// 파일 저장
await workspace.saveFile(sessionId, 'test.ladder', code)

// 파일 읽기
const content = await workspace.readFile(sessionId, 'test.ladder')

// 파일 검색
const results = await workspace.searchInFiles(sessionId, 'Network')

// 파일 목록
const files = await workspace.listFiles(sessionId)

// 세션 메타데이터
await workspace.saveSessionMetadata(sessionId, metadata)
const metadata = await workspace.loadSessionMetadata(sessionId)
```

### Session Manager 사용

```typescript
import { SessionManager } from '@/lib/ai/agent/session-manager'

// 세션 생성
const sessionId = SessionManager.createSession(userRequest)

// 메타데이터 저장
await SessionManager.saveMetadata(sessionId, {
  sessionId,
  userRequest,
  createdAt: new Date().toISOString(),
  status: 'completed',
  iterations: 3,
  finalCode: '...',
  logs: [...]
})

// 메타데이터 읽기
const metadata = await SessionManager.loadMetadata(sessionId)

// 세션 목록
const sessions = await SessionManager.listSessions()
```

---

## 🎨 UI 개선

### Agent Result에 Workspace 정보 표시

```markdown
## 🤖 Advanced Agent Result

**Goal:** 3개의 컨베이어 벨트를 순차적으로 제어하는 회로 생성

**Steps Completed:** 4/4

**Iterations:** 2

### 📁 Workspace:
**Session ID:** `session_2025-01-01T12-00-00_abc123`

**Generated Files** (7):
- 📄 plan.json
- 📄 iteration_1.ladder
- 📄 validation_1.json
- 📄 iteration_2.ladder
- 📄 validation_2.json
- 📄 final.ladder
- 📄 session.json

### Generated Code:
```ladder
...
```
```

---

## 🔒 보안 및 관리

### .gitignore
```
# Agent Workspace (local development only)
/workspace/
!workspace/.gitkeep
```

**이유:**
- Workspace는 개발 중 임시 파일
- Git에 커밋하지 않음
- 로컬 실험용

### 파일 정리

**수동 정리:**
```bash
rm -rf workspace/sessions/session_2025-01-01*
```

**API로 정리:**
```typescript
// 특정 세션 삭제
await SessionManager.deleteSession(sessionId)
```

---

## 📈 향후 개선 계획

### Phase 2 (다음 단계)
- [ ] **Diff Viewer UI** - 변경사항 시각화
- [ ] **File History Panel** - 버전 타임라인
- [ ] **File Browser** - 세션 목록 및 파일 탐색
- [ ] **Download Files** - 생성된 파일 다운로드

### Phase 3 (고급 기능)
- [ ] **Smart Search** - AI 기반 semantic 검색
- [ ] **Context Builder** - 관련 파일 자동 검색
- [ ] **Diff-based Fixing** - 부분 수정 (전체 재생성 대신)
- [ ] **Pattern Library** - 학습된 패턴 재사용

---

## 📚 관련 파일

### Core
- `lib/workspace/manager.ts` - Workspace 관리
- `lib/ai/agent/session-manager.ts` - Session 관리
- `lib/ai/agent/file-tools.ts` - Agent 파일 도구
- `lib/ai/agent/advanced-agent.ts` - Agent (파일 작업 통합)

### API
- `app/api/workspace/route.ts` - 파일 CRUD API
- `app/api/workspace/search/route.ts` - 파일 검색 API

### UI
- `components/features/chat/ChatInterface.tsx` - Agent UI (파일 목록 표시)

### Docs
- `docs/AGENT_WORKSPACE.md` - 이 문서
- `docs/AGENT_PROGRESS_UI.md` - Progress UI 문서
- `docs/ADVANCED_AGENT.md` - Agent 시스템 문서

---

## ✨ 결론

이제 PLC Vibe의 Advanced Agent는 **진정한 AI 코딩 어시스턴트**처럼 작동합니다:

✅ **파일 시스템과 상호작용**
✅ **버전 관리 및 추적**
✅ **컨텍스트 유지**
✅ **완전한 디버깅 가능**
✅ **프로덕션 레벨 품질**

Bolt/Cursor/Lovable과 동일한 수준의 기능을 제공합니다! 🚀