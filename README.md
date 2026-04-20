# gov-support-mcp

**정부지원사업 통합 MCP 서버** — PRD v1.3 (MCP-GOV-001)

Claude Desktop · Cursor 등 MCP 호환 클라이언트에서 **자연어 하나**로  
정부지원사업 **탐색 → 자격 판정 → 신청 준비 → 수혜 관리** 전 단계를 자동화합니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [핵심 사용 시나리오](#2-핵심-사용-시나리오)
3. [아키텍처 및 Tool 구성](#3-아키텍처-및-tool-구성)
4. [필요 API 및 키 신청](#4-필요-api-및-키-신청)
5. [설치 및 빌드](#5-설치-및-빌드)
6. [Cursor에 MCP 등록](#6-cursor에-mcp-등록)
7. [Claude Desktop에 MCP 등록](#7-claude-desktop에-mcp-등록)
8. [개발 명령어](#8-개발-명령어)
9. [프로젝트 구조](#9-프로젝트-구조)
10. [개발 로드맵](#10-개발-로드맵)

---

## 1. 프로젝트 개요

### 배경 및 목적

정부지원사업은 연간 수천 건이 개별 부처·지자체·공공기관을 통해 **분산 공고**됩니다.  
중소기업·병원 총무팀이 이를 수작업으로 모니터링하고, 자격을 확인하며, 서류를 준비하는 데 많은 시간이 소요됩니다. 정보 누락으로 인한 수혜 미달 사례도 빈번합니다.

본 MCP 서버는 **기업마당(bizinfo) · K-Startup · 중소벤처24** 등 공개 API를 하나로 묶어, 자연어만으로 다음 흐름을 처리합니다.

- 우리 조직에 맞는 지원사업 탐색
- 자격조건 분석 및 검토 포인트 정리
- 필요 서류와 준비 일정 도출
- 기존 수혜 이력 및 의무 이행 관리

### 메타 정보

| 항목 | 내용 |
|------|------|
| 문서 번호 | MCP-GOV-001 v1.3 |
| 기술 스택 | TypeScript 5.x · `@modelcontextprotocol/sdk` · Node.js 20 LTS |
| 주요 사용자 | 총무팀 · 경영지원팀 · 대표자 (중소기업 / 병원 / 스타트업) |
| Tool 수 | 9개 (4개 모듈) |
| 예상 개발기간 | 5주 (MVP 3주 + 고도화 2주) |

### 핵심 가치

| 가치 | 설명 |
|------|------|
| 탐색 통합 | bizinfo · K-Startup · 중소벤처24 세 소스를 한 번에 조회·중복 제거 |
| 판정 보조 | 공고 원문과 회사 프로파일을 근거 문장 기반으로 대조, 신뢰도 점수 제공 |
| 준비 자동화 | 서류 목록·발급처·역산 일정을 자동 정리 |
| 관리 일원화 | 과거 수혜 이력·중복 제한·의무 이행을 한 곳에서 관리 |

---

## 2. 핵심 사용 시나리오

### 시나리오 1 — 인력 지원사업 탐색 (병원)

```text
사용자: "의료업 50인 병원인데 올해 신청 가능한 인력 지원사업 있어?"

MCP 처리:
  1. searchGovernmentSupport(industry: "의료업", size: 50, field: "인력")
  2. fetchAnnouncementDetail(선별 공고)
  3. checkEligibility(공고 원문 + companyProfile)
  4. generateDocumentChecklist(공고 원문 기준)
  5. buildApplicationTimeline(마감일 기준 역산)

Claude 응답:
  "총 7건 발견, 우선 검토 대상 3건입니다.
   그중 1건은 자격 충족 가능성이 높고, 2건은 별첨 기준 확인이 필요합니다.
   필요 서류와 준비 일정도 함께 정리했습니다."
```

### 시나리오 2 — 창업 지원사업 자격 판정 (스타트업)

```text
사용자: "작년에 창업한 IT 스타트업인데 K-Startup에서 뭐 신청할 수 있어?"

MCP 처리:
  1. searchGovernmentSupport(source: "kstartup", field: "창업", targetType: "초기창업")
  2. checkEligibility(각 공고 + companyProfile)

Claude 응답:
  "3건의 창업 지원사업을 찾았습니다.
   'OO 사업'은 likely_eligible(신뢰도 82%),
   'XX 사업'은 review_needed(별첨 자격 기준 수동 확인 필요)입니다."
```

### 시나리오 3 — 수혜 이력 관리 및 정산 초안 (중소기업)

```text
사용자: "작년에 받은 지원금 정산 보고서 초안 작성해줘"

MCP 처리:
  1. manageBenefitHistory(조회)
  2. draftSettlementReport(수혜 이력 + 증빙 항목 기반)

Claude 응답:
  "[초안] 정산 보고서를 작성했습니다.
   증빙이 불명확한 항목 2건은 warningMessages에 분리했습니다.
   최종 제출 전 담당자 검토가 필요합니다."
```

---

## 3. 아키텍처 및 Tool 구성

### 시스템 구조

```text
Claude Desktop / Cursor / MCP 클라이언트
          │
          │  MCP stdio
          ▼
┌─────────────────────────────────────────────┐
│          gov-support-mcp (server.ts)        │
│                                             │
│  ┌───────────────────────────────────────┐  │
│  │           공유 Core 레이어             │  │
│  │  profile · cache · dedup · detailStore│  │
│  └───────────────────────────────────────┘  │
│                                             │
│  모듈 1: 탐색 (Search)                       │
│  ├ searchGovernmentSupport()                 │
│  ├ fetchAnnouncementDetail()                 │
│  └ manageAlertProfile()                      │
│                                             │
│  모듈 2: 판정 (Eligibility)                  │
│  ├ checkEligibility()                        │
│  └ compareByRegion()                         │
│                                             │
│  모듈 3: 준비 (Preparation)                  │
│  ├ generateDocumentChecklist()               │
│  ├ buildApplicationTimeline()                │
│  └ draftBusinessPlan()                       │
│                                             │
│  모듈 4: 관리 (Management)                   │
│  ├ manageBenefitHistory()                    │
│  └ draftSettlementReport()                   │
└─────────────────────────────────────────────┘
          │
          ▼
외부 API (bizinfo · K-Startup · 중소벤처24 · 벤처확인)
```

### Tool 목록 (9개)

| 모듈 | Tool | 설명 | API 필요 |
|------|------|------|:--------:|
| 탐색 | `searchGovernmentSupport` | bizinfo · K-Startup · smes24 통합 조회 + 중복 제거 | ✅ |
| 탐색 | `fetchAnnouncementDetail` | 공고 상세 원문 수집 (HTML · 첨부파일 포함) | ✅ |
| 탐색 | `manageAlertProfile` | 관심 분야·지역·조건 저장 및 신규 공고 체크 | — |
| 판정 | `checkEligibility` | 공고 원문 ↔ 회사 프로파일 근거 기반 자격 판정 | — |
| 판정 | `compareByRegion` | 지역별 공고 수·자격 가능 건수 비교 | — |
| 준비 | `generateDocumentChecklist` | 서류 목록 + 발급처 + 근거 문장 | — |
| 준비 | `buildApplicationTimeline` | 마감일 기준 역산 일정 (공휴일 제외 등) | — |
| 준비 | `draftBusinessPlan` | 사업계획서 초안 (없는 사실 생성 금지) | — |
| 관리 | `manageBenefitHistory` | 수혜 이력 · 중복 제한 · 의무 이행 관리 | — |
| 관리 | `draftSettlementReport` | 정산 보고서 초안 (증빙 없는 추정 금지) | — |

---

## 4. 필요 API 및 키 신청

### API 목록 (4개)

| # | API명 | 제공기관 | 인증 방식 | 데이터포털 등록 |
|---|-------|---------|-----------|:---:|
| 1 | **기업마당 지원사업정보** | 중소벤처기업부 | bizinfo.go.kr 자체 키 | ❌ (파일형만) |
| 2 | **K-Startup 창업지원사업** | 창업진흥원 | `serviceKey` (data.go.kr) | [15125364](https://www.data.go.kr/data/15125364/openapi.do) |
| 3 | **중소벤처24 공고정보** | 중소기업기술정보진흥원 | `token` (smes.go.kr 별도) | [15113191](https://www.data.go.kr/data/15113191/openapi.do) |
| 4 | **벤처기업확인서** | 중소벤처기업부 | `serviceKey` (data.go.kr) ⚠️ 기업회원 전용 | [15106235](https://www.data.go.kr/data/15106235/openapi.do) |

### 키 신청 방법

#### ① 공공데이터포털 serviceKey (K-Startup · 벤처확인서 공통)
1. [data.go.kr](https://www.data.go.kr) 회원가입 및 로그인
2. 각 데이터셋 페이지(위 링크)에서 **활용신청** 클릭
3. 승인 후 **마이페이지 → 인증키** 에서 **Encoding** 키 복사

#### ② 중소벤처24 Open API 토큰 (공고정보)
1. [smes.go.kr → 소개 → Open API](https://www.smes.go.kr/main/dbCnrs) 접속
2. 신청 양식 작성 (기관명, 부서, 담당자 정보 필요)
3. 심사 완료 후 이메일로 토큰 수신
4. 문의: 중소벤처24 운영팀 **044-300-0990**

#### ③ 기업마당 지원사업정보 API
1. [bizinfo.go.kr → 활용정보 → 정책정보 개방 → API 신청](https://www.bizinfo.go.kr/web/lay1/program/S1T175C174/apiDetail.do?id=bizinfoApi) 접속
2. 별도 인증키 신청 (data.go.kr과 **다른 계정**)
3. 제공 필터: 분야(금융·기술·인력·수출·내수·창업·경영·기타), 기관, 마감일

### ⚠️ 벤처기업확인서 API 접근 제약

| 항목 | 내용 |
|------|------|
| 호출 가능 주체 | 중소벤처24(smes.go.kr) **기업회원**으로 등록된 법인·개인사업자 |
| 개인회원 | 호출 불가 |
| 비회원 | 호출 불가 |
| 기업회원 가입 | [smes.go.kr → 회원가입 → 기업회원](https://www.smes.go.kr) (사업자등록증 기반 인증 필요) |

> 기업회원이 아닌 경우, `checkEligibility()` 실행 시 벤처기업 확인 조건은 `review_needed` 상태로 반환되고 수동 검토 플래그가 설정됩니다.

### 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 발급받은 키를 입력합니다.

```env
# 공공데이터포털(data.go.kr) Encoding serviceKey — K-Startup · 벤처확인서에 사용
PUBLIC_DATA_SERVICE_KEY=여기에_포털_Encoding_키

# 중소벤처24 전용 토큰 — smes.go.kr 별도 신청
# 포털에서 복사한 Encoding 키(%2B, %2F 등)를 그대로 붙여 넣으세요 (코드에서 자동 처리).
SMES24_API_KEY=여기에_중소벤처24_토큰
```

> `.env` 파일은 `.gitignore`에 포함되어 있어 **절대 커밋되지 않습니다.**  
> 채팅·슬랙 등 외부 채널에 키 값을 공유하지 마세요.

---

## 5. 설치 및 빌드

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

## 6. Cursor에 MCP 등록

`~/.cursor/mcp.json` 파일에 아래 내용을 추가합니다.

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "node",
      "args": ["/Users/본인계정/Projects/gov_support_mcp/dist/server.js"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_포털_Encoding_키",
        "SMES24_API_KEY": "발급받은_중소벤처24_토큰"
      }
    }
  }
}
```

> `args` 경로는 실제 절대 경로로 변경해야 합니다.  
> 파일이 없으면 새로 만들고, Cursor를 **재시작**하면 AI 채팅에서 도구가 활성화됩니다.

**등록 확인:**  
Cursor 채팅에서 `@gov-support-mcp`를 입력하거나  
"중소기업 인력 지원사업 찾아줘"라고 물어보면 Tool이 동작합니다.

---

## 7. Claude Desktop에 MCP 등록

`~/Library/Application Support/Claude/claude_desktop_config.json` 파일에 추가합니다.

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "node",
      "args": ["/Users/본인계정/Projects/gov_support_mcp/dist/server.js"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_포털_Encoding_키",
        "SMES24_API_KEY": "발급받은_중소벤처24_토큰"
      }
    }
  }
}
```

> Claude Desktop을 **완전히 종료 후 재시작**해야 MCP가 로드됩니다.  
> 등록 확인: 채팅창 왼쪽 하단에 🔧 아이콘이 표시되면 연결 성공입니다.

### pnpm dev 모드로 연결하는 경우 (개발 중)

빌드 없이 tsx로 바로 실행하려면 `command`와 `args`를 아래처럼 변경합니다.

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "pnpm",
      "args": ["--dir", "/Users/본인계정/Projects/gov_support_mcp", "dev"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_포털_Encoding_키",
        "SMES24_API_KEY": "발급받은_중소벤처24_토큰"
      }
    }
  }
}
```

---

## 8. 개발 명령어

```bash
pnpm install     # 의존성 설치
pnpm test        # 단위 테스트 (vitest)
pnpm build       # TypeScript → dist/ 컴파일
pnpm dev         # MCP 서버 실행 (stdio, 개발용)
pnpm gov:spike   # 키·엔드포인트 스모크 테스트 (키 값 미출력)
```

---

## 9. 프로젝트 구조

```
gov_support_mcp/
├── src/
│   ├── server.ts                         # MCP 서버 진입점 · Tool 핸들러
│   ├── govSupport/
│   │   ├── env.ts                        # 환경변수 로더 (키 검증)
│   │   ├── smesQueryEncoding.ts          # 포털 Encoding 키 이중 인코딩 방지
│   │   ├── clients/
│   │   │   └── smes24PublicNotice.ts     # 중소벤처24 extPblancInfo 클라이언트
│   │   ├── core/
│   │   │   └── cache.ts                  # 인메모리 TTL 캐시 (PRD §7.2)
│   │   └── types/
│   │       ├── common.ts                 # 공통 타입 — Announcement, CompanyProfile 등
│   │       └── smes24.ts                 # SMES24 API 응답 타입
│   └── utils/
│       └── logger.ts                     # 구조화 로거
├── scripts/
│   └── gov-spike.ts                      # 로컬 스모크 스크립트
├── tests/
│   ├── smes24PublicNotice.test.ts        # extPblancInfo 클라이언트 테스트
│   └── smesQueryEncoding.test.ts         # 인코딩 유틸 테스트
├── .env.example                          # 환경변수 플레이스홀더 (키 값 없음)
├── .gitignore                            # .env, dist/, node_modules/ 제외
├── package.json
├── tsconfig.json
└── vitest.config.ts
```

---

## 10. 개발 로드맵

| Phase | 기간 | 주요 작업 | 산출물 |
|-------|------|-----------|--------|
| **1** ✅ | 1~2주 | 프로젝트 세팅, Core, SMES24 클라이언트, 목록 조회 | 탐색 기초 |
| **2** | 3주 | K-Startup · 기업마당 연동, dedup 엔진, 벤처확인 연동 | 3소스 통합 + 자격 보조 |
| **3** | 4주 | 상세 공고 처리 계층, 자격 판정 근거 구조, 서류 체크리스트 | 판정/준비 품질 강화 |
| **4** | 5주 | 생성형 초안 Tool 고도화, KPI 측정 | 완성판 |

---

## 라이선스

ISC

---

*PRD 문서 번호: MCP-GOV-001 v1.3 (2026-04-20)*
