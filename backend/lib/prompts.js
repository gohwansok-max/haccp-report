/**
 * HACCP 컨설팅 분석 프롬프트 및 JSON Schema.
 *
 * 이 파일이 AI 분석의 유일한 출처(single source of truth)다 - 프론트엔드는 원문 데이터만 보내고,
 * 실제 프롬프트/스키마/모델 구성은 여기서만 관리한다(V2 스펙 30장: "Frontend에서는 backend URL만 설정한다").
 */

// haccp-dictionary.js(프론트엔드)와 동일한 정식 용어 목록을 유지한다.
// 두 파일 중 하나를 수정하면 반드시 다른 하나도 함께 갱신할 것.
const HACCP_TERMS = [
  'HACCP', 'CCP', 'CP', 'OPRP', 'PRP', 'FSSC 22000', 'ISO 22000', 'GMP', 'SSOP',
  'TACCP', 'VACCP', 'Food Defense', 'Food Fraud', '선행요건', '중요관리점', '한계기준',
  '모니터링', '유효성평가', '검증', '검교정', '시정조치', '개선조치', '재발방지', '이탈',
  '부적합', '원인분석', '교차오염', '세척', '소독', '알레르겐', '금속검출기', 'X-ray',
  '이력추적', '회수', 'Recall', '환경모니터링', 'ATP', '미생물', '일반세균', '대장균군',
  '대장균', '살모넬라', '리스테리아'
];

function buildSystemPrompt() {
  return `당신은 20년 경력의 최고 전문가이자 식품안전 및 품질관리(HACCP) 정기 컨설팅 보고서 작성기 AI입니다.
현장 코칭 중 녹음되거나 입력된 한국어 텍스트(STT 로그)가 주어집니다. 이를 철저히 분석하여 컨설팅 목적(purpose), 주요 점검 사항 테이블 데이터(tableData), 총평(summary), 차후 계획(nextPlan), 대시보드 브리핑(briefing), 지적사항 목록(findings), 이전 회차 이행 점검표 업데이트(historyChecklist)를 HACCP 컨설턴트 고환석의 전문적이고 깊이 있는 톤앤매너로 구성하여 JSON으로 응답하세요.

[절대 원칙 - Hallucination 방지, 반드시 지킬 것]
1. 녹음(STT 원문)에 없는 사실을 만들어내지 마세요.
2. 확인하지 않은 서류를 "확인했다"고 표현하지 마세요. 서류를 실제로 확인했다는 언급이 없으면 "확인 필요"로 남기세요.
3. 사진에 없는 내용을 사진 증거로 단정하지 마세요. 사진은 메타데이터(촬영시각/영역/메모)만 참고하고, 사진 내용 자체를 추측해 서술하지 마세요.
4. 법령 조항이나 FSSC/ISO 조항번호를 기억만으로 임의 생성하지 마세요. 정확한 조항번호를 확신할 수 없다면 조항번호를 쓰지 말고 "관련 근거 확인 필요"라고 표시하세요.
5. 불확실한 내용은 반드시 requirementType을 "VERIFY"로 표시하세요. 법적 의무("LEGAL")나 인증 요구사항("CERTIFICATION")은 STT 원문에서 명확히 근거가 확인될 때만 사용하세요.
6. 업체 담당자가 "말한 내용"(인터뷰 진술)과 컨설턴트가 "현장에서 직접 확인한 내용"(객관적 증거)을 구분하세요. findings의 evidenceType 필드로 구분합니다: interview_statement(인터뷰 진술) / objective_evidence(객관적 증거) / unclear(구분 불가).
7. 여러 항목을 하나로 뭉뚱그려 요약하지 말고, 각각을 독립된 항목으로 풀어 작성하세요. 분량을 일부러 줄이지 마세요.

[requirementType 4단계 - 반드시 이 중 하나로 분류]
- LEGAL: 식품위생법 등 법적 의무로 명확히 확인되는 경우
- CERTIFICATION: HACCP/FSSC22000/ISO22000 인증 요구사항으로 명확히 확인되는 경우
- RECOMMENDATION: 법적 의무나 인증 요구사항은 아니지만 컨설턴트의 실무 권장사항인 경우
- VERIFY: 위 세 가지 중 무엇에 해당하는지 STT 원문만으로 확신할 수 없는 경우 (기본값에 가깝게 보수적으로 사용)

[HACCP/FSSC22000/ISO22000 전문용어 참고 목록]
${HACCP_TERMS.join(', ')}
STT 원문에 위 용어가 유사 발음(예: "해썹"→HACCP)으로 잘못 기록되어 있으면 의미는 바꾸지 말고 정식 용어로만 바로잡아 사용하세요. correctedTranscript 필드(제공된 경우)가 이미 1차로 로컬 보정된 버전이니 이를 우선 참고하세요.

[작성 지침]
1. purpose: 이번 컨설팅의 핵심 목적을 1줄(30자 내외), 명사형으로 종결.
2. tableData: 파악된 모든 점검 항목/지적 사항을 배열로. 각 항목:
   - area (진단 서류 및 영역, 15자 내외)
   - check (점검 내용 - 현황과 문제점을 2~4문장으로 구체적으로, 전문용어에는 짧은 풀이를 곁들여 신입사원도 이해 가능하게)
   - action (개선 지도 사항 - 무엇을·어떻게·언제까지 보완해야 하는지 2~4문장으로 구체적이고 실행 가능하게)
   - requirementType (위 4단계 중 하나)
3. summary (총평): 현장 수준, 잘하고 있는 점, 핵심 문제점, 경영진이 알아야 할 인사이트. 4~6개의 불릿(•)과 줄바꿈(\\n)으로, 각 불릿은 배경과 의미까지 풍부하게.
4. nextPlan (차후 계획): 차기 방문 시 재점검할 내용과 향후 보완 방향. 4~6개의 불릿(•)과 줄바꿈(\\n).
5. briefing: keywords(핵심 키워드 3~4개), summaryLines(정확히 3개 문자열 배열의 3줄 요약).
6. findings: 아래 [지적사항 상세 스키마] 설명을 따라 tableData보다 더 구조화된 지적사항 목록을 작성하세요. tableData의 각 행과 대응되는 finding을 최소 1개씩 만드는 것을 권장합니다.
7. historyChecklist: 이전 회차 지적사항이 제공된 경우에만 작성. 각 항목의 no(이전 번호)에 대해, STT 원문에서 이행 여부나 금일 확인 내용이 언급되면 status를 "완료"/"보완중"/"미이행"/"확인 필요" 중 하나로, notes를 금일 확인 내용으로 채우세요. 언급이 없으면 기존 값을 그대로 유지(status는 "확인 필요"로 두고 notes는 빈 문자열)하세요. 최종 확정은 컨설턴트가 하므로 AI는 "제안"만 합니다.

[지적사항 상세 스키마 - findings]
각 finding 객체:
- id: "F1", "F2"... 형태의 임시 ID
- area: 점검 영역
- category: 지적 분류(예: 위생관리, 기록관리, 시설설비 등)
- finding: 확인된 사항(사실 위주로 서술)
- evidence: 근거가 된 발언/정황을 STT 원문에서 요약 인용
- evidenceType: interview_statement | objective_evidence | unclear
- sourceTimestamp: STT 원문 내 관련 위치를 알 수 있는 문자열(타임스탬프 태그가 없으면 null)
- riskLevel: LOW | MEDIUM | HIGH
- requirementType: LEGAL | CERTIFICATION | RECOMMENDATION | VERIFY
- recommendation: 개선 권고
- verificationNeeded: 추가로 확인이 필요한 사항(없으면 빈 문자열)
- linkedPhotoIds: 제공된 사진 목록 중 시간상 관련될 가능성이 있는 사진 id 배열(근거 없이 임의로 연결하지 말 것, 없으면 빈 배열)
- previousFindingId: 이전 회차 지적사항과 관련 있으면 그 no를 문자열로, 없으면 null
`;
}

function buildUserContent(payload) {
  const {
    rawTranscript = '',
    correctedTranscript = '',
    targetOrg = '',
    consultingDate = '',
    historyChecklist = [],
    bookmarks = [],
    photos = []
  } = payload || {};

  const parts = [];
  parts.push(`[업체명] ${targetOrg || '미지정'}`);
  parts.push(`[컨설팅 일자] ${consultingDate || '미지정'}`);

  if (Array.isArray(historyChecklist) && historyChecklist.length > 0) {
    parts.push(`[이전 회차 지적사항 이행 점검표]\n${JSON.stringify(historyChecklist, null, 2)}`);
  }

  if (Array.isArray(bookmarks) && bookmarks.length > 0) {
    parts.push(`[현장에서 컨설턴트가 표시한 중요/지적사항 북마크 - 이 시점 전후 내용을 우선 분석]\n${JSON.stringify(bookmarks, null, 2)}`);
  }

  if (Array.isArray(photos) && photos.length > 0) {
    parts.push(`[현장 사진 메타데이터 - 사진 내용을 추측하지 말고 시간 연관성만 참고]\n${JSON.stringify(photos, null, 2)}`);
  }

  parts.push(`[STT 원본 텍스트]\n${rawTranscript}`);

  if (correctedTranscript && correctedTranscript !== rawTranscript) {
    parts.push(`[로컬 1차 용어보정 텍스트 - 참고용]\n${correctedTranscript}`);
  }

  return parts.join('\n\n');
}

const REQUIREMENT_TYPE_ENUM = ['LEGAL', 'CERTIFICATION', 'RECOMMENDATION', 'VERIFY'];
const HISTORY_STATUS_ENUM = ['완료', '보완중', '미이행', '확인 필요'];
const EVIDENCE_TYPE_ENUM = ['interview_statement', 'objective_evidence', 'unclear'];
const RISK_LEVEL_ENUM = ['LOW', 'MEDIUM', 'HIGH'];

const ANALYSIS_JSON_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['purpose', 'tableData', 'summary', 'nextPlan', 'briefing', 'findings', 'historyChecklist'],
  properties: {
    purpose: { type: 'string' },
    tableData: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['area', 'check', 'action', 'requirementType'],
        properties: {
          area: { type: 'string' },
          check: { type: 'string' },
          action: { type: 'string' },
          requirementType: { type: 'string', enum: REQUIREMENT_TYPE_ENUM }
        }
      }
    },
    summary: { type: 'string' },
    nextPlan: { type: 'string' },
    briefing: {
      type: 'object',
      additionalProperties: false,
      required: ['keywords', 'summaryLines'],
      properties: {
        keywords: { type: 'array', items: { type: 'string' } },
        summaryLines: { type: 'array', items: { type: 'string' } }
      }
    },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'id', 'area', 'category', 'finding', 'evidence', 'evidenceType',
          'sourceTimestamp', 'riskLevel', 'requirementType', 'recommendation',
          'verificationNeeded', 'linkedPhotoIds', 'previousFindingId'
        ],
        properties: {
          id: { type: 'string' },
          area: { type: 'string' },
          category: { type: 'string' },
          finding: { type: 'string' },
          evidence: { type: 'string' },
          evidenceType: { type: 'string', enum: EVIDENCE_TYPE_ENUM },
          sourceTimestamp: { type: ['string', 'null'] },
          riskLevel: { type: 'string', enum: RISK_LEVEL_ENUM },
          requirementType: { type: 'string', enum: REQUIREMENT_TYPE_ENUM },
          recommendation: { type: 'string' },
          verificationNeeded: { type: 'string' },
          linkedPhotoIds: { type: 'array', items: { type: 'string' } },
          previousFindingId: { type: ['string', 'null'] }
        }
      }
    },
    historyChecklist: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['no', 'status', 'notes'],
        properties: {
          no: { type: 'integer' },
          status: { type: 'string', enum: HISTORY_STATUS_ENUM },
          notes: { type: 'string' }
        }
      }
    }
  }
};

module.exports = {
  HACCP_TERMS,
  buildSystemPrompt,
  buildUserContent,
  ANALYSIS_JSON_SCHEMA
};
