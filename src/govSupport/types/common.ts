/**
 * PRD v1.3 §8 공통 타입
 */

export type SupportField =
  | "창업"
  | "금융"
  | "기술"
  | "인력"
  | "수출"
  | "내수"
  | "경영"
  | "기타";

export type ApiSource = "bizinfo" | "kstartup" | "smes24";

export type TargetType =
  | "예비창업자"
  | "초기창업"
  | "중소기업"
  | "중견기업"
  | "소상공인";

/** 공고 목록 단건 */
export interface Announcement {
  announcementId: string;
  title: string;
  source: ApiSource;
  agency: string;
  field: SupportField;
  targetTypes: TargetType[];
  startDate?: string;
  deadline?: string;
  detailUrl?: string;
  status?: "접수중" | "접수예정" | "접수마감" | "unknown";
  dedupMeta?: DedupMeta;
}

/** 중복 제거 메타 (PRD §3.3) */
export interface DedupMeta {
  canonicalAnnouncementId: string;
  mergedSources: ApiSource[];
  dedupConfidence: number;
  dedupRule: "source-id" | "title+agency+deadline" | "fuzzy";
}

/** Tool 공통 응답 메타 (PRD §3.8) */
export interface ToolResponseMeta {
  generatedAt: string;
  sourceTimestamp?: string;
  cacheHit?: boolean;
  partialData?: boolean;
  warnings?: string[];
  errors?: {
    code: string;
    message: string;
    retryable: boolean;
  }[];
}

/** 생성형 Tool 보조 메타 (PRD §3.6) */
export interface DraftMeta {
  assumptions: string[];
  missingData: string[];
  confidence: number;
  humanReviewRequired: boolean;
}

/** 회사 프로파일 (PRD §3.4) */
export interface CompanyProfile {
  businessNumber: string;
  companyName: string;
  businessType: "법인" | "개인";
  industry: string;
  ksicCode: string;
  employeeCount: number;
  annualRevenue: number;
  foundedDate: string;
  regionHeadOffice?: string;
  regionWorksite?: string;
  companySizeClass?: string;
  certifications: string[];
  hasLab?: boolean;
  supportHistorySummary?: string[];
  isSmes24Member: boolean;
  // 병원 특화
  medicalInstitutionType?: string;
  bedCount?: number;
  isNonProfit?: boolean;
  updatedAt: string;
}
