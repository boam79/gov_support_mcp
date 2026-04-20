# gov-support-mcp

**정부지원사업 통합 MCP 서버** — PRD v1.3 (MCP-GOV-001)

Claude Desktop · Cursor 등 MCP 호환 클라이언트에서 **자연어 하나**로  
정부지원사업 **탐색 → 자격 판정 → 신청 준비 → 수혜 관리** 전 단계를 자동화합니다.

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [현재 구현된 Tool](#2-현재-구현된-tool)
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

- 우리 조직에 맞는 지원사업 탐색
- 자격조건 분석 및 검토 포인트 정리
- 필요 서류와 준비 일정 도출
- 기존 수혜 이력 및 의무 이행 관리

### 메타 정보

| 항목 | 내용 |
|------|------|
| 문서 번호 | MCP-GOV-001 v1.3 |
| 서버 버전 | v0.3.0 |
| 기술 스택 | TypeScript 5.x · `@modelcontextprotocol/sdk` · Node.js 20 LTS |
| 주요 사용자 | 총무팀 · 경영지원팀 · 대표자 (중소기업 / 병원 / 스타트업) |
| 구현된 Tool | 3개 (Phase 1~2) |
| 목표 Tool | 9개 (PRD 전체 완성 기준) |

---

## 2. 현재 구현된 Tool

> Phase 1~2 완료 기준입니다. 미구현 Tool은 [개발 로드맵](#11-개발-로드맵)을 참고하세요.

| Tool 이름 | 설명 | 데이터 건수 | 상태 |
|-----------|------|:-----------:|:----:|
| `search_gov_support_bizinfo` | 기업마당(bizinfo.go.kr) 지원사업 공고 조회<br>분야별 필터: 창업·금융·기술·인력·수출·내수·경영·기타 | **1,223건+** | ✅ 정상 |
| `search_gov_support_kstartup` | K-Startup 창업지원사업 공고 조회<br>분류·지역·모집중 여부 필터 | **28,302건+** | ✅ 정상 |
| `search_gov_support_smes24` | 중소벤처24 공고정보 조회 | — | ⚠️ IP 허용 필요 |

### ⚠️ 중소벤처24(SMES24) IP 제한 안내

smes.go.kr Open API는 **사전 등록된 IP에서만 호출 가능**합니다.  
로컬 환경에서는 타임아웃이 발생하며, 아래 절차로 해결합니다.

1. 중소벤처24 운영팀 **044-300-0990** 에 서버 IP 허용 요청
2. 서버 배포 후 고정 IP를 등록하면 정상 작동합니다

---

## 3. 사용 시나리오

아래 문장을 Claude Desktop 또는 Cursor 채팅에 그대로 입력하면 Tool이 자동 호출됩니다.

### 시나리오 1 — 병원 총무팀: 인력·경영 지원사업 종합 탐색

```text
우리 병원 상황을 알려줄게.
- 서울 소재 내과·외과 2차 병원, 병상 150개, 의료인력 80명
- 법인병원, 설립 12년차
- 올해 신규 간호사 10명 채용 계획 있음
- 작년에 중소기업 일자리 안정자금 받은 적 있음

기업마당이랑 K-Startup 둘 다 뒤져서 인력·경영 분야 지원사업을
중복 없이 마감 임박한 것부터 정리해줘.
우리 병원이 자격될 것 같은지 각 공고마다 간단히 판단해줘.
```

### 시나리오 2 — 스타트업: 글로벌·사업화 공고 필터링

```text
2023년 창업한 AI 헬스케어 스타트업이야.
직원 12명, 서울, 작년 매출 3억, 시드 투자 완료.
아직 정부 지원사업 받은 적 없음.

1. K-Startup에서 글로벌·사업화 분류 각 10건씩 뽑아줘
2. 기업마당에서 창업·기술 분야도 같이 조회해줘
3. 창업 7년 이내 기업 대상인 것만 추려줘
4. 신청 마감 2주 이내인 것 있으면 최우선 표시해줘
5. 각 공고마다 준비해야 할 서류 예상 목록도 달아줘
```

### 시나리오 3 — 중소기업 경영지원팀: 분기별 지원사업 캘린더

```text
경기도 안산 금속 가공 제조업, 직원 45명, 연매출 80억.
수출 비율 30%(일본·동남아), 연구전담부서·ISO9001 보유.

1. 기업마당에서 기술·수출·경영 분야 각 5건씩 조회
2. K-Startup에서 판로·해외진출, 멘토링 분야 조회
3. 마감일 기준 타임라인으로 정리하고
4. 같은 기관 공고끼리 묶어서 중복 신청 제한 확인용으로 표시해줘
5. 각 공고 담당자 연락처도 같이 표시해줘
```

### 시나리오 4 — 예비창업자: 업종별 최적 지원사업 매칭

```text
퇴직하고 친환경 소재 B2B 스타트업 준비 중. 아직 법인 미설립.
서울 거주, 40대 중반, 특허 1건 보유, 초기 자금 5천만원.

1. K-Startup에서 예비창업자 대상 공고 전체 조회
2. 기업마당 창업 분야 최신 20건 조회
3. 지원금 형태(보조금/융자/공간/교육)별로 분류해줘
4. 법인 설립 전 신청 가능한 것만 따로 묶어줘
5. 특허 보유자 우대 조건 있는 공고 표시해줘
```

### 시나리오 5 — 임원 보고용 요약 자료

```text
IT 서비스업, 서울, 직원 200명, 코스닥 상장사.
이번 달 마감 공고를 기업마당 + K-Startup에서 전체 조회해서

| 공고명 | 지원기관 | 지원금액 | 마감일 | 자격요건 핵심 | 담당부서 추천 |

형식으로 표 만들어줘.
"상장사 제외" 또는 "중소기업만" 조건 있는 것 걸러내고
지원금액 큰 순서로 정렬 후 신청 권장 TOP 3 요약해줘.
```

---

## 4. 아키텍처

```text
Claude Desktop / Cursor / MCP 클라이언트
          │
          │  MCP stdio
          ▼
┌─────────────────────────────────────────────┐
│          gov-support-mcp (server.ts)        │
│                          v0.3.0             │
│  ┌───────────────────────────────────────┐  │
│  │           공유 Core 레이어             │  │
│  │      cache · smesQueryEncoding        │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ✅ 모듈 1: 탐색 (구현 완료)                  │
│  ├ search_gov_support_bizinfo               │
│  ├ search_gov_support_kstartup              │
│  └ search_gov_support_smes24  ⚠️ IP 필요    │
│                                             │
│  🔲 모듈 2: 판정 (미구현)                    │
│  ├ checkEligibility                         │
│  └ compareByRegion                          │
│                                             │
│  🔲 모듈 3: 준비 (미구현)                    │
│  ├ generateDocumentChecklist                │
│  ├ buildApplicationTimeline                 │
│  └ draftBusinessPlan                        │
│                                             │
│  🔲 모듈 4: 관리 (미구현)                    │
│  ├ manageBenefitHistory                     │
│  └ draftSettlementReport                    │
└─────────────────────────────────────────────┘
          │
          ▼
외부 API: bizinfo ✅ · K-Startup ✅ · 중소벤처24 ⚠️ · 벤처확인 🔲
```

---

## 5. 필요 API 및 키 신청

### API 목록

| # | API명 | 제공기관 | 인증 방식 | 상태 |
|---|-------|---------|-----------|:----:|
| 1 | **기업마당 지원사업정보** | 중소벤처기업부 | `BIZINFO_API_KEY` (bizinfo.go.kr 자체 키) | ✅ |
| 2 | **K-Startup 창업지원사업** | 창업진흥원 | `PUBLIC_DATA_SERVICE_KEY` (data.go.kr) [15125364](https://www.data.go.kr/data/15125364/openapi.do) | ✅ |
| 3 | **중소벤처24 공고정보** | 중소기업기술정보진흥원 | `SMES24_API_KEY` (smes.go.kr 별도) [15113191](https://www.data.go.kr/data/15113191/openapi.do) | ⚠️ IP |
| 4 | **벤처기업확인서** | 중소벤처기업부 | `PUBLIC_DATA_SERVICE_KEY` ⚠️ **기업회원 전용** [15106235](https://www.data.go.kr/data/15106235/openapi.do) | 🔲 미구현 |

### 키 신청 방법

#### ① 공공데이터포털 serviceKey — K-Startup · 벤처확인서 공통
1. [data.go.kr](https://www.data.go.kr) 회원가입 및 로그인
2. 각 데이터셋 페이지에서 **활용신청** 클릭
3. 승인 후 **마이페이지 → 인증키 → Encoding 키** 복사

#### ② 중소벤처24 Open API 토큰
1. [smes.go.kr → 소개 → Open API](https://www.smes.go.kr/main/dbCnrs) 접속
2. 신청 양식 작성 (기관명, 부서, 담당자, **서버 IP** 정보 필요)
3. 심사 완료 후 이메일로 토큰 수신
4. 문의: **044-300-0990**

#### ③ 기업마당 지원사업정보 API
1. [bizinfo.go.kr → 정책정보 개방 → API 신청](https://www.bizinfo.go.kr/web/lay1/program/S1T175C174/apiDetail.do?id=bizinfoApi) 접속
2. 별도 인증키 신청 (data.go.kr 키와 **다름**)

### ⚠️ 벤처기업확인서 API 제약

| 항목 | 내용 |
|------|------|
| 호출 가능 주체 | 중소벤처24(smes.go.kr) **기업회원** 법인·개인사업자 |
| 개인회원·비회원 | 호출 불가 |
| 기업회원 가입 | [smes.go.kr → 회원가입 → 기업회원](https://www.smes.go.kr) (사업자등록증 인증) |

### 환경변수 설정

```bash
cp .env.example .env
```

`.env` 파일에 발급받은 키를 입력합니다.

```env
# 공공데이터포털(data.go.kr) Encoding serviceKey — K-Startup에 사용
PUBLIC_DATA_SERVICE_KEY=여기에_포털_Encoding_키

# 중소벤처24 전용 토큰 — smes.go.kr 별도 신청 · 서버 IP 허용 필요
# Encoding 키(%2B, %2F 등)를 그대로 붙여 넣으세요 (코드에서 자동 처리).
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

**등록 확인:** 채팅에서 "기업마당에서 인력 지원사업 찾아줘"라고 입력하면 Tool이 동작합니다.

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
pnpm test        # 단위 테스트 (vitest)
pnpm build       # TypeScript → dist/ 컴파일
pnpm dev         # MCP 서버 실행 (stdio, 개발용)
pnpm gov:spike   # 3개 API 동시 스모크 테스트 (키 값 미출력)
```

---

## 10. 프로젝트 구조

```
gov_support_mcp/
├── src/
│   ├── server.ts                          # MCP 서버 진입점 · Tool 핸들러 (v0.3.0)
│   ├── govSupport/
│   │   ├── env.ts                         # 환경변수 로더 (3개 키 검증)
│   │   ├── smesQueryEncoding.ts           # Encoding 키 이중 인코딩 방지 유틸
│   │   ├── clients/
│   │   │   ├── bizinfoSupport.ts          # 기업마당 API 클라이언트 ✅
│   │   │   ├── kstartupSupport.ts         # K-Startup API 클라이언트 ✅
│   │   │   └── smes24PublicNotice.ts      # 중소벤처24 API 클라이언트 ⚠️
│   │   ├── core/
│   │   │   └── cache.ts                   # 인메모리 TTL 캐시 (PRD §7.2)
│   │   └── types/
│   │       ├── bizinfo.ts                 # 기업마당 API 응답 타입
│   │       ├── kstartup.ts                # K-Startup API 응답 타입
│   │       ├── common.ts                  # 공통 타입 (Announcement, CompanyProfile 등)
│   │       └── smes24.ts                  # 중소벤처24 API 응답 타입
│   └── utils/
│       └── logger.ts                      # 구조화 로거
├── scripts/
│   └── gov-spike.ts                       # 3개 API 스모크 테스트 스크립트
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

| Phase | 기간 | 주요 작업 | 상태 |
|-------|------|-----------|:----:|
| **1** | 1~2주 | 프로젝트 세팅, Core, SMES24 클라이언트 | ✅ 완료 |
| **2** | 3주 | 기업마당·K-Startup 클라이언트, 3소스 MCP Tool | ✅ 완료 |
| **3** | 4주 | 통합 탐색(`searchGovernmentSupport`) + dedup 엔진, 벤처확인 연동 | 🔲 예정 |
| **4** | 5주 | 상세 공고 처리, 자격 판정(`checkEligibility`), 서류 체크리스트 | 🔲 예정 |
| **5** | 6주 | 생성형 초안 Tool(`draftBusinessPlan` 등), KPI 측정 | 🔲 예정 |

---

## 라이선스

ISC

---

*PRD 문서 번호: MCP-GOV-001 v1.3 (2026-04-20)*
