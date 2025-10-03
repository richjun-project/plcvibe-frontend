# PLC Vibe - AI-Powered PLC Coding Assistant

AI 기반 PLC 프로그래밍 어시스턴트 플랫폼 with **Auto-Debug Agent** 🤖

## ✨ 주요 기능

- 🚀 **Advanced Agent System**: Bolt/Lovable/Cursor 스타일의 완전 자율 에이전트
  - 자동 계획 수립
  - 반복적 실행 및 검증 (최대 15회)
  - 100% 완벽한 코드 생성
- 🤖 **Auto-Debug Agent**: AI가 생성한 코드를 자동으로 검증하고 수정
- 💬 AI 기반 래더 로직 생성 (Gemini 2.0 Flash)
- 🎨 실시간 래더 다이어그램 시각화
- ⚡ PLC 시뮬레이터 (10ms 스캔 사이클)
- 📁 파일 관리 시스템
- 📤 다양한 PLC 포맷 Export (Siemens, Allen-Bradley, Mitsubishi)

## 기술 스택

- **Frontend**: Next.js 15 (App Router) + TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Supabase (Auth, DB, Storage)
- **AI**: Claude 4.5 API (Anthropic)
- **State**: Zustand + TanStack Query

## 시작하기

### 환경 변수 설정

`.env.local` 파일을 생성하고 다음 변수들을 설정하세요:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Claude API (서버 전용)
CLAUDE_API_KEY=your-claude-api-key

# Supabase Service Role (서버 전용)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 개발 서버 실행

```bash
# 패키지 설치
npm install

# 개발 서버 실행
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000)을 열어보세요.

## 🤖 Auto-Debug Agent (완전 자동)

AI가 생성한 래더 코드를 **완전 자동으로 검증하고 수정**하는 자율 에이전트입니다.

### 작동 방식

1. **사용자**: "컨베이어 제어 시스템 만들어줘"
2. **AI**: 래더 코드 생성 ✍️
3. **Agent**: 백그라운드에서 자동 검증 시작 🔍
   - 파싱 테스트
   - 시뮬레이션 실행
   - 로직 패턴 검사
4. **문제 발견 시**: AI에게 자동으로 수정 요청 → 재검증
5. **최대 5회 반복**하여 완벽한 코드 생성 ✅

### 사용자 경험

**버튼 클릭 필요 없음!** 그냥 AI에게 요청만 하면 됩니다:

```
사용자: "컨베이어 제어 시스템 만들어줘"
  ↓
AI: 코드 생성 중...
  ↓
🤖 Auto-validating ladder code...
  ↓
✅ Code validated automatically
```

완전히 투명하게 작동합니다. 사용자는 **항상 검증된 코드**만 받습니다.

자세한 내용: [📖 Auto-Debug Agent 문서](./docs/AUTO_DEBUG_AGENT.md)

## 🚀 Advanced Agent System (NEW!)

Bolt, Lovable, Cursor처럼 작동하는 **완전 자율 에이전트**가 추가되었습니다!

### 🎯 차이점

**Normal Mode (기존)**:
```
사용자 요청 → AI 응답 → Auto-Debug → 완료
```

**Advanced Agent Mode (NEW)**:
```
사용자 요청
  ↓
자동 계획 수립 (5-10개 tasks)
  ↓
반복적 실행 (최대 15회)
  ├─ 코드 생성
  ├─ 검증
  ├─ 자동 수정
  └─ 재검증
  ↓
100% 완벽한 최종 코드
```

### 💡 핵심 기능

1. **자동 계획 수립**: AI가 요청을 분석하여 실행 계획 자동 생성
2. **반복적 검증 및 수정**: 문제를 발견하면 자동으로 수정하고 재검증
3. **상세한 로그**: 모든 실행 과정을 추적 가능
4. **높은 성공률**: ~95% (1-3회 반복으로 완벽한 코드)

### 🎮 사용 방법

1. 채팅 화면 상단에서 **"🤖 Advanced Agent"** 선택
2. 요청만 입력하면 Agent가 알아서 처리
3. 계획 수립 → 실행 → 검증 → 완성본 자동 생성

자세한 내용: [📖 Advanced Agent 문서](./docs/ADVANCED_AGENT.md)

## 프로젝트 구조

```
plcvibe/
├── app/                    # Next.js App Router
│   ├── api/               # API Routes (Claude, Supabase)
│   └── ...                # Pages
├── components/            # React 컴포넌트
│   ├── ui/               # UI 컴포넌트
│   ├── features/         # 기능별 컴포넌트
│   └── layouts/          # 레이아웃
├── lib/                  # 유틸리티 & 서비스
│   ├── supabase/        # Supabase 클라이언트
│   ├── claude/          # Claude API 클라이언트
│   ├── plc-parser/      # PLC 파일 파싱
│   └── utils/           # 유틸리티 함수
├── hooks/               # Custom React Hooks
├── store/               # Zustand 스토어
├── types/               # TypeScript 타입
└── supabase/            # Supabase 설정
```

## 주요 기능

### Phase 1 (MVP)
- ✅ AI 대화형 코드 생성
- ✅ PLC 코드 분석
- ✅ Ladder Logic 지원
- ✅ Siemens S7 포맷 지원

### Phase 2 (예정)
- Multiple PLC 포맷 지원
- 실시간 협업
- 고급 분석 기능

## 배포

Vercel에 배포하는 것을 권장합니다:

```bash
npm run build
```

## 문서

자세한 기술 스택 및 아키텍처는 [TECH_STACK.md](./TECH_STACK.md)를 참고하세요.

## 라이센스

MIT