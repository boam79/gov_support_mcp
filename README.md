# gov-support-mcp

**정부지원사업 통합 MCP 서버** — PRD v1.3 (MCP-GOV-001)

Claude Desktop · Cursor 등 MCP 호환 클라이언트에서 **자연어 하나**로  
정부지원사업 **탐색 → 자격 판정 → 신청 준비 → 수혜 관리** 전 단계를 자동화합니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [구현된 Tool 전체 목록](#2-구현된-tool-전체-목록)
3. [사용 시나리오](#3-사용-시나리오)
4. [draftBusinessPlan 템플릿 상세](#4-draftbusinessplan-템플릿-상세)
5. [evaluateStartupApplication 평가 기준 상세](#5-evaluatestartupapplication-평가-기준-상세)
6. [아키텍처](#6-아키텍처)
7. [필요 API 및 키 신청](#7-필요-api-및-키-신청)
8. [설치 및 빌드](#8-설치-및-빌드)
9. [Cursor에 MCP 등록](#9-cursor에-mcp-등록)
10. [Claude Desktop에 MCP 등록](#10-claude-desktop에-mcp-등록)
11. [개발 명령어](#11-개발-명령어)
12. [프로젝트 구조](#12-프로젝트-구조)
13. [버전 히스토리](#13-버전-히스토리)
14. [개발 로드맵](#14-개발-로드맵)

---

## 1. 프로젝트 개요

### 배경 및 목적

정부지원사업은 연간 수천 건이 개별 부처·지자체·공공기관을 통해 **분산 공고**됩니다.  
중소기업·병원 총무팀이 이를 수작업으로 모니터링하고, 자격을 확인하며, 서류를 준비하는 데 많은 시간이 소요됩니다.

본 MCP 서버는 **기업마당(bizinfo) · K-Startup · 중소벤처24** 공개 API를 하나로 묶어, 자연어만으로 다음 흐름을 처리합니다.

- 우리 조직에 맞는 지원사업 통합 탐색 (중복 자동 제거)
- 자격조건 분석 및 검토 포인트 정리
- 필요 서류·준비 일정·사업계획서 초안 자동 생성
- 기존 수혜 이력, 지출 내역, 정산 보고서 관리

### 메타 정보

| 항목 | 내용 |
|------|------|
| 문서 번호 | MCP-GOV-001 v1.3 |
| 서버 버전 | **v1.1.0** |
| 기술 스택 | TypeScript 5.x · `@modelcontextprotocol/sdk` · Node.js 20 LTS · pnpm |
| 주요 사용자 | 총무팀 · 경영지원팀 · 대표자 (중소기업 / 병원 / 스타트업 / 예비창업자) |
| 구현된 Tool | **13개 (PRD + 심사 지원 확장)** |

---

## 2. 구현된 Tool 전체 목록

### 통합 탐색 / 분석

| Tool | 설명 | 상태 |
|------|------|:----:|
| `searchGovernmentSupport` | 기업마당·K-Startup·중소벤처24 **병렬 통합 검색 + Jaccard dedup**<br>키워드·분야·지역·소스 필터 지원 | ✅ |
| `compareByRegion` | 최대 8개 지역의 공고 수·분야 분포 비교표 반환 | ✅ |
| `checkEligibility` | 공고 텍스트 + 회사 프로파일 기반 자격 판정<br>`likely_eligible / review_needed / likely_ineligible` + 조건별 충족 여부 | ✅ |

### 신청 준비 도구

| Tool | 설명 | 상태 |
|------|------|:----:|
| `generateDocumentChecklist` | 공고 텍스트에서 서류 추출 + 표준 서류 DB(15종) 매칭<br>발급기관·소요일수·수집 기한 포함 | ✅ |
| `buildApplicationTimeline` | 마감일 역산 9단계 타임라인<br>서류수집 → 계획서 → 내부검토 → 제출 → 심사결과 → 협약 | ✅ |
| `draftBusinessPlan` | 공고+회사 정보 기반 사업계획서 구조 초안<br>**`template: "gov"`** 정부보조금 6섹션 공문서 형식 (기본값)<br>**`template: "psst"`** Problem·Solution·Scale-up·Team 창업패키지·VC 심사용 | ✅ |

### 관리 도구

| Tool | 설명 | 상태 |
|------|------|:----:|
| `manageAlertProfile` | 알림 프로파일 CRUD (키워드·분야·지역·대상 조건 저장)<br>`list / get / create / update / delete` | ✅ |
| `manageBenefitHistory` | 수혜 이력 CRUD + 지출 추가 + 마일스톤 기록<br>집행률·잔액 자동 계산 | ✅ |
| `draftSettlementReport` | 수혜 이력 기반 정산 보고서 초안<br>비목별 집행 현황·첨부 서류 목록 포함 | ✅ |

### 심사 지원 도구

| Tool | 설명 | 상태 |
|------|------|:----:|
| `evaluateStartupApplication` | **예비창업패키지 등 심사 점수 예측**<br>①기술성·혁신성(20점) ②사업성(30점) ③시장성(25점) ④창업자·팀(25점) + 가점(5점)<br>축별 점수·등급·강점·개선 권고 + 제출 전 체크리스트 반환 | ✅ |

### 단일 소스 조회 (개별 API 직접 호출)

| Tool | 데이터 | 상태 |
|------|--------|:----:|
| `search_gov_support_bizinfo` | 기업마당(bizinfo.go.kr) — 1,285건+ | ✅ |
| `search_gov_support_kstartup` | K-Startup(k-startup.go.kr) — 28,302건+ | ✅ |
| `search_gov_support_smes24` | 중소벤처24(smes.go.kr) | ✅ 키 발급 완료 · ⚠️ 서버 IP 등록 필요 |

> **ℹ️ 중소벤처24 IP 허용 안내**  
> API 키 발급은 완료된 상태입니다.  
> smes.go.kr Open API는 **사전 등록된 서버 IP에서만 응답**하므로 로컬(개발 PC) 환경에서는 타임아웃이 발생합니다.  
> 서버(AWS · Render 등) 배포 후 고정 IP를 중소벤처24 운영팀(**044-300-0990**)에 등록하면 정상 작동합니다.

---

## 3. 사용 시나리오

아래 문장을 Claude Desktop 또는 Cursor 채팅에 그대로 입력하면 Tool이 자동 호출됩니다.

### 시나리오 1 — 통합 탐색 + 자격 판정 (병원 총무팀)

```text
우리 병원 정보야.
- 서울 소재 내과·외과 2차 병원, 병상 150개, 의료인력 80명
- 법인병원, 설립 12년차, 연매출 120억
- 올해 신규 간호사 10명 채용 계획

1. searchGovernmentSupport로 인력·경영 분야 중복 없이 통합 조회해줘
2. 각 공고마다 우리 병원이 자격되는지 checkEligibility로 판정해줘
3. 자격 될 것 같은 것 중 마감 임박한 TOP 3 추려줘
4. TOP 3 각각 서류 체크리스트랑 타임라인도 뽑아줘
```

### 시나리오 2 — 지역별 비교 + 알림 설정 (스타트업)

```text
AI 헬스케어 스타트업, 2023년 창업, 직원 12명, 서울, 매출 3억.

1. compareByRegion으로 서울·경기·전국 창업 지원사업 현황 비교해줘
2. 서울이 더 많으면 서울 기준 창업 분야 공고 상위 10개 보여줘
3. 이 조건(창업·기술 분야, AI 키워드, 서울·전국)으로 알림 프로파일 저장해줘
4. 가장 유망한 공고 1개 사업계획서 초안도 잡아줘
   (제품: AI 기반 원격 의료 상담 플랫폼, 목표 시장: 중소병원)
```

### 시나리오 3 — 전체 신청 프로세스 자동화 (중소기업)

```text
경기도 안산 금속 가공 제조업, 직원 45명, 연매출 80억.
수출 30%(일본·동남아), 연구전담부서·ISO9001 보유.
사업자번호: 123-45-67890

1. 수출·기술 분야 통합 검색해서 지원금 클 것 같은 공고 5개 찾아줘
2. 각 공고 자격 체크하고 신청 가능한 것만 남겨줘
3. 가장 좋은 공고 1개 골라서:
   - 서류 체크리스트 뽑아줘 (마감일 20260530)
   - 역산 타임라인 만들어줘
   - 사업계획서 초안 잡아줘
4. 이 회사 프로파일을 저장해둬
```

### 시나리오 4 — 수혜 이력 관리 + 정산 보고서 (지원사업 수혜 기업)

```text
스마트팩토리 사업을 선정받았어.
- 공고: 2026년 중소기업 스마트제조 혁신 지원사업
- 기관: 중소벤처기업부
- 승인금액: 5000만원, 사업 기간: 2026-03-01 ~ 2026-12-31

1. 수혜 이력 등록해줘 (사업자번호: 123-45-67890, 회사명: 안산정밀제조)
2. 지출 내역 추가해줘:
   - 인건비 1,200만원 (2026-04-30, 김OO 외 2명 인건비)
   - 장비구매 800만원 (2026-04-15, 비전검사 카메라 구매)
3. 현재 집행률이랑 잔액 확인해줘
4. 상반기 정산 보고서 초안 만들어줘 (2026-03-01 ~ 2026-06-30)
```

### 시나리오 5 — 예비창업자 지원사업 매칭 + 일정 계획

```text
퇴직 후 친환경 소재 B2B 스타트업 준비 중. 법인 미설립, 특허 1건 보유.
서울 거주, 40대 중반, 초기 자금 5천만원.

1. K-Startup 예비창업자 대상 공고 + 기업마당 창업 분야 통합 조회해줘
2. 법인 설립 전 신청 가능 공고, 특허 우대 공고 각각 표시해줘
3. 지원금 형태(보조금/융자/공간/교육)별로 분류해줘
4. 관심 공고 중 마감 가장 빠른 것 골라서 타임라인 짜줘
5. 이 조건으로 정기 알림 프로파일 저장해줘
```

### 시나리오 6 — 임원 보고용 요약 + 지역 비교

```text
IT 서비스업, 서울, 직원 200명, 코스닥 상장.

1. 이번 달 마감 공고 통합 조회해서 아래 형식 표로 정리해줘:
   | 공고명 | 지원기관 | 지원금액 | 마감일 | 자격요건 핵심 | 권장 여부 |
2. "상장사 제외" 또는 "중소기업만" 조건 공고 제외해줘
3. 서울·경기·전국 공고 현황 지역 비교도 추가해줘
4. 신청 권장 TOP 3 요약 + 각각 서류 체크리스트 첨부해줘
```

### 시나리오 7 — 예비창업패키지 사업계획서 점수 예측 + 개선 (예비창업자)

```text
예비창업패키지 신청 준비 중이야. 점수 예측해줘.

기술:
- AI 기반 탄소 발자국 자동 측정 SaaS (제조업 설비 IoT 연동)
- 국내 특허 1건 출원 중
- 파일럿 3개사 테스트 완료, 만족도 4.2/5

사업:
- 월 30만원 구독형, 첫해 20개사 목표 → 2년 100개사 → 3년 300개사
- 지원 신청액: 5000만원 (인건비 3000만원 / 개발외주 1500만원 / 마케팅 500만원)
- 월별 로드맵: 1~2월 MVP고도화, 3~4월 영업·파일럿 10개사, 5~6월 온보딩 자동화

시장:
- TAM: 탄소측정 솔루션 국내 시장 2조원 (한국환경산업기술원 2025)
- SAM: 중소 제조업체 ESG 의무 대상 3만개사 × 300만원 = 약 9000억원
- SOM: 1년 내 서울·경기 집중 공략 100개사 = 3억원

팀:
- 창업자: 삼성SDS IoT 플랫폼 개발 10년 (과장 퇴직)
- 공동창업자: ESG 컨설팅 7년 경력 (전 딜로이트)
- 자문: 환경공학 교수 1명

사회적 가치: 중소 제조업 탄소중립 지원, 정부 2030 탄소감축 목표 기여

1. evaluateStartupApplication으로 점수 예측해줘
2. 취약 축 개선 방안 2가지씩 알려줘
3. 개선 후 PSST 형식 사업계획서 초안도 만들어줘
```

---

## 4. draftBusinessPlan 템플릿 상세

`draftBusinessPlan` 도구는 `template` 파라미터로 두 가지 형식을 지원합니다.

### `template: "gov"` — 정부보조금 신청용 (기본값)

정부 지원사업 공모 신청서에 최적화된 **6섹션 공문서 구조**입니다.

| 섹션 | 내용 |
|------|------|
| 1. 신청 기업 개요 | 회사명·업종·임직원·설립일·매출 (입력 정보 자동 기입) |
| 2. 사업 목적 및 필요성 | 문제점 + 공고 목적 연계성 |
| 3. 기술 및 사업화 방안 | 솔루션·시장·사업화 전략 |
| 4. 추진 일정 및 마일스톤 | 기간별 활동·산출물 표 |
| 5. 사업비 집행 계획 | 비목별 금액 표 (합계 자동 입력) |
| 6. 기대 성과 및 파급 효과 | 정량 KPI + 사회적 효과 |

### `template: "psst"` — 창업패키지·액셀러레이터·VC 심사용

**PSST = Problem · Solution · Scale-up · Team** 프레임워크입니다.  
예비창업패키지·초기창업패키지·민간 액셀러레이터·VC 투자 심사에서 표준으로 쓰이는 형식입니다.

| 축 | 섹션 | 주요 내용 |
|----|------|----------|
| **P** | Problem — 문제 정의 | 핵심 Pain Point · 기존 대안 한계 · TAM/SAM/SOM |
| **S** | Solution — 해결책 | 솔루션 작동 원리 · 차별화(Unfair Advantage) · 고객 검증 현황 |
| **S** | Scale-up — 성장 전략 | 수익 모델 · 연도별 성장 로드맵 · GTM 전략 |
| **T** | Team — 팀 | 창업자·핵심팀 경력 · 팀 강점 · 채용 계획 |

**PSST 전용 추가 입력 파라미터:**

```text
companyProfile.scaleUpStrategy  — 성장·확장 전략
companyProfile.teamBackground   — 창업자·팀 경력 요약
companyProfile.competitors      — 주요 경쟁사 목록
companyProfile.revenueModel     — 수익 모델 (구독/수수료 등)
companyProfile.marketSize       — 시장 규모 (TAM/SAM/SOM)
```

**사용 예시:**

```text
예비창업패키지 신청을 위한 PSST 형식 사업계획서 초안 만들어줘.
template은 psst로 설정해줘.

회사 정보:
- 서비스명: AI 기반 탄소 발자국 측정 SaaS
- 문제: 중소 제조업체의 탄소 배출량 측정이 너무 어렵고 비용이 높음
- 솔루션: 설비 데이터 연동으로 자동 측정, 월 30만원 구독
- 타겟: 국내 중소 제조업체 5만개사 (TAM 2조원)
- 팀: 전 삼성SDS IoT·AI 개발 10년
- 신청금액: 5,000만원
```

---

## 5. evaluateStartupApplication 평가 기준 상세

`evaluateStartupApplication` 도구는 **실제 예비창업패키지 심사 기준**(창업진흥원 2026 공고 기준)을 반영한 루브릭으로 점수를 산출합니다.

> ⚠️ 배점은 주관기관(창업보육센터·대학·연구원 등)마다 ±5점 내외 차이가 있습니다. 결과는 참고용이며, 최종 판단은 심사위원의 종합 평가로 결정됩니다.

### 5대 평가 축 + 가점

| 축 | 배점 | 주요 평가 항목 |
|----|:----:|---------------|
| ① 기술성·혁신성 | **20점** | 기술 원리 명확성(6점) · 차별화(7점) · 특허·IP(4점) · 고객 검증(3점) |
| ② 사업성 | **30점** | 수익 모델(8점) · 3개년 매출 계획(8점) · 월별 사업화 일정(7점) · 지원금 집행 계획(7점) |
| ③ 시장성 | **25점** | TAM·SAM·SOM(9점) · 데이터 출처 신뢰도(7점) · 경쟁 분석(5점) · GTM 전략(4점) |
| ④ 창업자·팀 역량 | **25점** | 도메인 경력 연수(10점) · 경력-사업 연관성(8점) · 팀 구성 완성도(7점) |
| (+) 정책부합성·사회적 가치 | **가점 최대 5점** | 사회적 가치(2점) · 정책 방향 연계(2점) · 고용 창출(1점) |

**총 100점 + 가점 5점**

### 도구 출력 구조

```json
{
  "summary": {
    "baseScore": 82,
    "bonusScore": 3,
    "totalScore": 85,
    "grade": "A",
    "label": "우수",
    "prediction": "서류 합격 가능성 높음",
    "scoreBar": "▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░ 85점"
  },
  "axisResults": [
    {
      "axis": "② 사업성",
      "maxScore": 30,
      "score": 24,
      "grade": "B",
      "strengths": ["수익 모델이 구체적으로 정의됨"],
      "improvements": ["3개년 매출 계획을 고객 수 × 단가 공식으로 보수적으로 산출하세요."]
    }
  ],
  "topPriorityImprovements": ["[② 사업성] 3개년 매출 계획 보완 ..."],
  "finalChecklist": [
    { "item": "3개년 매출 계획 수치 포함 여부", "required": true, "done": true }
  ]
}
```

### 3단계 심사 프로세스 (예비창업패키지 기준)

```
1단계 서류 평가 (온라인 제출)
   → 사업계획서 PDF + 첨부서류 검토
   → 평가 기준: ①②③④ 4개 축 100점 + 가점
   → 통과 기준: 보통 상위 20~30% (주관기관별 상이)

2단계 사전 창업교육 (온라인 과정)
   → 창업 기초 교육 이수 (온라인, 약 3~5시간)
   → 별도 배점 없음 (이수 여부만 확인)

3단계 발표 심사 (대면/비대면)
   → 7~10분 발표 + 5~10분 질의응답
   → 서류 평가 점수와 합산하여 최종 선발
```

---

## 6. 아키텍처

```text
Claude Desktop / Cursor / MCP 클라이언트
          │
          │  MCP stdio
          ▼
┌──────────────────────────────────────────────────┐
│         gov-support-mcp (server.ts) v1.1.0       │
│                                                  │
│  Core 레이어                                      │
│  ├ core/dedup.ts    — Jaccard 중복 제거 엔진       │
│  ├ core/store.ts    — JSON 파일 영속성 저장소       │
│  ├ core/cache.ts    — 인메모리 TTL 캐시            │
│  └ smesQueryEncoding.ts — 이중 인코딩 방지 유틸    │
│                                                  │
│  ✅ 모듈 1: 통합 탐색                              │
│  ├ searchGovernmentSupport (3소스 통합 + dedup)   │
│  ├ compareByRegion                               │
│  ├ search_gov_support_bizinfo                    │
│  ├ search_gov_support_kstartup                   │
│  └ search_gov_support_smes24  ✅ 키발급(서버IP등록後) │
│                                                  │
│  ✅ 모듈 2: 판정                                  │
│  └ checkEligibility                              │
│                                                  │
│  ✅ 모듈 3: 준비                                  │
│  ├ generateDocumentChecklist                     │
│  ├ buildApplicationTimeline                      │
│  └ draftBusinessPlan                             │
│                                                  │
│  ✅ 모듈 4: 관리                                  │
│  ├ manageAlertProfile                            │
│  ├ manageBenefitHistory                          │
│  └ draftSettlementReport                         │
│                                                  │
│  ✅ 모듈 5: 심사 지원                             │
│  └ evaluateStartupApplication (5대 평가축 루브릭) │
└──────────────────────────────────────────────────┘
          │
          ▼
외부 API: bizinfo ✅ · K-Startup ✅ · 중소벤처24 ✅ 키발급완료(서버IP 등록 후 완전 활성) · 벤처확인 🔲(추후)
영속 데이터: data/alertProfiles.json · benefitHistory.json · companyProfiles.json
```

---

## 7. 필요 API 및 키 신청

### API 목록

| # | API명 | 제공기관 | 환경변수 | 상태 |
|---|-------|---------|---------|:----:|
| 1 | **기업마당 지원사업정보** | 중소벤처기업부 | `BIZINFO_API_KEY` | ✅ 정상 |
| 2 | **K-Startup 창업지원사업** | 창업진흥원 | `PUBLIC_DATA_SERVICE_KEY` | ✅ 정상 |
| 3 | **중소벤처24 공고정보** | 중기기술정보진흥원 | `SMES24_API_KEY` | ✅ 키 발급 완료 · ⚠️ 서버 IP 등록 후 사용 |
| 4 | **벤처기업확인서** | 중소벤처기업부 | `PUBLIC_DATA_SERVICE_KEY` | 🔲 추후 구현 |

### 키 신청 방법

#### ① 공공데이터포털 serviceKey — K-Startup · 벤처확인서 공통
1. [data.go.kr](https://www.data.go.kr) 회원가입 및 로그인
2. 각 데이터셋 페이지에서 **활용신청** 클릭  
   - K-Startup: [15125364](https://www.data.go.kr/data/15125364/openapi.do)
3. 승인 후 **마이페이지 → 인증키 → Encoding 키** 복사

#### ② 중소벤처24 Open API 토큰
1. [smes.go.kr → Open API](https://www.smes.go.kr/main/dbCnrs) 접속
2. 신청 양식 작성 (기관명·부서·담당자·**서버 IP** 정보 필요)
3. 심사 완료 후 이메일로 토큰 수신
4. 문의: **044-300-0990**

#### ③ 기업마당 API
1. [bizinfo.go.kr API 신청](https://www.bizinfo.go.kr/web/lay1/program/S1T175C174/apiDetail.do?id=bizinfoApi) 접속
2. 별도 인증키 신청 (data.go.kr 키와 **다름**)

### 환경변수 설정

```bash
cp .env.example .env
# .env 파일에 발급받은 키 입력
```

```env
# 공공데이터포털(data.go.kr) Encoding serviceKey — K-Startup에 사용
PUBLIC_DATA_SERVICE_KEY=여기에_포털_Encoding_키

# 중소벤처24 전용 토큰 — smes.go.kr 별도 신청 · 서버 IP 허용 필요
# Encoding 키(%2B, %2F 등)를 그대로 붙여 넣으세요 (코드에서 자동 처리)
SMES24_API_KEY=여기에_중소벤처24_토큰

# 기업마당(bizinfo.go.kr) API 인증키 — bizinfo.go.kr 자체 포털에서 신청
BIZINFO_API_KEY=여기에_bizinfo_키
```

> `.env` 파일은 `.gitignore`에 포함되어 있어 **절대 커밋되지 않습니다.**

---

## 8. 설치 및 빌드

Node.js 20 LTS 이상, pnpm이 필요합니다.

```bash
# 저장소 클론
git clone https://github.com/boam79/gov_support_mcp.git
cd gov_support_mcp

# 의존성 설치
pnpm install

# 환경변수 설정
cp .env.example .env
# .env 파일에 API 키 입력

# TypeScript 빌드
pnpm build
```

---

## 9. Cursor에 MCP 등록

`~/.cursor/mcp.json` 파일에 아래 내용을 추가합니다.

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "node",
      "args": ["/절대경로/gov_support_mcp/dist/server.js"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_포털_Encoding_키",
        "SMES24_API_KEY": "발급받은_중소벤처24_토큰",
        "BIZINFO_API_KEY": "발급받은_bizinfo_키"
      }
    }
  }
}
```

> `args` 경로는 실제 절대 경로로 변경해야 합니다.  
> 파일이 없으면 새로 만들고, Cursor를 **완전히 종료 후 재시작**하면 도구가 활성화됩니다.

**등록 확인:** 채팅에서 `"기업마당이랑 K-Startup 창업 분야 통합으로 찾아줘"` 라고 입력하면 Tool이 동작합니다.

---

## 10. Claude Desktop에 MCP 등록

`~/Library/Application Support/Claude/claude_desktop_config.json` 파일에 추가합니다.

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "node",
      "args": ["/절대경로/gov_support_mcp/dist/server.js"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_포털_Encoding_키",
        "SMES24_API_KEY": "발급받은_중소벤처24_토큰",
        "BIZINFO_API_KEY": "발급받은_bizinfo_키"
      }
    }
  }
}
```

> Claude Desktop을 **완전히 종료(Cmd+Q) 후 재시작**해야 MCP가 로드됩니다.  
> 등록 확인: 채팅창 왼쪽 하단 🔧 아이콘이 표시되면 연결 성공입니다.

### 개발 중 pnpm dev 모드로 연결

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "pnpm",
      "args": ["--dir", "/절대경로/gov_support_mcp", "dev"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_포털_Encoding_키",
        "SMES24_API_KEY": "발급받은_중소벤처24_토큰",
        "BIZINFO_API_KEY": "발급받은_bizinfo_키"
      }
    }
  }
}
```

---

## 11. 개발 명령어

```bash
pnpm install     # 의존성 설치
pnpm build       # TypeScript → dist/ 컴파일
pnpm test        # 단위 테스트 (vitest)
pnpm dev         # MCP 서버 실행 (stdio, 개발용)
pnpm gov:spike   # 3개 API 동시 스모크 테스트
```

---

## 12. 프로젝트 구조

```
gov_support_mcp/
├── src/
│   ├── server.ts                          # MCP 서버 진입점 · 12개 Tool 핸들러 (v1.0.0)
│   ├── govSupport/
│   │   ├── env.ts                         # 환경변수 로더 (3개 키 검증)
│   │   ├── smesQueryEncoding.ts           # Encoding 키 이중 인코딩 방지 유틸
│   │   ├── clients/
│   │   │   ├── bizinfoSupport.ts          # 기업마당 API 클라이언트 ✅
│   │   │   ├── kstartupSupport.ts         # K-Startup API 클라이언트 ✅
│   │   │   └── smes24PublicNotice.ts      # 중소벤처24 API 클라이언트 ⚠️
│   │   ├── core/
│   │   │   ├── cache.ts                   # 인메모리 TTL 캐시
│   │   │   ├── dedup.ts                   # Jaccard 기반 중복 제거 엔진 ✅
│   │   │   └── store.ts                   # JSON 파일 영속성 저장소 ✅
│   │   ├── tools/
│   │   │   ├── unifiedSearch.ts           # searchGovernmentSupport 구현 ✅
│   │   │   ├── compareByRegion.ts         # compareByRegion 구현 ✅
│   │   │   ├── eligibility.ts             # checkEligibility 구현 ✅
│   │   │   ├── documentChecklist.ts       # generateDocumentChecklist 구현 ✅
│   │   │   ├── timeline.ts                # buildApplicationTimeline 구현 ✅
│   │   │   ├── alertProfile.ts            # manageAlertProfile 구현 ✅
│   │   │   ├── benefitHistory.ts          # manageBenefitHistory 구현 ✅
│   │   │   ├── draftTools.ts              # draftBusinessPlan · draftSettlementReport ✅
│   │   │   └── evaluateStartup.ts         # evaluateStartupApplication (5대 평가축 루브릭) ✅
│   │   └── types/
│   │       ├── bizinfo.ts                 # 기업마당 API 응답 타입
│   │       ├── kstartup.ts                # K-Startup API 응답 타입
│   │       ├── smes24.ts                  # 중소벤처24 API 응답 타입
│   │       └── common.ts                  # 공통 타입 (Announcement, CompanyProfile 등)
│   └── utils/
│       └── logger.ts                      # 구조화 로거
├── data/                                  # 영속 데이터 디렉터리 (gitignore)
│   ├── alertProfiles.json                 # 알림 프로파일 저장소
│   ├── benefitHistory.json                # 수혜 이력 저장소
│   └── companyProfiles.json               # 회사 프로파일 저장소
├── scripts/
│   ├── gov-spike.ts                       # 3개 API 스모크 테스트
│   └── probe-smes-paths.ts                # SMES24 엔드포인트 탐색 스크립트
├── tests/
│   ├── smes24PublicNotice.test.ts
│   └── smesQueryEncoding.test.ts
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 13. 버전 히스토리

### v1.1.0 — 2026-04-21

**`draftBusinessPlan` PSST 템플릿 추가**

- `template` 파라미터 신규 지원
  - `"gov"` (기본값) — 정부보조금 신청용 6섹션 공문서 형식 (기존 유지)
  - `"psst"` — Problem · Solution · Scale-up · Team 창업패키지·VC 심사용 형식
- PSST 전용 입력 필드 추가: `scaleUpStrategy`, `teamBackground`, `competitors`, `revenueModel`, `marketSize`
- PSST 4축 12소섹션 구성 (핵심 Pain Point / 기존 대안 한계 / TAM·SAM·SOM / 솔루션 작동 원리 / Unfair Advantage / 고객 검증 / 수익 모델 / 성장 로드맵 / GTM 전략 / 팀 구성 / 팀 강점 / 채용 계획)

---

### v1.1.0 — 2026-04-20

**예비창업패키지 심사 점수 예측 도구 추가 — 12개 → 13개**

신규 도구:

| 도구 | 내용 |
|------|------|
| `evaluateStartupApplication` | 5대 평가축 루브릭 기반 심사 점수 예측<br>①기술성·혁신성(20) ②사업성(30) ③시장성(25) ④창업자·팀(25) + 가점(5)<br>축별 점수·등급·강점·개선 권고 + 제출 전 체크리스트 반환 |

기타:
- 서버 버전 `v1.0.0` → `v1.1.0`
- 아키텍처 다이어그램 모듈 5(심사 지원) 추가
- `README.md` 섹션 5 신규 추가: 평가 기준 상세 + 3단계 심사 프로세스 설명
- 사용 시나리오 7 추가: 심사 점수 예측 + 개선 + PSST 계획서 연계 흐름

---

### v1.0.0 — 2026-04-20

**PRD v1.3 Phase 3~5 전체 도구 구현 — 3개 → 12개**

신규 도구 9개:

| 도구 | 내용 |
|------|------|
| `searchGovernmentSupport` | bizinfo·K-Startup·SMES24 병렬 통합 검색 + Jaccard dedup |
| `compareByRegion` | 최대 8개 지역 공고 수·분야 분포 비교 |
| `checkEligibility` | 공고 텍스트 키워드 매칭 자격 판정 + 회사 프로파일 저장 |
| `generateDocumentChecklist` | 표준 서류 DB(15종) + 공고 텍스트 추출, 발급기관·소요일수 포함 |
| `buildApplicationTimeline` | 마감일 역산 9단계 타임라인 |
| `manageAlertProfile` | 알림 프로파일 CRUD (JSON 파일 영속성) |
| `manageBenefitHistory` | 수혜 이력 CRUD + 지출 추가 + 마일스톤 기록 |
| `draftBusinessPlan` | 공고+회사 정보 기반 6섹션 사업계획서 구조 초안 |
| `draftSettlementReport` | 수혜 이력 기반 정산 보고서 초안 |

신규 코어 모듈:
- `core/dedup.ts` — source-id → title+agency exact → Jaccard fuzzy(≥0.75) 3단계 중복 제거
- `core/store.ts` — JSON 파일 기반 알림프로파일·수혜이력·회사프로파일 저장소

---

### v0.3.0 — 2026-04-20

**K-Startup API 클라이언트 추가 + SMES24 날짜 파라미터 수정**

- `search_gov_support_kstartup` Tool 추가 (K-Startup 창업지원사업 조회)
- K-Startup API Encoding 키 이중 인코딩 문제 수정 (`normalizeSmesPortalToken` 적용)
- SMES24 `extPblancInfo` API에 `strDt`·`endDt` 필수 파라미터 추가 (운영팀 안내 기준)
- SMES24 미입력 시 자동으로 오늘 기준 30일 전~오늘 기본값 적용

---

### v0.2.0 — 2026-04-20

**기업마당(bizinfo) API 클라이언트 추가**

- `search_gov_support_bizinfo` Tool 추가 (기업마당 지원사업 공고 조회)
- `BIZINFO_API_KEY` 환경변수 지원 (`bizinfo.go.kr` 자체 발급 키)
- 분야 필터 클라이언트 사이드 처리 (서버 사이드 미지원 확인)
- bizinfo API 응답 타입 정의 (`types/bizinfo.ts`)

---

### v0.1.0 — 2026-04-20

**독립 프로젝트 초기 구현 (PRD v1.3 Phase 1)**

- `public-data-api-finder` 에서 분리된 독립 프로젝트로 시작
- `search_gov_support_smes24` Tool 구현 (중소벤처24 공고정보 API)
- Encoding 키 이중 인코딩 방지 유틸 (`smesQueryEncoding.ts`)
- 인메모리 TTL 캐시 (`core/cache.ts`)
- MCP stdio 서버 기본 구조 (`server.ts`)
- 프로젝트 기본 구성: TypeScript 5.x · `@modelcontextprotocol/sdk` · Node.js 20 LTS · pnpm · Vitest

---

## 14. 개발 로드맵

| Phase | 주요 작업 | 상태 |
|-------|-----------|:----:|
| **1** | 프로젝트 세팅, Core 레이어, SMES24 클라이언트 | ✅ 완료 |
| **2** | 기업마당·K-Startup 클라이언트, 단일 소스 MCP Tool 3개 | ✅ 완료 |
| **3** | 통합 탐색(`searchGovernmentSupport`) + Jaccard dedup 엔진 | ✅ 완료 |
| **4** | 자격 판정(`checkEligibility`), 서류 체크리스트, 타임라인 | ✅ 완료 |
| **5** | 사업계획서·정산 보고서 초안, 알림·수혜 이력 관리, 지역 비교 | ✅ 완료 |
| **5.5** | 예비창업패키지 심사 점수 예측 (`evaluateStartupApplication`) | ✅ 완료 |
| **6** | 벤처기업확인서 API 연동, HTML 공고 상세 스크래핑 | 🔲 예정 |

---

## 라이선스

ISC

---

*PRD 문서 번호: MCP-GOV-001 v1.3 (2026-04-20)*
