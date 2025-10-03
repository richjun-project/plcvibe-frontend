# 🚦 Rate Limiting & API Quota Management

## 개요

PLC Vibe는 Google Gemini API를 사용하여 AI 기반 PLC 코드 생성을 수행합니다. API에는 rate limits(요청 제한)이 있으며, 이를 효과적으로 관리하기 위한 시스템이 구현되어 있습니다.

## Gemini API Rate Limits

### Free Tier (무료)
- **gemini-2.0-flash**: 10 RPM, 250,000 TPM, 250 RPD
- **gemini-1.5-flash**: 15 RPM, 1,000,000 TPM, 1,500 RPD

### Tier 1 (유료) - 추천
- **gemini-2.0-flash**: **1,000 RPM**, 4,000,000 TPM, 10,000 RPD
- **gemini-1.5-flash**: 1,000 RPM, 4,000,000 TPM, 10,000 RPD

> **RPM**: Requests Per Minute (분당 요청 수)
> **TPM**: Tokens Per Minute (분당 토큰 수)
> **RPD**: Requests Per Day (하루 요청 수)

자세한 정보: https://ai.google.dev/gemini-api/docs/rate-limits

---

## Advanced Agent와 Rate Limits

### 왜 Rate Limit 문제가 발생하는가?

Advanced Agent는 **반복적 실행 방식**을 사용합니다:

```
1. 계획 수립 (Plan) → 1번 API 호출
2. Iteration 1: 코드 생성 → 1번 API 호출
3. Iteration 1: 검증 (로컬, API 호출 없음)
4. Iteration 2: 코드 재생성 → 1번 API 호출
5. ...
6. Iteration N: 코드 재생성 → 1번 API 호출
```

**문제:**
- 15번 반복 가능 → 최대 16번 API 호출
- Free tier: 10 RPM → **11번째 호출부터 429 에러 발생**

---

## 해결 방안

### 1. 모델 변경: `gemini-2.0-flash` (안정 버전)

**변경 전:**
```typescript
model: 'gemini-2.0-flash-exp'  // Experimental, 불안정
```

**변경 후:**
```typescript
model: 'gemini-2.0-flash'      // Stable, 권장
```

**장점:**
- ✅ 안정적인 버전
- ✅ 동일한 Free tier quota (10 RPM)
- ✅ 더 나은 신뢰성

### 2. Rate Limiter 구현

**자동 재시도 (Exponential Backoff):**
```typescript
// lib/ai/rate-limiter.ts
await rateLimiter.executeWithRetry(async () => {
  return await model.generateContent(prompt)
}, {
  onRetry: (attempt, delay) => {
    console.log(`Retry ${attempt} after ${delay}ms`)
  }
})
```

**기능:**
- 429 에러 감지 시 자동 재시도 (최대 3회)
- API의 `retryDelay` 값 사용 (기본 24초)
- Exponential backoff: 1s → 2s → 4s

### 3. 환경 변수로 모델 선택

```bash
# .env.local
GEMINI_MODEL=gemini-2.0-flash
```

**코드:**
```typescript
const modelName = process.env.GEMINI_MODEL || 'gemini-2.0-flash'
const model = genAI.getGenerativeModel({ model: modelName })
```

### 4. 사용자 친화적 에러 메시지

**프론트엔드:**
```typescript
if (errorMessage.includes('429') || errorMessage.includes('quota')) {
  toast.error("❌ API quota exceeded. Please wait and try again.")
}
```

**Progress UI:**
```
⏳ API quota reached, retrying (1/3)...
⏳ API quota reached, retrying (2/3)...
✅ Retry successful!
```

---

## Paid Tier 업그레이드 (권장)

### 업그레이드 이유

**Free Tier 제약:**
- 10 RPM → Advanced Agent가 11번째 iteration에서 실패
- 250 RPD → 하루 최대 15-16번 실행 가능

**Paid Tier 이점:**
- **1,000 RPM** → 분당 1000번 요청 가능
- 10,000 RPD → 하루 600-700번 실행 가능
- **프로덕션에 적합**

### 업그레이드 방법

1. **Google Cloud 콘솔 접속**
   - https://console.cloud.google.com/

2. **결제 활성화**
   - Billing → Create billing account

3. **Gemini API 활성화**
   - APIs & Services → Enable APIs

4. **자동으로 Tier 1 적용**
   - 결제 활성화 시 자동으로 1,000 RPM quota

5. **비용 확인**
   - Gemini 2.0 Flash: 입력 토큰당 $0.075 / 1M, 출력 토큰당 $0.30 / 1M
   - 평균 비용: 요청당 $0.001 ~ $0.01 (사용량에 따라 다름)

자세한 정보: https://ai.google.dev/pricing

---

## 모니터링 및 디버깅

### 로그 확인

**Rate Limit 재시도 로그:**
```
[RateLimiter] Rate limit hit. Retry 1/3 after 24000ms
⏳ Rate limit hit during code generation. Retrying (1) after 24000ms...
```

**에러 로그:**
```
Rate limit exceeded after 3 retries. Retry after 24s
```

### 사용량 확인

**Google Cloud Console:**
1. APIs & Services → Dashboard
2. Generative Language API 선택
3. Quotas & System Limits 확인

---

## 권장 설정

### 개발 환경 (무료)

```bash
# .env.local
GEMINI_MODEL=gemini-2.0-flash
```

**제약:**
- 10 RPM 제한
- Advanced Agent는 최대 10번 반복 권장

### 프로덕션 환경 (유료)

```bash
# .env.production
GEMINI_MODEL=gemini-2.0-flash
```

**설정:**
- Google Cloud 결제 활성화
- 1,000 RPM quota
- Advanced Agent는 15번 반복 가능

---

## 문제 해결

### Q: "429 Too Many Requests" 에러가 계속 발생합니다.

**A:** 다음을 확인하세요:
1. 모델이 `gemini-2.0-flash`로 설정되었는지 확인
2. Rate limiter가 작동 중인지 로그 확인
3. 여러 사용자가 동시에 사용 중인지 확인 (quota는 프로젝트당)
4. Paid tier 업그레이드 고려

### Q: Retry가 작동하지 않습니다.

**A:** 다음을 확인하세요:
1. `lib/ai/rate-limiter.ts` 파일이 존재하는지 확인
2. 모든 API 호출에서 `rateLimiter.executeWithRetry()` 사용 확인
3. 콘솔에 retry 로그가 출력되는지 확인

### Q: 무료 quota로 충분한가요?

**A:**
- **개발/테스트**: 충분 (10 RPM)
- **개인 사용**: 가능 (하루 15-20번 실행)
- **프로덕션**: 부족 → Paid tier 권장 (1,000 RPM)

---

## 관련 파일

- `lib/ai/rate-limiter.ts` - Rate limiting 로직
- `lib/ai/client.ts` - Gemini API 클라이언트
- `lib/ai/agent/advanced-agent.ts` - Advanced Agent (rate limiter 사용)
- `app/api/claude/auto-debug/route.ts` - Auto-debug API (rate limiter 사용)
- `components/features/chat/ChatInterface.tsx` - 에러 처리 UI

---

## 추가 참고 자료

- [Gemini API Rate Limits](https://ai.google.dev/gemini-api/docs/rate-limits)
- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Google Cloud Billing](https://cloud.google.com/billing/docs)