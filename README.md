# gov-support-mcp

**정부지원사업 통합 MCP 서버** — PRD v1.3 기반

Claude Desktop / Cursor 등 MCP 호환 클라이언트에서 자연어 하나로  
**탐색 → 자격 판정 → 신청 준비 → 수혜 관리** 흐름을 지원합니다.

---

## 개요

| 항목 | 내용 |
|------|------|
| 기술 스택 | TypeScript 5.x · `@modelcontextprotocol/sdk` · Node.js 20 LTS |
| 패키지 매니저 | pnpm |
| 대상 사용자 | 중소기업·병원·스타트업 총무팀·경영지원팀 |
| Phase 1 Tool | `search_gov_support_smes24` (중소벤처24 공고 조회) |

---

## 환경변수 설정

```bash
cp .env.example .env
```

`.env` 를 열어 실제 키를 입력합니다.

```env
# 공공데이터포털(data.go.kr) Encoding serviceKey
PUBLIC_DATA_SERVICE_KEY=발급받은_키

# 중소벤처24 전용 API 토큰 (smes.go.kr 별도 신청)
# 포털에서 복사한 Encoding 키(%2B 등)를 그대로 붙여 넣으세요.
SMES24_API_KEY=발급받은_키
```

> `.env` 파일은 `.gitignore` 에 포함되어 있어 절대 커밋되지 않습니다.

---

## API 키 신청

| API | 신청처 |
|-----|--------|
| 공공데이터포털 serviceKey | [data.go.kr](https://www.data.go.kr) |
| 중소벤처24 Open API 토큰 | [smes.go.kr → 소개 → Open API](https://www.smes.go.kr/main/dbCnrs) · 문의: 044-300-0990 |
| 기업마당 지원사업 API | [bizinfo.go.kr → 정책정보 개방](https://www.bizinfo.go.kr/apiList.do) (별도 키) |

---

## 개발

```bash
pnpm install     # 의존성 설치
pnpm test        # 단위 테스트 (vitest)
pnpm build       # TypeScript 컴파일
pnpm dev         # MCP 서버 실행 (stdio)
pnpm gov:spike   # 키·엔드포인트 스모크 테스트 (키 값 미출력)
```

---

## Cursor에 MCP 등록

`~/.cursor/mcp.json` 에 추가합니다.

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "node",
      "args": ["/절대경로/gov_support_mcp/dist/server.js"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_키",
        "SMES24_API_KEY": "발급받은_키"
      }
    }
  }
}
```

---

## Claude Desktop에 MCP 등록

`~/Library/Application Support/Claude/claude_desktop_config.json` 에 추가합니다.

```json
{
  "mcpServers": {
    "gov-support-mcp": {
      "command": "node",
      "args": ["/절대경로/gov_support_mcp/dist/server.js"],
      "env": {
        "PUBLIC_DATA_SERVICE_KEY": "발급받은_키",
        "SMES24_API_KEY": "발급받은_키"
      }
    }
  }
}
```

---

## 프로젝트 구조

```
gov_support_mcp/
├── src/
│   ├── server.ts                        # MCP 서버 진입점
│   ├── govSupport/
│   │   ├── env.ts                       # 환경변수 로더
│   │   ├── smesQueryEncoding.ts         # SMES 포털 키 이중 인코딩 방지
│   │   ├── clients/
│   │   │   └── smes24PublicNotice.ts    # 중소벤처24 공고 API 클라이언트
│   │   ├── core/
│   │   │   └── cache.ts                 # 인메모리 캐시 (TTL)
│   │   └── types/
│   │       ├── common.ts                # 공통 타입 (PRD §8)
│   │       └── smes24.ts                # SMES API 응답 타입
│   └── utils/
│       └── logger.ts                    # 로거
├── scripts/
│   └── gov-spike.ts                     # 키·엔드포인트 스모크
├── tests/
│   ├── smes24PublicNotice.test.ts
│   └── smesQueryEncoding.test.ts
├── .env.example
└── .gitignore
```

---

## 로드맵 (PRD v1.3 §10)

| Phase | 내용 |
|-------|------|
| 1 ✅ | 프로젝트 세팅, Core, SMES24 클라이언트, 목록 조회 |
| 2 | K-Startup / 기업마당 연동, dedup 엔진, 벤처확인 |
| 3 | 상세 공고 처리, 자격 판정, 서류 체크리스트 |
| 4 | 생성형 초안 Tool, KPI 측정 |
