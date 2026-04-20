/** K-Startup(k-startup.go.kr) API 응답 타입
 *  엔드포인트: apis.data.go.kr/B552735/kisedKstartupService01/getAnnouncementInformation01
 */

export interface KstartupApiItem {
  /** 공고 일련번호 */
  pbanc_sn: number;
  /** 공고명 */
  biz_pbanc_nm: string;
  /** 통합 공고명 */
  intg_pbanc_biz_nm?: string;
  /** 주관기관명 */
  pbanc_ntrp_nm: string;
  /** 담당부서 */
  biz_prch_dprt_nm?: string;
  /** 연락처 */
  prch_cnpl_no?: string;
  /** 감독기관 (공공기관/민간/지자체) */
  sprv_inst?: string;
  /** 지원사업 분류 (사업화/창업교육/글로벌/멘토링 등) */
  supt_biz_clsfc?: string;
  /** 지원지역 */
  supt_regin?: string;
  /** 신청대상 */
  aply_trgt?: string;
  /** 신청대상 상세 */
  aply_trgt_ctnt?: string;
  /** 신청 제외대상 */
  aply_excl_trgt_ctnt?: string;
  /** 업력 (예비창업자,1년미만,...) */
  biz_enyy?: string;
  /** 대상연령 */
  biz_trgt_age?: string;
  /** 모집 진행 여부 */
  rcrt_prgs_yn?: string;
  /** 통합공고 여부 */
  intg_pbanc_yn?: string;
  /** 접수 시작일 (YYYYMMDD) */
  pbanc_rcpt_bgng_dt: string;
  /** 접수 종료일 (YYYYMMDD) */
  pbanc_rcpt_end_dt: string;
  /** 공고 내용 */
  pbanc_ctnt?: string;
  /** 온라인 접수 URL */
  aply_mthd_onli_rcpt_istc?: string;
  /** 방문 접수 장소 */
  aply_mthd_vst_rcpt_istc?: string;
  /** 사업 안내 URL */
  biz_gdnc_url?: string;
  /** 상세 페이지 URL */
  detl_pg_url: string;
  /** 지원사업 신청 URL */
  biz_aply_url?: string;
  /** 우선순위 심사 요소 */
  prfn_matr?: string | null;
}

export interface KstartupApiResponse {
  currentCount: number;
  matchCount: number;
  page: number;
  perPage: number;
  totalCount: number;
  data: KstartupApiItem[];
}

export interface KstartupFetchParams {
  serviceKey: string;
  /** 지원사업 분류 필터 (사업화/창업교육/글로벌/멘토링ㆍ컨설팅ㆍ교육/판로ㆍ해외진출/시설ㆍ공간ㆍ보육/행사ㆍ네트워크) */
  supt_biz_clsfc?: string;
  /** 지원지역 */
  supt_regin?: string;
  /** 모집중만 조회 (Y) */
  rcrt_prgs_yn?: "Y" | "N";
  pageNo?: number;
  numOfRows?: number;
}

export interface KstartupFetchResult {
  ok: boolean;
  httpStatus: number;
  items: KstartupApiItem[];
  totalCount: number;
  bodySnippet: string;
}
