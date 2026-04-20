/** 중소벤처24 extPblancInfo API 응답 타입 */

export interface Smes24ExtPblancInfoJson {
  resultCd: string;
  resultMsg?: string;
  data?: Smes24PblancItem[] | unknown;
}

export interface Smes24PblancItem {
  /** 공고 일련번호 */
  pblancSeq: number;
  /** 공고명 */
  pblancNm: string;
  /** 세부사업명 */
  detailBsnsNm?: string;
  /** 지원대상 */
  sportTrget?: string;
  /** 지원기관명 */
  sportInsttNm?: string;
  /** 지원기관코드 */
  sportInsttCd?: string;
  /** 주관기관명 */
  cntcInsttNm?: string;
  /** 사업유형 (수출/창업/기술 등) */
  bizType?: string;
  /** 지원유형 */
  sportType?: string;
  /** 지역명 */
  areaNm?: string;
  /** 공고 시작일 (YYYY-MM-DD) */
  pblancBgnDt: string;
  /** 공고 종료일 (YYYY-MM-DD) */
  pblancEndDt: string;
  /** 공고기간 텍스트 */
  pblancPdCnts?: string;
  /** 접수방법 */
  reqstRcept?: string;
  /** 담당자 */
  refrnc?: string;
  /** 담당부서 */
  refrncDept?: string;
  /** 담당전화 */
  refrncTel?: string;
  /** 정책내용 (HTML) */
  policyCnts?: string;
  /** 공고 상세 URL */
  pblancDtlUrl?: string;
  /** 첨부파일 URL */
  pblancAttach?: string;
  /** 첨부파일명 */
  pblancAttachNm?: string;
  /** 파일 다운로드 URL */
  pblancFileUrl?: string;
  /** 파일명 */
  pblancFileNm?: string;
  /** 신청 링크 */
  reqstLinkInfo?: string;
  /** 참고 URL */
  refrncUrl?: string;
  /** 생성일시 */
  creatDt?: string;
  /** 수정일시 */
  updDt?: string;
  /** 최소 지원금액 */
  minSportAmt?: string;
  /** 최대 지원금액 */
  maxSportAmt?: string;
  /** 기업규모 */
  cmpScale?: string;
  /** 최소 매출액 */
  minSalsAmt?: string;
  /** 최대 매출액 */
  maxSalsAmt?: string;
  /** 최소 종업원수 */
  minEmplyCnt?: string;
  /** 최대 종업원수 */
  maxEmplyCnt?: string;
  /** 업종 */
  induty?: string;
  /** 여성대표 여부 */
  fmleRpsntYn?: string;
}

export interface Smes24FetchParams {
  token: string;
  /** 조회 시작일 (YYYYMMDD) — 필수 */
  strDt: string;
  /** 조회 종료일 (YYYYMMDD) — 필수 */
  endDt: string;
  pageNo?: number;
  numOfRows?: number;
}

export interface Smes24FetchResult {
  ok: boolean;
  httpStatus: number;
  items: Smes24PblancItem[];
  totalCount: number;
  bodySnippet: string;
}
