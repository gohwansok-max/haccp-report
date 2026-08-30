/**
 * haccp-dictionary.js
 *
 * 식품안전/HACCP/FSSC22000/ISO22000 전문용어 사전.
 * 목적: 음성인식(STT)이 흔히 잘못 옮기는 전문용어를 "결정적(deterministic) 치환"으로만 바로잡는다.
 *
 * 이 파일은 의미를 바꾸지 않는다 - 정규식으로 명백한 오인식(발음이 비슷한 일반 단어 ↔ 전문용어)만 고친다.
 * AI(백엔드)에게도 동일한 원칙을 지시하지만("원문 의미를 변경하지 말 것"),
 * 이 파일의 correctHaccpTerminology()는 네트워크 없이 브라우저에서 즉시 실행되는 로컬 안전장치다.
 *
 * 향후 새 용어는 TERMS 배열에 추가하기만 하면 된다.
 */
(function (global) {
  'use strict';

  // 정식 용어 목록 (지식 참조용 - AI 프롬프트, 자동완성 등에 재사용 가능)
  const TERMS = [
    'HACCP', 'CCP', 'CP', 'OPRP', 'PRP',
    'FSSC 22000', 'ISO 22000', 'GMP', 'SSOP', 'TACCP', 'VACCP',
    'Food Defense', 'Food Fraud',
    '선행요건', '중요관리점', '한계기준', '모니터링', '유효성평가',
    '검증', '검교정', '시정조치', '개선조치', '재발방지',
    '이탈', '부적합', '원인분석', '교차오염', '세척', '소독',
    '알레르겐', '금속검출기', 'X-ray', '이력추적', '회수', 'Recall',
    '환경모니터링', 'ATP', '미생물', '일반세균', '대장균군', '대장균',
    '살모넬라', '리스테리아'
  ];

  // STT 오인식 → 정식 용어 치환 규칙. 각 pattern은 "단어 경계" 기준으로만 치환한다(부분 문자열 오염 방지).
  // regex는 매번 새로 생성해 lastIndex 문제를 피한다(함수로 정의).
  const RULES = [
    { term: 'HACCP', patterns: [/해썹/g, /핫셉/g, /하셉/g, /에이치에이씨씨피/gi] },
    { term: 'CCP', patterns: [/씨씨피/g] },
    { term: 'CP', patterns: [/씨피(?!\s?피)/g] },
    { term: 'OPRP', patterns: [/오피알피/g, /오프알피/g] },
    { term: 'PRP', patterns: [/피알피/g] },
    { term: 'FSSC 22000', patterns: [/FSSC\s*2\s*2\s*0\s*0\s*0/gi, /에프에스에스씨\s*22000/g, /핏식\s*22000/g] },
    { term: 'ISO 22000', patterns: [/ISO\s*2\s*2\s*0\s*0\s*0/gi, /아이에스오\s*22000/g] },
    { term: 'GMP', patterns: [/지엠피/g] },
    { term: 'SSOP', patterns: [/에스에스오피/g] },
    { term: 'TACCP', patterns: [/티에이씨씨피/g, /태썹/g] },
    { term: 'VACCP', patterns: [/브이에이씨씨피/g, /배썹/g] },
    { term: '선행요건', patterns: [/선행요건(?:프로그램)?/g, /선행 요건/g] },
    { term: '중요관리점', patterns: [/중요 관리점/g, /중요관리 점/g] },
    { term: '한계기준', patterns: [/한계 기준/g, /한게기준/g] },
    { term: '모니터링', patterns: [/모니터 링/g, /모니터닝/g] },
    { term: '유효성평가', patterns: [/유효성 평가/g] },
    { term: '검교정', patterns: [/검 교정/g, /검꾜정/g] },
    { term: '시정조치', patterns: [/시정 조치/g] },
    { term: '개선조치', patterns: [/개선 조치/g] },
    { term: '재발방지', patterns: [/재발 방지/g] },
    { term: '교차오염', patterns: [/교차 오염/g] },
    { term: '알레르겐', patterns: [/알러젠/g, /알레르젠/g, /알러르겐/g] },
    { term: '금속검출기', patterns: [/금속 검출기/g, /금속탐지기/g] },
    { term: 'X-ray', patterns: [/엑스레이/g, /엑스 레이/g] },
    { term: '이력추적', patterns: [/이력 추적/g, /이력추적성/g] },
    { term: 'ATP', patterns: [/에이티피/g] },
    { term: '대장균군', patterns: [/대장균 군/g] },
    { term: '살모넬라', patterns: [/살모넬레/g, /살모넬나/g] },
    { term: '리스테리아', patterns: [/리스테이리아/g, /리스테아리아/g] }
  ];

  /**
   * transcript에 규칙 기반 용어 보정을 적용한다.
   * @param {string} text
   * @returns {{ correctedText: string, changes: Array<{term:string, count:number}> }}
   */
  function correctHaccpTerminology(text) {
    if (typeof text !== 'string' || !text) {
      return { correctedText: text || '', changes: [] };
    }
    let corrected = text;
    const changes = [];

    RULES.forEach(({ term, patterns }) => {
      let count = 0;
      patterns.forEach((pattern) => {
        const matches = corrected.match(pattern);
        if (matches) count += matches.length;
        corrected = corrected.replace(pattern, term);
      });
      if (count > 0) changes.push({ term, count });
    });

    return { correctedText: corrected, changes };
  }

  global.HaccpDictionary = {
    TERMS,
    correctHaccpTerminology
  };

  // index.html에서 window 전역으로도 바로 사용할 수 있도록 단축 함수 노출
  global.correctHaccpTerminology = correctHaccpTerminology;
})(typeof window !== 'undefined' ? window : globalThis);
