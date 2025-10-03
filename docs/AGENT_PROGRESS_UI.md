# 🎨 Agent Progress UI

## 개요

사용자가 Agent의 작업 진행 상황을 **실시간으로 시각적으로** 확인할 수 있는 UI 시스템입니다.

## 주요 기능

### 1. 실시간 스트리밍

Agent API가 Server-Sent Events (SSE)로 진행 상황을 스트리밍:

```
Agent 실행
  ↓
로그 생성: "🤖 Advanced PLC Agent started"
  ↓
SSE로 전송: data: {"type": "log", "message": "..."}
  ↓
UI 업데이트 (실시간)
```

### 2. 단계별 진행 표시

```
✅ 요청 분석 및 계획 수립
⏳ 코드 생성 (진행 중)
⚪ 코드 검증
⚪ 문제 수정 중
```

각 단계는 상태에 따라 아이콘과 색상이 변경:
- ✅ 완료 (녹색)
- ⏳ 진행 중 (파란색, 애니메이션)
- ❌ 실패 (빨간색)
- ⚪ 대기 중 (회색)

### 3. 진행률 바

```
전체 진행률 ████████░░░░░░░░ 45%
```

- 부드러운 애니메이션
- 실시간 업데이트
- 펄스 효과 (진행 중일 때)

### 4. Iteration 카운터

```
┌────────────┐
│ Iteration  │
│   2 / 15   │
└────────────┘
```

- 현재 반복 횟수
- 최대 반복 횟수
- 대형 숫자로 표시

### 5. 현재 작업 로그

```
┌─────────────────────────────────────┐
│ 현재 작업:                           │
│ 🔄 Generating ladder logic code...  │
└─────────────────────────────────────┘
```

- 실시간 로그 표시
- 스피너 애니메이션
- 모노스페이스 폰트

## UI 디자인

### 색상 팔레트

```css
/* 배경 */
from-gray-900 to-gray-800     /* 그라데이션 */
border-blue-600/50             /* 테두리 (발광 효과) */

/* 상태별 색상 */
text-blue-400   /* 진행 중 */
text-green-400  /* 완료 */
text-red-400    /* 실패 */
text-gray-600   /* 대기 */

/* 강조 */
text-yellow-400 /* Agent 아이콘 */
```

### 애니메이션

1. **스피너 (Loader2)**
   - `animate-spin`
   - 부드러운 회전

2. **펄스 효과**
   - `animate-pulse`
   - 진행 중인 요소 강조

3. **Ping 효과**
   - `animate-ping`
   - Agent 시작 시 확장 애니메이션

4. **진행률 바 전환**
   - `transition-all duration-500`
   - 부드러운 width 변화

## 코드 구조

### AgentProgress 컴포넌트

```typescript
interface AgentStep {
  id: string
  title: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  description?: string
}

<AgentProgress
  steps={steps}                    // 진행 단계 배열
  currentIteration={2}             // 현재 iteration
  maxIterations={15}               // 최대 iteration
  currentLog="Generating code..."  // 현재 로그
  isComplete={false}               // 완료 여부
/>
```

### Streaming API

```typescript
// Server (app/api/agent/execute/route.ts)
const sendUpdate = (data) => {
  controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
}

sendUpdate({ type: 'log', message: 'Starting...' })
sendUpdate({ type: 'complete', result: {...} })
```

### Client (ChatInterface.tsx)

```typescript
// SSE 수신
const reader = response.body.getReader()
while (true) {
  const { done, value } = await reader.read()
  if (done) break

  // 로그 파싱 및 UI 업데이트
  if (data.type === 'log') {
    setAgentLog(data.message)
    // 단계 업데이트 로직
  }
}
```

## 로그 메시지 매핑

| 로그 메시지 | UI 업데이트 |
|------------|-----------|
| "Analyzing request" | "요청 분석 및 계획 수립" 시작 |
| "Plan created" | 계획 수립 완료, 코드 생성 시작 |
| "Generating ladder logic" | "코드 생성" 표시 |
| "Validating code" | 코드 생성 완료, 검증 시작 |
| "Code validation passed" | 검증 완료 ✅ |
| "Attempting to fix" | "문제 수정 중" 시작 |
| "=== Iteration N ===" | Iteration 카운터 업데이트 |

## 사용 예시

### 1. Agent 시작

```
┌─────────────────────────────────────────┐
│ 🤖 Advanced Agent...                    │
│ 작업 진행 중                             │
│                                          │
│ Iteration: 1 / 15                        │
│                                          │
│ 전체 진행률 ████░░░░░░░░░░ 25%         │
│                                          │
│ ⏳ 요청 분석 및 계획 수립 (진행 중)      │
│                                          │
│ 현재 작업:                               │
│ 🔄 Analyzing request...                 │
└─────────────────────────────────────────┘
```

### 2. 코드 생성 중

```
┌─────────────────────────────────────────┐
│ 🤖 Advanced Agent...                    │
│ 작업 진행 중                             │
│                                          │
│ Iteration: 1 / 15                        │
│                                          │
│ 전체 진행률 ████████░░░░░░ 50%         │
│                                          │
│ ✅ 요청 분석 및 계획 수립                │
│ ⏳ 코드 생성 (진행 중)                   │
│ ⚪ 코드 검증                             │
│                                          │
│ 현재 작업:                               │
│ 🔄 Generating ladder logic code...     │
└─────────────────────────────────────────┘
```

### 3. 완료

```
┌─────────────────────────────────────────┐
│ ✅ Advanced Agent                        │
│ 완료되었습니다                           │
│                                          │
│ Iteration: 2 / 15                        │
│                                          │
│ 전체 진행률 ████████████████ 100%       │
│                                          │
│ ✅ 요청 분석 및 계획 수립                │
│ ✅ 코드 생성                             │
│ ✅ 코드 검증                             │
│                                          │
│ ┌─────────────────────────────────────┐ │
│ │ ✅ 작업이 성공적으로 완료되었습니다!  │ │
│ │ 3/3 단계 완료 · 2회 반복             │ │
│ └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## 성능 최적화

1. **React State 최적화**
   - `useState`로 개별 state 관리
   - 불필요한 re-render 방지

2. **애니메이션 최적화**
   - CSS 애니메이션 사용 (GPU 가속)
   - `will-change` 속성

3. **메모리 관리**
   - Streaming reader cleanup
   - useEffect cleanup functions

## 향후 개선 사항

- [ ] 로그 히스토리 확장/축소
- [ ] 각 단계별 소요 시간 표시
- [ ] 에러 발생 시 상세 정보
- [ ] Dark/Light 테마 지원
- [ ] 모바일 최적화
- [ ] 사운드 피드백 (완료 시)
- [ ] 진행 상황 저장 및 복원

## 관련 파일

- `components/features/chat/AgentProgress.tsx` - 진행 상황 UI 컴포넌트
- `components/features/chat/ChatInterface.tsx` - SSE 수신 및 상태 관리
- `app/api/agent/execute/route.ts` - SSE 스트리밍 API