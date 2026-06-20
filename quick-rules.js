/**
 * quick-rules.js
 * im-not-ai 경량 윤문 엔진 (Quick Rules 기반)
 * 
 * 사용처: STT→Gemini→Word 보고서 파이프라인
 * 목표: Gemini 응답의 AI 티를 사람 말투로 변환
 * 기반: https://github.com/epoko77-ai/im-not-ai (MIT License)
 * 
 * 적용 대상:
 * - 농협 HACCP 컨설팅 보고서 (index.html)
 * - 모의회수(Mock Recall) 보고서 (haccp_recall.html)
 */

// ================================================================
// 1. 패턴 정의 (AI Tell Taxonomy - quick-rules 서브셋)
// ================================================================

const AI_TELL_PATTERNS = {
  // A. 번역투 (Translation Ease) - S1/S2 결정적·강함
  translationEase: [
    // A-2: ~를 통해 (X를 통해 Y를 하다 → X로 Y를 하다)
    {
      id: 'A-2',
      name: '을통해',
      regex: /([가-힣]+)(을|를)\s*통해\s+([가-힣]+)(을|를)\s*하/g,
      replace: '$1$2로 $3을 하',
      severity: 'S2',
      type: 'replacement'
    },
    // A-3: ~에 있어서 (맥락에 있어서 → 맥락에서)
    {
      id: 'A-3',
      name: '에있어서',
      regex: /([가-힣]+)(에)\s*있어서/g,
      replace: '$1에서',
      severity: 'S2',
      type: 'replacement'
    },
    // A-4: ~에 대해 (복수 대상일 때만)
    {
      id: 'A-4',
      name: '에대해',
      regex: /이에\s*대해(?:\s*서)?(?=[,.]|\s+[가-힣])/g,
      replace: '여기서',
      severity: 'S2',
      type: 'replacement'
    },
    // A-5: 이루어지다 (발생·진행 의미)
    {
      id: 'A-5',
      name: '이루어지',
      regex: /이루어지(고|며|었|은)/g,
      replace: '이뤄지$1',
      severity: 'S2',
      type: 'replacement'
    },
    // A-8: 가지고 있다 (보유 의미)
    {
      id: 'A-8',
      name: '가지고있다',
      regex: /가지고\s*있(다|으니|지|습니다)/g,
      replace: '갖고 있$1',
      severity: 'S1',
      type: 'replacement'
    },
    // A-12: ~에서의 (이중 조사)
    {
      id: 'A-12',
      name: '에서의',
      regex: /([가-힣]+)에서의\s+/g,
      replace: '$1의 ',
      severity: 'S2',
      type: 'replacement'
    },
    // A-13: ~으로의 (이중 조사)
    {
      id: 'A-13',
      name: '으로의',
      regex: /([가-힣]+)(으로|로)의\s+/g,
      replace: '$1$2 ',
      severity: 'S2',
      type: 'replacement'
    },
    // A-19: ~에의 (이중 조사)
    {
      id: 'A-19',
      name: '에의',
      regex: /([가-힣]+)에의\s+/g,
      replace: '$1의 ',
      severity: 'S2',
      type: 'replacement'
    }
  ],

  // D. AI 특유 관용구 (AI-specific Clichés) - S1 결정적
  aiClichés: [
    // D-1: 결론적으로 (문두 단언사)
    {
      id: 'D-1',
      name: '결론적으로',
      regex: /^[\s]*결론적으로[,.]?\s+/gm,
      replace: '',
      severity: 'S1',
      type: 'deletion'
    },
    // D-2: 시사하는 바가 크다
    {
      id: 'D-2',
      name: '시사하는바',
      regex: /시사하(는\s*바가|함이)\s*(크다|크며|크지\s*않다|크다는\s*점)/g,
      replace: '중요하다',
      severity: 'S1',
      type: 'replacement'
    },
    // D-3: 주목할 만하다
    {
      id: 'D-3',
      name: '주목할만',
      regex: /주목할\s*만(하다|합니다)/g,
      replace: '주목할 점은',
      severity: 'S1',
      type: 'replacement'
    },
    // D-4: hype 어휘 (과장 형용사)
    {
      id: 'D-4',
      name: 'hype',
      regex: /\b(매우|정말|매우|극도로)\s+(중요|필수|중대|강조|강력)(하다|합니다|하며)/g,
      replace: '$2하다',
      severity: 'S2',
      type: 'replacement'
    },
    // D-5: 혁신적·획기적 (과장 수식)
    {
      id: 'D-5',
      name: '혁신적획기적',
      regex: /\b(혁신적|획기적|전례\s*없는|획기적인)(인|이|)\s+/g,
      replace: '새로운 ',
      severity: 'S2',
      type: 'replacement'
    },
    // D-6: 압도적·막강한 (과장 수식)
    {
      id: 'D-6',
      name: '압도적막강',
      regex: /\b(압도적|막강|폭발적|파격적)(인|이)\s+/g,
      replace: '강력한 ',
      severity: 'S2',
      type: 'replacement'
    }
  ],

  // C. 구조적 AI 패턴 (Structural AI Patterns) - S1/S2
  structuralAI: [
    // C-1: 기계적 병렬 (첫째·둘째·셋째)
    {
      id: 'C-1',
      name: '기계적병렬',
      regex: /첫째[,.]?\s*둘째[,.]?\s*셋째/g,
      replace: '①②③',
      severity: 'S1',
      type: 'replacement'
    },
    // C-5: 불릿 남용 (과도한 하이픈)
    {
      id: 'C-5',
      name: '불릿남용',
      regex: /^\s*[-•]\s+/gm,  // 문두 불릿만
      replace: '• ',
      severity: 'S2',
      type: 'replacement',
      maxConsecutive: 3  // 연속 3개 이상이면 S1
    },
    // C-11: 연결어미 뒤 쉼표 (KatFish 신호)
    {
      id: 'C-11',
      name: '연결어미쉼표',
      regex: /([가-힣]+)(고|며|고는|면서)[,]\s+/g,
      replace: '$1$2 ',
      severity: 'S1',
      type: 'replacement'
    }
  ],

  // H. 접속사 남발 (Conjunction Spam) - S2
  conjunctionSpam: [
    // H-1: 문두 접속사 연속 (또한·따라서·즉·나아가)
    {
      id: 'H-1',
      name: '문두접속사',
      regex: /^(또한|따라서|즉|나아가)[,.]?\s+/gm,
      replace: '',
      severity: 'S2',
      type: 'deletion',
      maxConsecutive: 1  // 문단 내 3회 이상 반복 시 제거
    }
  ],

  // I. 형식명사 과다 (Formal Nouns Overuse) - S2
  formalNouns: [
    // I-2: 결합형 (것이다·것으로·것에)
    {
      id: 'I-2',
      name: '결합형',
      regex: /것(이|으로|에)\s+/g,
      replace: '',
      severity: 'S2',
      type: 'deletion'
    },
    // I-3: 결말 권고형 (할 필요가 있다)
    {
      id: 'I-3',
      name: '권고형',
      regex: /([가-힣]+)(할|해야\s*할)\s*필요가\s*있(다|습니다)/g,
      replace: '$1해야 한다',
      severity: 'S2',
      type: 'replacement'
    },
    // I-4: 점·수·바 (추상 형식명사)
    {
      id: 'I-4',
      name: '추상명사',
      regex: /의\s+(점|수|바|측면)(이|이다|입니다)/g,
      replace: '',
      severity: 'S3',
      type: 'deletion'
    }
  ],

  // G. Hedging 남용 (Hedging Overuse) - S2
  hedging: [
    // G-1: 다중 완곡 (것으로 보인다·수 있다)
    {
      id: 'G-1',
      name: '다중완곡',
      regex: /([가-힣]+)(으로\s*보인다|수\s*있(다|다는|을))/g,
      replace: '$1다',
      severity: 'S2',
      type: 'replacement',
      maxRate: 0.3  // 문장 30% 초과 시 제거
    }
  ],

  // B. 영어 인용 과다 (영문 병기 불릿 아웃)
  englishOveruse: [
    // B-1: CCP (Critical Control Point) 같은 반복 괄호 병기
    {
      id: 'B-1',
      name: '괄호병기',
      regex: /\(\s*[A-Z]{2,}\s*\)$/gm,
      replace: '',
      severity: 'S2',
      type: 'deletion',
      condition: 'consecutive'  // 연속 2회 이상
    }
  ]
};

// ================================================================
// 2. 핵심 함수
// ================================================================

/**
 * AI Tell 점수 계산
 * @param {string} text - 분석할 텍스트
 * @returns {object} { totalScore, breakdown: {S1, S2, S3}, needsRewriting }
 */
function calculateAiTellScore(text) {
  let scoreBreakdown = { S1: 0, S2: 0, S3: 0 };
  let patternMatches = [];

  Object.entries(AI_TELL_PATTERNS).forEach(([category, patterns]) => {
    patterns.forEach(pattern => {
      const matches = (text.match(pattern.regex) || []).length;
      if (matches > 0) {
        scoreBreakdown[pattern.severity] += matches;
        patternMatches.push({
          patternId: pattern.id,
          category,
          matches,
          severity: pattern.severity
        });
      }
    });
  });

  const totalScore = scoreBreakdown.S1 * 3 + scoreBreakdown.S2 * 1.5 + scoreBreakdown.S3 * 0.5;
  
  return {
    totalScore: Math.round(totalScore * 100) / 100,
    breakdown: scoreBreakdown,
    needsRewriting: scoreBreakdown.S1 > 0 || scoreBreakdown.S2 > 3,
    topPatterns: patternMatches.slice(0, 5),
    riskLevel: scoreBreakdown.S1 > 0 ? 'HIGH' : scoreBreakdown.S2 > 3 ? 'MEDIUM' : 'LOW'
  };
}

/**
 * Quick Rules 윤문 (단일 패스)
 * @param {string} text - 윤문할 텍스트
 * @param {object} options - { domain: 'haccp', preserveKeywords: [...] }
 * @returns {object} { rewritten, changes, changeRate, metrics }
 */
function rewriteWithQuickRules(text) {
  if (!text || typeof text !== 'string') {
    return { rewritten: text, changes: [], changeRate: 'none', metrics: null };
  }

  let result = text;
  let originalLength = text.length;
  let changesApplied = [];

  // S1 패턴 우선 (결정적 패턴)
  const severityOrder = ['S1', 'S2', 'S3'];

  severityOrder.forEach(severity => {
    Object.entries(AI_TELL_PATTERNS).forEach(([category, patterns]) => {
      patterns
        .filter(p => p.severity === severity)
        .forEach(pattern => {
          const regex = pattern.regex;
          const beforeText = result;
          
          // 특수 케이스: 연결어미 쉼표 (C-11)
          if (pattern.id === 'C-11') {
            result = result.replace(regex, (match, p1, p2) => {
              return `${p1}${p2} `;
            });
          }
          // 일반 치환
          else if (pattern.type === 'replacement') {
            result = result.replace(regex, pattern.replace);
          }
          // 삭제
          else if (pattern.type === 'deletion') {
            result = result.replace(regex, '');
          }

          // 변경 추적
          if (result !== beforeText) {
            const matchCount = (beforeText.match(regex) || []).length;
            changesApplied.push({
              patternId: pattern.id,
              category,
              name: pattern.name,
              matches: matchCount,
              severity: pattern.severity
            });
          }
        });
    });
  });

  // 연속 공백 정리
  result = result.replace(/\s{2,}/g, ' ').trim();

  // 변경률 계산
  const finalLength = result.length;
  const changeRate = Math.round(((originalLength - finalLength) / originalLength) * 100);

  return {
    rewritten: result,
    changes: changesApplied,
    changeRate: Math.min(changeRate, 100),
    metrics: {
      originalLength,
      finalLength,
      totalPatternsApplied: changesApplied.length,
      byCategory: groupBy(changesApplied, 'category'),
      bySeverity: groupBy(changesApplied, 'severity')
    }
  };
}

/**
 * 고급 윤문: 선택적 처리
 * @param {string} text
 * @param {object} options - { categories: ['A', 'D'], excludeSeverity: ['S3'] }
 */
function rewriteSelective(text, options = {}) {
  const { categories = null, excludeSeverity = [] } = options;
  
  if (!text) return { rewritten: text, changes: [] };

  let result = text;
  let changesApplied = [];

  Object.entries(AI_TELL_PATTERNS).forEach(([category, patterns]) => {
    // 카테고리 필터
    if (categories && !categories.includes(category)) return;

    patterns.forEach(pattern => {
      // 심각도 필터
      if (excludeSeverity.includes(pattern.severity)) return;

      const regex = pattern.regex;
      const beforeText = result;
      result = result.replace(regex, pattern.replace);

      if (result !== beforeText) {
        changesApplied.push({
          patternId: pattern.id,
          category,
          severity: pattern.severity
        });
      }
    });
  });

  return {
    rewritten: result,
    changes: changesApplied,
    patternsApplied: changesApplied.length
  };
}

// ================================================================
// 3. 유틸리티 함수
// ================================================================

/**
 * 배열을 키 기준으로 그룹화
 */
function groupBy(arr, key) {
  return arr.reduce((result, item) => {
    const groupKey = item[key];
    if (!result[groupKey]) result[groupKey] = 0;
    result[groupKey]++;
    return result;
  }, {});
}

/**
 * 보고서 필드별 윤문 (Gemini JSON 응답용)
 */
function humanizeReportObject(reportObj, fields = []) {
  const defaultFields = [
    'summary', 'findings', 'recommendations', 
    'executiveSummary', 'conclusion', 'notes'
  ];
  
  const targetFields = fields.length > 0 ? fields : defaultFields;
  const result = { ...reportObj };

  targetFields.forEach(field => {
    if (result[field] && typeof result[field] === 'string') {
      result[field] = rewriteWithQuickRules(result[field]).rewritten;
    }
  });

  return result;
}

/**
 * 보고서 전체 평가
 */
function evaluateReportQuality(reportObj) {
  let totalScore = 0;
  let fieldScores = {};

  Object.entries(reportObj).forEach(([key, value]) => {
    if (typeof value === 'string' && value.length > 20) {
      const score = calculateAiTellScore(value);
      fieldScores[key] = score;
      totalScore += score.totalScore;
    }
  });

  return {
    averageAiTellScore: Math.round(totalScore / Object.keys(fieldScores).length * 100) / 100,
    fieldScores,
    overallQuality: totalScore < 5 ? 'EXCELLENT' : totalScore < 10 ? 'GOOD' : 'FAIR',
    recommendation: totalScore > 15 ? 'Strict mode 권장' : 'Quick rules로 충분'
  };
}

// ================================================================
// 4. 내보내기 (CommonJS + ES6 모듈)
// ================================================================

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    calculateAiTellScore,
    rewriteWithQuickRules,
    rewriteSelective,
    humanizeReportObject,
    evaluateReportQuality,
    AI_TELL_PATTERNS,
  };
}

// ES6 모듈 지원
if (typeof exports !== 'undefined') {
  exports.calculateAiTellScore = calculateAiTellScore;
  exports.rewriteWithQuickRules = rewriteWithQuickRules;
  exports.rewriteSelective = rewriteSelective;
  exports.humanizeReportObject = humanizeReportObject;
  exports.evaluateReportQuality = evaluateReportQuality;
}

// 글로벌 윈도우 객체에 등록 (HTML <script> 태그 직접 사용)
if (typeof window !== 'undefined') {
  window.AiNotAI = {
    calculateAiTellScore,
    rewriteWithQuickRules,
    rewriteSelective,
    humanizeReportObject,
    evaluateReportQuality,
  };
}

// ================================================================
// 5. 사용 예시
// ================================================================

/*
// [예시 1] 단순 윤문
const geminiText = "결론적으로, 이번 컨설팅을 통해 시사하는 바가 크다는 점을 확인할 수 있었습니다.";
const { rewritten } = rewriteWithQuickRules(geminiText);
console.log(rewritten);
// 출력: "이번 컨설팅으로 확인한 내용이 중요합니다."

// [예시 2] 보고서 객체 윤문 (Gemini JSON)
const geminoiReport = {
  summary: "결론적으로, 농협은 시사하는 바가 크다...",
  findings: "이에 있어서 중요한 점은...",
  recommendations: "첫째, 둘째, 셋째..."
};
const humanized = humanizeReportObject(geminoiReport);

// [예시 3] 품질 평가
const quality = evaluateReportQuality(humanized);
if (quality.averageAiTellScore > 15) {
  // Strict 모드 권장
}

// [예시 4] HTML에서 직접 사용 (window.AiNotAI)
const result = window.AiNotAI.rewriteWithQuickRules(text);
*/
