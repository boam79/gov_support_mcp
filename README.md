# gov-support-mcp

**정부지원사업 통합 MCP 서버** — PRD v1.3 (MCP-GOV-001)

Claude Desktop · Cursor 등 MCP 호환 클라이언트에서 **자연어 하나**로  
정부지원사업 **탐색 → 자격 판정 → 신청 준비 → 수혜 관리** 전 단계를 자동화합니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [구현된 Tool 전체 목록](#2-구현된-tool-전체-목록)
3. [사용 시나리오](#3-사용-시나리오)
4. [아키텍처](#4-아키텍처)
5. [필요 API 및 키 신청](#5-필요-api-및-키-신청)
6. [설치 및 빌드](#6-설치-및-빌드)
7. [Cursor에 MCP 등록](#7-cursor에-mcp-등록)
8. [Claude Desktop에 MCP 등록](#8-claude-desktop에-mcp-등록)
9. [개발 명령어](#9-개발-명령어)
10. [프로젝트 구조](#10-프로젝트-구조)
11. [개발 로드맵](#11-개발-로드맵)

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
| 서버 버전 | **v1.0.0** |
| 기술 스택 | TypeScript 5.x · `@modelcontextprotocol/sdk` · Node.js 20 LTS · pnpm |
| 주요 사용자 | 총무팀 · 경영지원팀 · 대표자 (중소기업 / 병원 / 스타트업) |
| 구현된 Tool | **12개 (PRD 전체 완성)** |

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
| `draftBusinessPlan` | 공고+회사 정보 기반 6섹션 사업계획서 구조 초안<br>평가 기준 힌트·미기입 항목 목록 포함 | ✅ |

### 관리 도구

| Tool | 설명 | 상태 |
|------|------|:----:|
| `manageAlertProfile` | 알림 프로파일 CRUD (키워드·분야·지역·대상 조건 저장)<br>`list / get / create / update / delete` | ✅ |
| `manageBenefitHistory` | 수혜 이력 CRUD + 지출 추가 + 마일스톤 기록<br>집행률·잔액 자동 계산 | ✅ |
| `draftSettlementReport` | 수혜 이력 기반 정산 보고서 초안<br>비목별 집행 현황·첨부 서류 목록 포함 | ✅ |

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

---

## 4. 아키텍처

```text
Claude Desktop / Cursor / MCP 클라이언트
          │
          │  MCP stdio
          ▼
┌──────────────────────────────────────────────────┐
│         gov-support-mcp (server.ts) v1.0.0       │
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
└──────────────────────────────────────────────────┘
          │
          ▼
외부 API: bizinfo ✅ · K-Startup ✅ · 중소벤처24 ✅ 키발급완료(서버IP 등록 후 완전 활성) · 벤처확인 🔲(추후)
영속 데이터: data/alertProfiles.json · benefitHistory.json · companyProfiles.json
```

---

## 5. 필요 API 및 키 신청

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

## 6. 설치 및 빌드

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

## 7. Cursor에 MCP 등록

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

## 8. Claude Desktop에 MCP 등록

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

## 9. 개발 명령어

```bash
pnpm install     # 의존성 설치
pnpm build       # TypeScript → dist/ 컴파일
pnpm test        # 단위 테스트 (vitest)
pnpm dev         # MCP 서버 실행 (stdio, 개발용)
pnpm gov:spike   # 3개 API 동시 스모크 테스트
```

---

## 10. 프로젝트 구조

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
│   │   │   └── draftTools.ts              # draftBusinessPlan · draftSettlementReport ✅
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

## 11. 개발 로드맵

| Phase | 주요 작업 | 상태 |
|-------|-----------|:----:|
| **1** | 프로젝트 세팅, Core 레이어, SMES24 클라이언트 | ✅ 완료 |
| **2** | 기업마당·K-Startup 클라이언트, 단일 소스 MCP Tool 3개 | ✅ 완료 |
| **3** | 통합 탐색(`searchGovernmentSupport`) + Jaccard dedup 엔진 | ✅ 완료 |
| **4** | 자격 판정(`checkEligibility`), 서류 체크리스트, 타임라인 | ✅ 완료 |
| **5** | 사업계획서·정산 보고서 초안, 알림·수혜 이력 관리, 지역 비교 | ✅ 완료 |
| **6** | 벤처기업확인서 API 연동, HTML 공고 상세 스크래핑 | 🔲 예정 |

---

## 라이선스

ISC

---

*PRD 문서 번호: MCP-GOV-001 v1.3 (2026-04-20)*
