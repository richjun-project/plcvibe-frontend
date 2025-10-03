# PLC Vibe - 기술 스택 명세 (MVP)

## 개요
Supabase + Claude 4.5 API 기반 서버리스 아키텍처로 빠른 프로토타입 개발

---

## 1. 프론트엔드

### 코어
- **Framework**: Next.js 15 (App Router) + TypeScript
- **Rendering**: SSR + CSR 하이브리드
- **Routing**: Next.js App Router (파일 기반)
- **State Management**:
  - Zustand (글로벌 상태)
  - TanStack Query (서버 상태)
- **API Routes**: Next.js API Routes (Claude API 프록시용)

### UI/UX
- **스타일링**: Tailwind CSS v3
- **컴포넌트**:
  - Radix UI (헤드리스 컴포넌트)
  - shadcn/ui (조합형 컴포넌트)
- **아이콘**: Lucide React
- **애니메이션**: Framer Motion
- **코드 에디터**: Monaco Editor
- **다이어그램**:
  - Konva.js (Ladder 시각화)
  - ReactFlow (블록 관계도)

### 유틸리티
- **Form**: React Hook Form + Zod
- **Date**: date-fns
- **Toast**: Sonner
- **File Upload**: react-dropzone

---

## 2. 백엔드 (Supabase)

### 인증
```typescript
// Supabase Auth
- Email/Password
- OAuth (Google, GitHub)
- Magic Link
- Row Level Security (RLS) 자동 적용
```

### 데이터베이스 (PostgreSQL)
```sql
-- 주요 테이블
tables:
  - users (프로필, 플랜)
  - projects (PLC 프로젝트)
  - code_files (코드 파일)
  - ai_conversations (채팅 히스토리)
  - analysis_results (분석 결과 캐시)
  - templates (코드 템플릿)
  - io_mappings (I/O 설정)
```

### 스토리지
```typescript
buckets:
  - plc-files (업로드된 .s7p, .acd 등)
  - exports (생성된 파일)
  - avatars (사용자 프로필)
```

### Realtime (선택적)
```typescript
// Phase 2에서 협업 기능 추가 시
- postgres_changes (프로젝트 변경사항 실시간 동기화)
- presence (동시 편집 사용자 표시)
```

### Edge Functions (선택적)
```typescript
// 필요시 Deno로 경량 함수 구현
functions:
  - parse-plc-file (파일 파싱 전처리)
  - format-converter (포맷 변환 헬퍼)
```

---

## 3. AI 레이어 (Claude 4.5 API)

### API 통합
```typescript
// Anthropic SDK
@anthropic-ai/sdk: ^0.20.0

// 클라이언트 래퍼
class ClaudeService {
  - generateCode()
  - analyzeCode()
  - suggestImprovements()
  - convertFormat()
  - chatConversation()
}
```

### 프롬프트 관리
```typescript
// 구조화된 프롬프트 시스템
prompts/
  ├── system/ (시스템 프롬프트)
  │   ├── code-generator.ts
  │   ├── code-analyzer.ts
  │   └── code-reviewer.ts
  ├── templates/ (Few-shot 예제)
  │   ├── ladder-examples.ts
  │   ├── st-examples.ts
  │   └── conversion-examples.ts
  └── utils/
      └── prompt-builder.ts
```

### 스트리밍 응답
```typescript
// 실시간 AI 응답 표시
const stream = await claude.messages.create({
  model: "claude-3-5-sonnet-20241022",
  stream: true,
  messages: [...]
});

for await (const chunk of stream) {
  // UI 실시간 업데이트
}
```

### RAG 간소화 (MVP)
```typescript
// Vector DB 대신 간단한 예제 매칭
- Supabase에 코드 패턴 저장
- PostgreSQL의 pg_trgm으로 유사도 검색
- Phase 2에서 Supabase Vector (pgvector) 도입
```

---

## 4. 아키텍처 다이어그램

```
┌─────────────────────────────────────────────────┐
│         Next.js 15 (App Router)                 │
│  ┌──────────────────────────────────────────┐  │
│  │  Client Components (RSC)                  │  │
│  │  ┌─────────────┐    ┌────────────────┐   │  │
│  │  │  UI Layer   │    │  Monaco Editor │   │  │
│  │  │ (Tailwind)  │    │  (Code View)   │   │  │
│  │  └──────┬──────┘    └────────┬───────┘   │  │
│  │         │                    │            │  │
│  │  ┌──────▼────────────────────▼─────────┐ │  │
│  │  │     State Management                │ │  │
│  │  │  Zustand + TanStack Query           │ │  │
│  │  └──────┬────────────────────┬─────────┘ │  │
│  └─────────┼────────────────────┼───────────┘  │
│            │                    │               │
│  ┌─────────▼────────────────────▼───────────┐  │
│  │      API Routes (서버 컴포넌트)          │  │
│  │  /api/claude/*    /api/supabase/*       │  │
│  └─────────┬────────────────────┬───────────┘  │
└────────────┼────────────────────┼───────────────┘
             │                    │
       ┌─────▼──────┐      ┌─────▼──────┐
       │  Supabase  │      │   Claude   │
       │   Client   │      │  API SDK   │
       └─────┬──────┘      └─────┬──────┘
             │                    │
       ┌─────▼──────────────┬─────▼──────┐
       │                    │             │
  ┌────▼────────┐   ┌──────▼─────┐  ┌───▼──────┐
  │ PostgreSQL  │   │  Storage   │  │  Claude  │
  │  (RLS 적용) │   │  (Buckets) │  │ 4.5 API  │
  └─────────────┘   └────────────┘  └──────────┘
```

---

## 5. 폴더 구조 (Next.js App Router)

```
plcvibe/
├── app/                        # Next.js App Router
│   ├── layout.tsx              # 루트 레이아웃
│   ├── page.tsx                # 홈페이지
│   ├── globals.css             # 글로벌 스타일
│   │
│   ├── (auth)/                 # 인증 라우트 그룹
│   │   ├── login/
│   │   │   └── page.tsx
│   │   └── signup/
│   │       └── page.tsx
│   │
│   ├── (dashboard)/            # 대시보드 라우트 그룹
│   │   ├── layout.tsx          # 대시보드 레이아웃
│   │   ├── projects/
│   │   │   ├── page.tsx        # 프로젝트 목록
│   │   │   └── [id]/
│   │   │       ├── page.tsx    # 프로젝트 상세
│   │   │       ├── editor/
│   │   │       ├── analysis/
│   │   │       └── chat/
│   │   ├── templates/
│   │   └── settings/
│   │
│   └── api/                    # API Routes
│       ├── claude/
│       │   ├── generate/route.ts
│       │   ├── analyze/route.ts
│       │   └── chat/route.ts
│       ├── supabase/
│       │   └── webhook/route.ts
│       └── upload/route.ts
│
├── components/                 # React 컴포넌트
│   ├── ui/                     # shadcn/ui 컴포넌트
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── features/               # 기능별 컴포넌트
│   │   ├── chat/
│   │   │   ├── ChatInterface.tsx
│   │   │   ├── MessageBubble.tsx
│   │   │   └── ChatInput.tsx
│   │   ├── editor/
│   │   │   ├── CodeEditor.tsx
│   │   │   ├── LadderViewer.tsx
│   │   │   └── STEditor.tsx
│   │   ├── analysis/
│   │   │   ├── AnalysisPanel.tsx
│   │   │   └── IssueCard.tsx
│   │   └── projects/
│   │       ├── ProjectCard.tsx
│   │       └── ProjectList.tsx
│   └── layouts/                # 레이아웃 컴포넌트
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── Footer.tsx
│
├── lib/                        # 유틸리티 & 서비스
│   ├── supabase/
│   │   ├── client.ts           # Supabase 클라이언트
│   │   ├── server.ts           # 서버용 클라이언트
│   │   └── types.ts
│   ├── claude/
│   │   ├── client.ts           # Claude API 클라이언트
│   │   ├── prompts/
│   │   │   ├── system.ts
│   │   │   ├── code-generator.ts
│   │   │   └── analyzer.ts
│   │   └── types.ts
│   ├── plc-parser/             # PLC 파일 파싱
│   │   ├── siemens.ts
│   │   ├── allen-bradley.ts
│   │   └── types.ts
│   └── utils/
│       ├── cn.ts               # className 유틸
│       ├── format.ts
│       └── validation.ts
│
├── hooks/                      # Custom React Hooks
│   ├── useAuth.ts
│   ├── useProject.ts
│   ├── useClaudeChat.ts
│   └── useSupabase.ts
│
├── store/                      # Zustand 스토어
│   ├── authStore.ts
│   ├── projectStore.ts
│   └── chatStore.ts
│
├── types/                      # TypeScript 타입
│   ├── database.ts             # Supabase 자동 생성
│   ├── project.ts
│   └── plc.ts
│
├── supabase/                   # Supabase 설정
│   ├── migrations/
│   ├── functions/
│   └── config.toml
│
├── public/                     # 정적 파일
│   ├── favicon.ico
│   └── images/
│
├── .env.local
├── .env.example
├── next.config.js
├── tsconfig.json
├── tailwind.config.ts
└── package.json
```

---

## 6. 환경 변수

```bash
# .env.local
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# 서버 전용 (클라이언트 노출 안됨)
CLAUDE_API_KEY=sk-ant-...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# 옵션
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_MAX_FILE_SIZE=10485760  # 10MB
```

---

## 7. 주요 패키지

```json
{
  "dependencies": {
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",

    "@supabase/supabase-js": "^2.39.0",
    "@supabase/ssr": "^0.1.0",
    "@anthropic-ai/sdk": "^0.20.0",

    "zustand": "^4.5.0",
    "@tanstack/react-query": "^5.28.0",

    "tailwindcss": "^3.4.1",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-select": "^2.0.0",
    "framer-motion": "^11.0.8",
    "lucide-react": "^0.344.0",

    "@monaco-editor/react": "^4.6.0",
    "konva": "^9.3.0",
    "react-konva": "^18.2.0",
    "reactflow": "^11.11.0",

    "react-hook-form": "^7.51.0",
    "zod": "^3.22.4",
    "react-dropzone": "^14.2.3",
    "sonner": "^1.4.3",

    "date-fns": "^3.3.1",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.1",
    "class-variance-authority": "^0.7.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.24",
    "@types/react": "^18.2.61",
    "@types/react-dom": "^18.2.19",
    "typescript": "^5.3.3",
    "eslint": "^8.57.0",
    "eslint-config-next": "^15.0.0",
    "prettier": "^3.2.5",
    "autoprefixer": "^10.4.18",
    "postcss": "^8.4.35"
  }
}
```

---

## 8. 개발 워크플로우

### 로컬 개발
```bash
# Next.js 개발 서버
npm run dev          # localhost:3000

# Supabase 로컬 (선택적)
npx supabase start   # Docker로 로컬 Supabase 실행
npx supabase db push # 마이그레이션 적용

# 타입 생성 (Supabase 스키마 → TypeScript)
npx supabase gen types typescript --local > types/database.ts
```

### 배포
```bash
# Next.js
npm run build        # Next.js 빌드
npm start            # 프로덕션 서버
# → Vercel에 자동 배포 (권장)

# Supabase
# → Supabase Cloud에서 프로젝트 생성 후 연결
# → 마이그레이션은 Supabase Dashboard에서 자동 적용
```

---

## 9. 보안 고려사항

### API 키 관리
```typescript
// ❌ 절대 클라이언트에서 직접 호출하지 않기
const claude = new Anthropic({
  apiKey: process.env.NEXT_PUBLIC_CLAUDE_API_KEY  // 노출됨!
});

// ✅ Next.js API Route로 안전하게 처리
// app/api/claude/chat/route.ts
import Anthropic from '@anthropic-ai/sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const anthropic = new Anthropic({
    apiKey: process.env.CLAUDE_API_KEY,  // 서버 전용, 안전
  });

  const response = await anthropic.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 4096,
    messages,
  });

  return NextResponse.json(response);
}
```

### Row Level Security (RLS)
```sql
-- Supabase에서 자동으로 사용자별 데이터 격리
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can only see their own projects"
ON projects FOR SELECT
USING (auth.uid() = user_id);
```

---

## 10. Phase별 기술 스택 확장 계획

### Phase 1 (MVP - 현재)
- ✅ Next.js 15 (App Router)
- ✅ Supabase (Auth, DB, Storage)
- ✅ Claude API (API Routes로 프록시)
- ✅ 간단한 유사도 검색

### Phase 2 (고도화)
- ➕ Supabase Vector (pgvector) → 진짜 RAG
- ➕ Supabase Realtime → 협업 기능
- ➕ Edge Functions → Claude API 프록시
- ➕ Redis (Upstash) → 요청 캐싱

### Phase 3 (엔터프라이즈)
- ➕ Self-hosted Backend (Node.js)
- ➕ Dedicated Vector DB (Pinecone)
- ➕ Queue System (BullMQ)
- ➕ Custom LLM Fine-tuning

---

## 11. 비용 추정 (MVP)

### Supabase
```
Free Tier:
- 500MB Database
- 1GB File Storage
- 50,000 Monthly Active Users
- 2GB Bandwidth

→ MVP는 무료 범위 내 충분
```

### Claude API
```
Claude 4.5 Sonnet:
- Input: $3 / 1M tokens
- Output: $15 / 1M tokens

예상 사용량 (MAU 100명 기준):
- 월 500회 코드 생성 × 2,000 토큰 = 1M 토큰
- 비용: ~$18/month

→ Pro 플랜 $49에서 충분히 수익 가능
```

### Vercel (호스팅)
```
Free Tier:
- 무제한 배포
- 100GB Bandwidth
- Automatic HTTPS

→ MVP는 무료 범위 내 충분
```

**총 MVP 비용: ~$20-50/month**

---

## 12. 다음 단계

1. ✅ 기술 스택 확정 (Next.js 기반)
2. ⏭️ Next.js + TypeScript 프로젝트 생성
3. ⏭️ Supabase 프로젝트 생성 및 스키마 설계
4. ⏭️ Claude API 통합 레이어 구현 (API Routes)
5. ⏭️ 기본 UI 컴포넌트 시스템 구축 (shadcn/ui)
6. ⏭️ 첫 번째 기능 구현 (AI 채팅 인터페이스)