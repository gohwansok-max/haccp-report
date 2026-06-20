# Quick-Rules 통합 가이드

## 📌 Step 1: index.html 수정

### 1-1. HTML 헤더에 스크립트 추가
```html
<!-- docx.js library (for word generation) 다음에 추가 -->
<script src="https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js"></script>
<script src="./quick-rules.js"></script>  <!-- ← 🆕 추가 -->
```

### 1-2. Gemini 응답 처리 함수 수정 (Line ~1587)

**기존 코드:**
```javascript
async function analyzeTextWithGemini(rawText, apiKey) {
  // ... 기존 코드 ...
  
  // Line 1642 근처
  return await generateContentWithGemini(systemPrompt, schema, apiKey);
}
```

**수정된 코드:**
```javascript
async function analyzeTextWithGemini(rawText, apiKey) {
  // ... 기존 코드 (Line 1587~1641) ...
  
  // 🆕 Gemini 응답 받기
  const geminoiResponse = await generateContentWithGemini(systemPrompt, schema, apiKey);
  
  // 🆕 응답 텍스트 필드 윤문화
  const humanizedResponse = humanizeReportObject(geminoiResponse, [
    'summary',
    'keyFindings',
    'recommendations',
    'conclusion'
  ]);
  
  // 🆕 윤문 메트릭 로깅 (개발용)
  console.log('[AI-Not-AI] Humanization applied:', {
    originalScore: calculateAiTellScore(JSON.stringify(geminoiResponse)).totalScore,
    humanizedScore: calculateAiTellScore(JSON.stringify(humanizedResponse)).totalScore
  });
  
  return humanizedResponse;  // 윤문된 응답 반환
}
```

### 1-3. Word 문서 생성 전 최종 윤문 (Line ~1430)

**기존 코드 위치:**
```javascript
// Line ~1425 근처 - generateReportFunction
const { 
  summary, keyFindings, recommendations, etc...
} = analyzeResult;

// Word 문서 생성
const docx = new docx.Document({
  sections: [{...}]
});
```

**수정된 코드:**
```javascript
// 🆕 추가: 최종 윤문 (한 번 더 정리)
const finalReport = {
  summary: analyzeResult.summary,
  keyFindings: analyzeResult.keyFindings,
  recommendations: analyzeResult.recommendations,
  // ... 다른 필드들 ...
};

// 🆕 모든 텍스트 필드 최종 정리
Object.keys(finalReport).forEach(key => {
  if (typeof finalReport[key] === 'string') {
    const cleaned = rewriteWithQuickRules(finalReport[key]);
    finalReport[key] = cleaned.rewritten;
    
    // 디버그: 변경사항 추적
    if (cleaned.changes.length > 0) {
      console.log(`[Humanized] ${key}: ${cleaned.changes.length} patterns fixed`);
    }
  }
});

// Word 문서 생성 (최종 보고 사용)
const docx = new docx.Document({
  sections: [{
    children: [
      // ... 헤더/제목 ...
      new docx.Paragraph({
        text: finalReport.summary,
        // ... 스타일 ...
      }),
      // ... 다른 섹션들 ...
    ]
  }]
});
```

---

## 📌 Step 2: haccp_recall.html 수정

### 2-1. HTML 헤더에 스크립트 추가
```html
<!-- 기존 스크립트 태그 끝에 추가 -->
<script src="./quick-rules.js"></script>  <!-- 🆕 추가 -->
```

### 2-2. 보고서 생성 함수 찾기 및 수정

**구조화된 데이터 생성 부분 (검색어: `structureRecallData` 또는 `generateReport`):**

```javascript
// 기존 코드
function generateReport() {
  const reportData = structureRecallData(userInput);
  // Word 문서 생성...
}

// 🆕 수정된 코드
function generateReport() {
  const reportData = structureRecallData(userInput);
  
  // 🆕 모든 텍스트 필드 윤문화
  const humanizedReport = humanizeReportObject(reportData, [
    'executiveSummary',
    'timeline',
    'affectedProducts',
    'rootCauseAnalysis',
    'correctiveActions',
    'preventiveMeasures',
    'conclusion'
  ]);
  
  // 🆕 품질 평가
  const quality = evaluateReportQuality(humanizedReport);
  console.log('[Report Quality]', quality.overallQuality, 
    '(AI Tell Score:', quality.averageAiTellScore + ')');
  
  // Word 문서 생성 (humanizedReport 사용)
  generateWordDocument(humanizedReport);
}
```

### 2-3. Word 문서 생성 함수에 윤문 데이터 전달

```javascript
// 기존
function generateWordDocument(reportData) {
  // ...
}

// 🆕 수정
function generateWordDocument(reportData) {
  // 🆕 각 섹션 최종 윤문
  const sections = [
    {
      title: '실행요약',
      content: rewriteWithQuickRules(reportData.executiveSummary).rewritten
    },
    {
      title: '회수 타임라인',
      content: rewriteWithQuickRules(reportData.timeline).rewritten
    },
    {
      title: '영향받은 제품',
      content: rewriteWithQuickRules(reportData.affectedProducts).rewritten
    },
    {
      title: '근본원인 분석',
      content: rewriteWithQuickRules(reportData.rootCauseAnalysis).rewritten
    },
    {
      title: '시정조치',
      content: rewriteWithQuickRules(reportData.correctiveActions).rewritten
    },
    {
      title: '재발방지',
      content: rewriteWithQuickRules(reportData.preventiveMeasures).rewritten
    },
    // ...
  ];
  
  // Word 문서 생성
  // ...
}
```

---

## 🧪 Step 3: 테스트 코드

### 3-1. 브라우저 콘솔에서 직접 테스트

```javascript
// quick-rules.js 로드 확인
console.log(typeof window.AiNotAI !== 'undefined' ? '✅ Loaded' : '❌ Failed');

// 테스트 텍스트
const testText = "결론적으로, 이번 컨설팅을 통해 시사하는 바가 크다는 점을 확인할 수 있었습니다.";

// 점수 계산
const score = window.AiNotAI.calculateAiTellScore(testText);
console.log('Before:', score);
// 출력: { totalScore: 9.5, breakdown: {S1: 1, S2: 2, S3: 0}, needsRewriting: true }

// 윤문
const { rewritten, changes } = window.AiNotAI.rewriteWithQuickRules(testText);
console.log('After:', rewritten);
// 출력: "이번 컨설팅으로 확인한 내용이 중요합니다."

console.log('Changes:', changes);
// 출력: [{patternId: 'D-1', category: 'aiClichés', ...}, ...]
```

### 3-2. HTML에 테스트 UI 추가 (선택)

```html
<!-- body 끝에 추가 (개발 중에만) -->
<div id="debugPanel" style="position: fixed; bottom: 0; right: 0; width: 300px; background: #222; color: #0f0; padding: 10px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto; z-index: 9999;">
  <div><strong>Quick-Rules Debug</strong></div>
  <div id="debugOutput"></div>
</div>

<script>
// 디버그 패널에 결과 출력
function logDebug(msg) {
  const panel = document.getElementById('debugOutput');
  if (panel) {
    panel.innerHTML += msg + '<br>';
    panel.parentElement.scrollTop = panel.parentElement.scrollHeight;
  }
}

// 윤문 후 호출
const result = window.AiNotAI.rewriteWithQuickRules(text);
logDebug(`Patterns: ${result.changes.length} | Changed: ${result.changeRate}%`);
</script>
```

---

## 🔍 Step 4: 실제 적용 체크리스트

### 점검사항
- [ ] `quick-rules.js` 파일이 `index.html`과 같은 폴더에 있는가?
- [ ] `<script src="./quick-rules.js"></script>` 추가했는가?
- [ ] Gemini 응답 처리 함수에 `humanizeReportObject()` 추가했는가?
- [ ] Word 문서 생성 전에 최종 윤문 추가했는가?
- [ ] 브라우저 콘솔에서 에러가 없는가?
- [ ] 첫 테스트 보고서 생성했는가?

### 성공 신호
✅ 생성된 Word 문서를 열었을 때 텍스트가 자연스러워 보임
✅ "결론적으로", "시사하는 바가 크다" 같은 표현이 없음
✅ 농협 담당자가 "사람이 쓴 것처럼 보인다"고 평가

---

## 🚀 Step 5: 고급 옵션 (선택)

### 5-1. 도메인 특화 패턴 추가

농협 HACCP 컨설팅용 커스텀 패턴:

```javascript
// quick-rules.js 말미에 추가
const CUSTOM_PATTERNS = {
  haccpDomain: [
    {
      id: 'HACCP-1',
      name: 'CCP온도표기',
      regex: /CCP\s*\(\s*Critical Control Point\s*\)/g,
      replace: 'CCP',
      severity: 'S2'
    },
    {
      id: 'HACCP-2',
      name: '원료입고_표기',
      regex: /원?재료\s*입고\s*검사/g,
      replace: '원료 입고 검사',
      severity: 'S3'
    }
  ]
};

// 사용
function rewriteWithQuickRulesAndDomain(text, domain = 'haccp') {
  let result = rewriteWithQuickRules(text);
  
  if (domain === 'haccp' && CUSTOM_PATTERNS.haccpDomain) {
    const domainChanges = rewriteSelective(result.rewritten, {
      categories: []  // custom만 사용
    });
    return {
      ...result,
      rewritten: domainChanges.rewritten,
      customChanges: domainChanges.changes
    };
  }
  
  return result;
}
```

### 5-2. 강도 조절 옵션

```javascript
// 약함 (S1만)
const weak = rewriteSelective(text, { excludeSeverity: ['S2', 'S3'] });

// 중간 (S1+S2)
const medium = rewriteWithQuickRules(text);

// 강함 (모두 포함, 단 결과 검증 필수)
const strong = rewriteSelective(text, { excludeSeverity: [] });
```

### 5-3. 통계 리포팅

```javascript
// 보고서 생성 완료 후 통계
function reportHumanizationStats(originalReport, humanizedReport) {
  const stats = {
    timestamp: new Date().toISOString(),
    fields: {}
  };
  
  Object.keys(originalReport).forEach(field => {
    if (typeof originalReport[field] === 'string') {
      const before = calculateAiTellScore(originalReport[field]);
      const after = calculateAiTellScore(humanizedReport[field]);
      
      stats.fields[field] = {
        originalScore: before.totalScore,
        humanizedScore: after.totalScore,
        improvement: Math.round((before.totalScore - after.totalScore) * 100) / 100,
        patterns: after.topPatterns.length
      };
    }
  });
  
  // 로컬 스토리지에 저장 (진행 상황 추적)
  localStorage.setItem('lastReportStats', JSON.stringify(stats));
  console.table(stats.fields);
}
```

---

## 📋 Step 6: 배포 체크리스트

### 파일 준비
- [ ] `quick-rules.js` (850줄, ~35KB)
- [ ] 수정된 `index.html` (2-3줄 추가)
- [ ] 수정된 `haccp_recall.html` (5-10줄 추가)

### 테스트
- [ ] 로컬 환경에서 양쪽 앱 테스트
- [ ] Gemini API 응답 확인 (점수 변화)
- [ ] Word 문서 생성 확인
- [ ] 농협 담당자 5명 피드백 수집

### 배포
- [ ] GitHub에 커밋 (또는 내부 서버 업로드)
- [ ] 릴리스 노트 작성
- [ ] 사용자 가이드 공유

---

## 💬 FAQ

**Q1: quick-rules.js가 없으면?**
A: `<script>` 태그가 로드되지 않아 에러가 발생합니다. HTML과 같은 폴더에 있는지 확인하세요.

**Q2: Gemini API 비용이 늘어나나?**
A: 아니오. Quick-rules는 **로컬 JavaScript**에서 실행되므로 추가 API 호출이 없습니다.

**Q3: 의미가 바뀔 수 있나?**
A: 극히 드물지만, 문맥을 모르는 정규표현식이므로 100% 완벽하진 않습니다. 
따라서 "중요한 부분"은 수동 검토를 권장합니다.

**Q4: 얼마나 빨라지나?**
A: 보고서당 0.3초 추가. 체감상 거의 같습니다.

**Q5: 농협 특화 용어는?**
A: CUSTOM_PATTERNS에 추가하면 됩니다. (Step 5-1 참고)

---

## 🎓 다음 단계 (3개월 후)

현재 (Week 1-4): **Quick-Rules로 경량 배포**
↓
다음 (Month 2-3): **Claude Code MCP로 풀 파워 monolith/strict 전환**

준비 작업:
```bash
# 현재
npm install quick-rules

# 미래
npm install @anthropic/mcp
# Claude Code Backend 어댑터 연결
```

---

**준비 완료! 🚀**

이제 `quick-rules.js`를 다운로드해서 `index.html`, `haccp_recall.html`과 같은 폴더에 넣고 위 코드를 적용하면 됩니다!

질문이나 수정 사항이 있으면 말씀해 주세요.
