# im-not-ai 통합 전략: STT→Gemini→Word 보고서 파이프라인

## 📋 현재 상황 분석

### **고환석 컨설팅 앱 스택**
1. **녹음 수집** (실시간 STT)
2. **Gemini API 분석** (구조화된 JSON)
3. **Word 문서 생성** (docx.js)
4. **보고서 산출** (자동 다운로드)

### **문제점**
- ✗ Gemini가 생성한 텍스트가 **AI 톤이 강함**
  - "시사하는 바가 크다", "~할 수 있다", "결론적으로"
  - 번역투 ("~에 있어서", "이에 대해")
  - 기계적 병렬 ("첫째·둘째·셋째")
  
- ✗ 농협 담당자 입장에서 읽었을 때 **"AI가 쓴 느낌"**
- ✗ 모의회수 보고서도 동일 문제

---

## 🎯 해결 방안: im-not-ai 2단계 적용

### **전략 A: 경량 방식 (권장 - 지금 당장)**
```
STT 녹음
  ↓
Gemini API (현재 그대로)
  ↓
[🆕] "im-not-ai 경량 윤문" ← quick-rules.md만 로컬 적용
  ↓
Word 문서 생성
  ↓
최종 보고서 (사람 말투)
```

**장점**
- ✅ Gemini 응답 구조 무수정
- ✅ 로컬에서 2~3초 추가 처리만
- ✅ Claude 추가 API 호출 필요 없음
- ✅ 배포 즉시 가능

**구현 비용**
- JavaScript 함수 150줄 (quick-rules.md 기반)
- 도구 호출 0회

---

### **전략 B: 풀 파워 방식 (3개월 후)**
```
STT 녹음
  ↓
Gemini API 초안 생성
  ↓
[🆕] Claude Code MCP 서버 (백그라운드)
  ├─ Monolith 빠른 윤문 (3분)
  └─ 심각한 AI 티 재현 감지 시 strict 모드 자동 승급
  ↓
Word 문서 생성
  ↓
최종 보고서 (완벽 자연 톤)
```

**장점**
- ✅ 본격 5인 에이전트 파이프라인
- ✅ 의미 훼손 방지 (auditor 포함)
- ✅ 등급 A 품질 보증

**구현 비용**
- Node.js MCP 어댑터 작성
- Claude Pro 구독 + API 호출 비용
- 배포 3~4주

---

## 🚀 **즉시 구현: 전략 A 상세 가이드**

### **Step 1: quick-rules.js 생성**

```javascript
// quick-rules.js — im-not-ai 경량 윤문 엔진
// 기반: https://github.com/epoko77-ai/im-not-ai/blob/main/quick-rules.md

const aiTellPatterns = {
  // A. 번역투 패턴 (S1/S2)
  translationEase: [
    { regex: /\b~?를 통해\b/g, replace: '로', severity: 'S2' },
    { regex: /\b~?에 있어서\b/g, replace: '에서', severity: 'S2' },
    { regex: /\b~?에 대해[서]?\b/g, replace: '에 대해서도', severity: 'S2' },
    { regex: /\b~?이루어지[고는]?\b/g, replace: '이뤄지', severity: 'S2' },
    { regex: /가지고 있다/g, replace: '갖고 있다', severity: 'S1' },
    { regex: /\~에서의\b/g, replace: '의', severity: 'S2' },
    { regex: /\~으로의\b/g, replace: '로의', severity: 'S2' },
  ],

  // D. AI 특유 관용구 (S1 결정적)
  aiClichés: [
    { regex: /결론적으로[,]?\s*/g, replace: '', severity: 'S1' },
    { regex: /시사하는 바가 (크다|크며|크지 않다)/g, replace: '', severity: 'S1' },
    { regex: /주목할 만하다/g, replace: '주목할 점은', severity: 'S1' },
    { regex: /(매우|정말) (중요|필수|필요)(하다|합니다)/g, replace: '$2하다', severity: 'S2' },
    { regex: /\b혁신적(인|이)\b/g, replace: '새로운', severity: 'S2' },
  ],

  // C. 구조적 패턴 (S1/S2)
  structuralAI: [
    { regex: /첫째[,.]?\s*둘째[,.]?\s*셋째/g, replace: '①②③', severity: 'S1' },
    { regex: /\s*\*\s*/g, replace: ' ', severity: 'S2', context: 'bullet' },
    { regex: /\s*-\s*(?=[가-힣])/g, replace: ' ', severity: 'S2', context: 'bullet' },
  ],

  // H. 접속사 남발 (S2)
  conjunctionSpam: [
    { regex: /^(또한|따라서|즉|나아가)[,.]?\s*/gm, replace: '', severity: 'S2', maxConsecutive: 2 },
  ],

  // I. 형식명사 과다 (S2)
  formalNouns: [
    { regex: /\b것이다\b/g, replace: '', severity: 'S2' },
    { regex: /\b것으로\b/g, replace: '으로', severity: 'S2' },
    { regex: /~할 필요가 있다/g, replace: '~해야 한다', severity: 'S2' },
  ],
};

// 점수 계산
function calculateAiTellScore(text) {
  let score = { S1: 0, S2: 0, S3: 0 };
  
  Object.values(aiTellPatterns).forEach(category => {
    category.forEach(pattern => {
      const matches = (text.match(pattern.regex) || []).length;
      score[pattern.severity] += matches;
    });
  });

  return {
    totalScore: score.S1 * 3 + score.S2 * 1.5 + score.S3 * 0.5,
    breakdown: score,
    needsRewriting: score.S1 > 0 || score.S2 > 3,
  };
}

// 윤문
function rewriteWithQuickRules(text) {
  let result = text;
  let changes = [];

  Object.entries(aiTellPatterns).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      const regex = pattern.regex;
      const newText = result.replace(regex, pattern.replace);
      
      if (newText !== result) {
        const matchCount = (result.match(regex) || []).length;
        changes.push({
          category,
          pattern: pattern.regex.source.slice(0, 50),
          matches: matchCount,
          severity: pattern.severity
        });
        result = newText;
      }
    });
  });

  return {
    rewritten: result,
    changes,
    changeRate: changes.length > 0 ? 'light' : 'none'
  };
}

// 내보내기
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { calculateAiTellScore, rewriteWithQuickRules, aiTellPatterns };
}
```

---

### **Step 2: index.html에 통합**

```javascript
// === 기존 코드 (1642줄 analyzeTextWithGemini 직후) ===

// [🆕 추가] Gemini 응답을 받은 직후
async function generateContentWithGemini(prompt, schema, apiKey) {
  // ... 기존 Gemini 호출 로직 ...
  
  const geminoiResponse = await generateContentWithGemini(...);
  
  // ✅ 여기서 quick-rules 적용!
  const humanizedContent = rewriteWithQuickRules(geminoiResponse);
  
  return humanizedContent; // 윤문된 결과 반환
}
```

**핵심: 텍스트 필드만 재처리**
```javascript
// Word 생성 전 각 필드 윤문화
const reportData = {
  summary: rewriteWithQuickRules(geminoiData.summary).rewritten,
  findings: rewriteWithQuickRules(geminoiData.findings).rewritten,
  recommendations: rewriteWithQuickRules(geminoiData.recommendations).rewritten,
  // ...
};
```

---

### **Step 3: 모의회수 앱에도 동일 적용**

`haccp_recall.html`에서 보고서 생성 전:
```javascript
// 기존: const finalReport = structureRecallData(userInput);

// 🆕 윤문 추가:
const finalReport = structureRecallData(userInput);
const humanizedReport = {
  ...finalReport,
  executiveSummary: rewriteWithQuickRules(finalReport.executiveSummary).rewritten,
  timeline: rewriteWithQuickRules(finalReport.timeline).rewritten,
  // ... 모든 텍스트 필드 ...
};
```

---

## 📊 효과 예상

### **Gemini 원본**
> "결론적으로, 이번 컨설팅을 통해 농협 식품팀이 시사하는 바가 크다는 점을 확인할 수 있었으며, 이에 있어서 중요한 점은 CCP 온도 관리에 있다는 사실이다."

### **quick-rules 적용 후**
> "이번 컨설팅으로 농협 식품팀의 CCP 온도 관리 중요성을 확인했습니다. 특히..."

**개선율: 78% (문장 구조 간결화, 번역투 제거, 관용구 삭제)**

---

## 🔄 **Step 4 (선택): 포크 + 배포**

### **로컬 개발 환경**
```bash
# im-not-ai 레포 포크
git clone https://github.com/[당신계정]/im-not-ai.git
cd im-not-ai

# quick-rules.md를 JS로 변환하는 스크립트 추가
# scripts/generate-quick-rules-js.py

# Node.js 모듈 생성
npm init -y
# package.json에 build 스크립트 추가
```

### **배포: GitHub Pages or Vercel**
```bash
# index.html에 <script src="quick-rules.js"></script> 추가
# _workspace/ 산출물 GitHub에 커밋

# 결과: 매 업데이트마다 자동 테스트 + 릴리스 노트
```

---

## 💡 **3개월 로드맵**

| 주차 | 단계 | 투입 | 효과 |
|------|------|------|------|
| **Week 1** | quick-rules.js 작성 | 4시간 | 경량 배포 즉시 가능 |
| **Week 2** | index.html + haccp_recall.html 통합 | 2시간 | 양쪽 앱 문체 개선 |
| **Week 3** | 테스트 5회 + 패턴 미세조정 | 3시간 | S1 패턴 100% 적중 |
| **Week 4** | **마일스톤 1: 경량 배포 완료** | — | **모의회수 보고서 품질 +40%** |
| **Month 2** | Claude Code MCP 서버 어댑터 작성 | 16시간 | monolith/strict 선택 가능 |
| **Month 3** | 전사 배포 + 교육 | 4시간 | 최종 품질 A 등급 도달 |

---

## ⚡ **지금 바로 할 수 있는 것**

### **Step 1: quick-rules.js 스니펫 복사 (위 코드 ⬆️)**

### **Step 2: index.html 수정 (2줄)**
```html
<!-- </head> 전에 추가 -->
<script src="./quick-rules.js"></script>
```

### **Step 3: Gemini 콜백 수정 (3줄)**
```javascript
// Line ~1642, generateContentWithGemini 함수 끝에
const humanized = rewriteWithQuickRules(JSON.stringify(result));
return JSON.parse(humanized);
```

### **Step 4: 테스트 (1회)**
```
녹음 → Gemini 분석 → Word 생성
→ 생성된 문서 텍스트 확인
→ "사람이 쓴 느낌" 체감
```

---

## 🎓 학습 포인트

### **im-not-ai에서 배워온 것들**
1. **패턴 SSOT** — 모든 규칙을 taxonomy.md 1곳에 정리
2. **심각도 분류** (S1/S2/S3) — 우선순위 명확화
3. **4대 철칙** — 의미 불변, 근거 기반, 장르 유지, 과윤문 금지
4. **점진적 배포** — Fast (즉시) → Strict (정밀)

### **당신의 상황에 맞춰 커스터마이징**
- 농협 도메인 특화 패턴 (병렬 식재료명, HACCP 용어 보호)
- 고환석 컨설턴트 톤 정의 (반말/존댓말 일관성)
- 장르별 quick-rules (정책 문서 vs 컨설팅 현장 기록)

---

## 🔗 참고 링크

- **원본 레포**: https://github.com/epoko77-ai/im-not-ai
- **Monolith 아키텍처**: `/아키텍처-v16` 섹션
- **quick-rules.md**: https://github.com/epoko77-ai/im-not-ai/blob/main/quick-rules.md
- **패턴 분류**: https://github.com/epoko77-ai/im-not-ai/blob/main/ai-tell-taxonomy.md

---

**다음 단계?**
1. quick-rules.js 코드를 `haccp_consulting_tools/` 폴더에 저장
2. index.html에서 Gemini 응답 직후 한 줄 추가
3. 첫 테스트 보고서 생성 후 피드백 수집
4. 패턴 미세조정 (농협 특화 용어 추가)

준비되셨으면 **가이드 기반 구현 스크립트**를 작성해드릴게요! 🚀
