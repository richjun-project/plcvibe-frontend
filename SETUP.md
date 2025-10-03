# PLC Vibe 설치 가이드

## 사전 요구사항

- Node.js 18+ 설치
- npm 또는 yarn
- Supabase 계정
- Claude API 키 (Anthropic)

## 1. 프로젝트 클론 및 의존성 설치

```bash
# 프로젝트 디렉토리로 이동
cd plcvibe

# 의존성 설치
npm install
```

## 2. Supabase 프로젝트 설정

### 2.1 Supabase 프로젝트 생성

1. [Supabase Dashboard](https://supabase.com/dashboard)에 로그인
2. "New Project" 클릭
3. 프로젝트 이름, 비밀번호, 리전 설정
4. 프로젝트 생성 완료 대기 (약 2분)

### 2.2 데이터베이스 스키마 적용

Supabase Dashboard에서:

1. 좌측 메뉴에서 **SQL Editor** 선택
2. `supabase/migrations/20240101000000_initial_schema.sql` 파일의 내용을 복사
3. SQL Editor에 붙여넣기
4. **Run** 버튼 클릭하여 실행

또는 Supabase CLI 사용:

```bash
# Supabase CLI 설치
npm install -g supabase

# Supabase 프로젝트 연결
npx supabase link --project-ref your-project-ref

# 마이그레이션 푸시
npx supabase db push
```

### 2.3 Supabase 인증 설정

1. Supabase Dashboard → **Authentication** → **Providers**
2. Email Provider 활성화
3. (선택) Google, GitHub OAuth 설정

### 2.4 API 키 확인

1. Supabase Dashboard → **Settings** → **API**
2. 다음 정보 복사:
   - `Project URL`
   - `anon public` key
   - `service_role` key (서버 전용)

## 3. Claude API 키 발급

1. [Anthropic Console](https://console.anthropic.com/)에 로그인
2. **API Keys** 메뉴로 이동
3. **Create Key** 클릭
4. API 키 복사 및 안전하게 보관

## 4. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일 생성:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Claude API (서버 전용)
CLAUDE_API_KEY=sk-ant-api03-your-key

# Supabase Service Role (서버 전용 - 선택사항)
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 앱 URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# 최대 파일 크기 (bytes)
NEXT_PUBLIC_MAX_FILE_SIZE=10485760
```

⚠️ **보안 주의사항:**
- `.env.local` 파일은 절대 Git에 커밋하지 마세요
- `NEXT_PUBLIC_*` 접두사가 없는 환경 변수는 클라이언트에 노출되지 않습니다

## 5. 개발 서버 실행

```bash
npm run dev
```

브라우저에서 [http://localhost:3000](http://localhost:3000) 열기

## 6. 빌드 및 프로덕션 배포

### 로컬 빌드

```bash
npm run build
npm start
```

### Vercel 배포 (권장)

1. [Vercel](https://vercel.com)에 로그인
2. **New Project** 클릭
3. GitHub 저장소 연결
4. 환경 변수 설정 (위의 `.env.local` 내용)
5. **Deploy** 클릭

Vercel은 자동으로:
- Next.js를 최적화하여 빌드
- 글로벌 CDN에 배포
- HTTPS 자동 설정
- 커밋마다 자동 재배포

## 7. 확인 사항

### 데이터베이스 연결 확인

```sql
-- Supabase SQL Editor에서 실행
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';

-- 결과로 다음 테이블들이 표시되어야 함:
-- profiles, projects, code_files, io_mappings,
-- analysis_results, ai_conversations, templates
```

### API 동작 확인

1. http://localhost:3000/chat 접속
2. "컨베이어 벨트 제어 코드 만들어줘" 입력
3. AI 응답이 정상적으로 표시되는지 확인

## 8. 문제 해결

### 환경 변수 인식 안됨

```bash
# 개발 서버 재시작
# Ctrl+C로 종료 후
npm run dev
```

### Supabase 연결 오류

1. `.env.local`의 `NEXT_PUBLIC_SUPABASE_URL`이 정확한지 확인
2. Supabase 프로젝트가 실행 중인지 확인 (Dashboard에서)
3. API 키가 올바른지 확인

### Claude API 오류

1. API 키가 `sk-ant-api03-`로 시작하는지 확인
2. Anthropic Console에서 API 키가 활성화되어 있는지 확인
3. API 사용량 한도를 초과하지 않았는지 확인

### 빌드 오류

```bash
# 캐시 삭제 후 재빌드
rm -rf .next
npm run build
```

## 9. 다음 단계

- ✅ 기본 설정 완료
- 📝 Supabase RLS 정책 검토 및 커스터마이징
- 🔐 인증 시스템 구현 (OAuth 등)
- 📊 프로젝트 관리 페이지 개발
- 💻 코드 에디터 페이지 개발
- 🎨 UI/UX 개선

## 도움이 필요하신가요?

- [GitHub Issues](https://github.com/yourusername/plcvibe/issues)
- [문서](./README.md)
- [기술 스택 상세](./TECH_STACK.md)