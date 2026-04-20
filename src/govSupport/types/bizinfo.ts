/** 기업마당(bizinfo.go.kr) API 응답 타입 */

export interface BizinfoApiItem {
  /** 공고 ID */
  pblancId: string;
  /** 공고명 */
  pblancNm: string;
  /** 지원대상 */
  trgetNm: string;
  /** 주관기관 */
  jrsdInsttNm: string;
  /** 수행기관 */
  excInsttNm?: string;
  /** 지원분야 대분류 (인력/기술/금융/수출/내수/창업/경영/기타) */
  pldirSportRealmLclasCodeNm: string;
  /** 지원분야 중분류 */
  pldirSportRealmMlsfcCodeNm?: string;
  /** 신청기간 (예: "2026-04-10 ~ 2026-04-30") */
  reqstBeginEndDe: string;
  /** 접수방법 */
  reqstMthPapersCn?: string;
  /** 담당자 연락처 */
  refrncNm?: string;
  /** 온라인 접수 URL */
  rceptEngnHmpgUrl?: string;
  /** 공고 상세 URL */
  pblancUrl: string;
  /** 사업요약 (HTML 포함) */
  bsnsSumryCn?: string;
  /** 해시태그 */
  hashtags?: string;
  /** 생성일시 */
  creatPnttm: string;
  /** 수정일시 */
  updtPnttm: string;
  /** 조회수 */
  inqireCo?: number;
  /** 첨부파일명 (HWP) */
  fileNm?: string;
  /** 첨부파일명 (PDF) */
  printFileNm?: string;
  /** 썸네일 URL */
  printFlpthNm?: string;
  /** 첨부파일 다운로드 URL */
  flpthNm?: string;
  /** 전체 건수 */
  totCnt: number;
}

export interface BizinfoApiResponse {
  jsonArray?: BizinfoApiItem[];
}

export interface BizinfoFetchParams {
  apiKey: string;
  /** 분야 대분류 코드 (예: "창업", "기술", "인력") */
  field?: string;
  pageIndex?: number;
  pageUnit?: number;
}

export interface BizinfoFetchResult {
  ok: boolean;
  httpStatus: number;
  items: BizinfoApiItem[];
  totalCount: number;
  bodySnippet: string;
}
