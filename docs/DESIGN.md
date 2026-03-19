# claude-maestro: Multi-Model Agent Orchestration

## Overview

**claude-maestro**는 Claude Code를 메인 에이전트(Lead)로 두고, Codex CLI와 Gemini CLI를 보조 에이전트로 활용하는 멀티모델 오케스트레이션 프레임워크이다. Claude Code의 subagent 시스템과 외부 CLI 에이전트를 라운드 기반으로 협업시켜, 각 모델의 고유한 능력과 관점을 결합한다.

**핵심 원칙:** Claude Code가 이미 Claude이므로 별도 Claude Adapter가 필요 없다. Claude Code 자체가 오케스트레이터이자 최종 합성기이다.

---

## Architecture

```
사용자
  │
  ▼
Claude Code (Lead / Maestro)
  │  - 프리셋 or 자체 판단으로 에이전트 구성 결정
  │  - 모든 agent spawn
  │  - 매 라운드 요약 수신 → 방향 조정
  │  - 최종 합성 (규칙 기반 우선) → 사용자 전달
  │  - plan.md에 전체 히스토리 기록
  │
  └── Concertmaster (전용 agent — 라운드 관리자)
        │  - 라운드 기획 / 실행 / 종료
        │  - 에이전트별로 관련 결과만 선별하여 컨텍스트 전달
        │  - 결과 수집 + 피드백 조합
        │  - 라운드 요약 파일 저장 (.claude-maestro/rounds/)
        │  - Lead에게 라운드 요약 보고 → 지시 대기
        │
        ├── Claude subagent들 (역할별, 동적 spawn)
        │     예: architect, tester, reviewer 등
        │
        ├── codex-soloist (전용 agent — Codex 통역사)
        │     - Codex CLI 호출 + 결과 해석 + 요약
        │     - 실패 시 프롬프트 수정 후 재시도
        │     - 재시도 실패 시 → Claude subagent로 즉시 대행
        │
        └── gemini-soloist (전용 agent — Gemini 통역사)
              - Gemini CLI 호출 + 결과 해석 + 요약
              - 동일한 통역사 프로토콜
```

### 통신 구조

```
내부 (Claude Code 생태계):
  Lead ←→ Concertmaster ←→ Claude subagents    : SendMessage (실시간)
  Lead ←→ Concertmaster ←→ Soloist들            : SendMessage (실시간)

외부 (CLI 호출):
  codex-soloist → Codex CLI                      : stdin/stdout 파이프
  gemini-soloist → Gemini CLI                    : stdin/stdout 파이프
```

**Codex/Gemini CLI는 SendMessage를 사용할 수 없다.** Soloist가 중간에서 통역사 역할을 하여 이 간극을 메운다.

---

## Agent Definitions

### Lead (Claude Code 세션 자체)

역할:
- 사용자 요청을 받아 에이전트 구성 결정 (프리셋 or 자체 판단)
- 모든 agent를 spawn하고 Concertmaster에게 이름 목록 전달
- 매 라운드 요약을 수신하여 방향 조정 ("계속" / "방향 수정" / "종료")
- 최종 결과를 규칙 기반으로 합성하여 사용자에게 전달
- plan.md에 전체 히스토리 기록 (컨텍스트 유실 대비)

### Concertmaster (agents/concertmaster.md)

역할:
- Lead로부터 에이전트 이름 목록과 작업 지시를 수신
- 각 라운드에서 에이전트들에게 작업 지시 (SendMessage)
- **관련 에이전트의 결과만 선별하여 전달** (전체 나열 아님)
- 결과 수집, 피드백 조합, 라운드 요약 파일 저장
- Lead에게 라운드 요약 보고 후 다음 지시 대기

라운드 생명주기:
```
준비 → 지시 → 대기 → 수집 → 조합 → 파일저장 → Lead 보고 → 다음 라운드 or 종료
```

라운드 종료 조건:
- 에이전트별 타임아웃 (120초)
- 타임아웃 초과 시 해당 에이전트 결과 없이 라운드 진행
- "codex-soloist 타임아웃. 이번 라운드에서 제외" 명시

피드백 조합 방식:
- **관련 에이전트 결과만 선별 전달**
- Concertmaster가 "누구의 결과가 누구에게 필요한지" 판단
- 예: Codex에게 보낼 때 → architect 설계 + Gemini 리뷰만 포함

### Soloist — codex-soloist / gemini-soloist

역할: **통역사** — 단순 중계가 아니라, CLI 출력을 해석/요약/검증하고 필요 시 재시도한다.

프로토콜:
```
1. 수신: Concertmaster로부터 SendMessage (자유 형식 텍스트)

2. 프롬프트 변환 (기본 규칙 + 상황별 자유 판단):
   - Concertmaster 메시지를 해당 CLI에 맞는 프롬프트로 변환
   - 필요한 파일 컨텍스트 포함 여부 판단
   - 파일이 필요하면 Read로 읽어서 프롬프트에 포함

3. CLI 호출:
   - Bash("node helpers/codex-call.js <prompt>") 또는
   - Bash("node helpers/gemini-call.js <prompt>")
   - 타임아웃: 120초

4. 결과 해석:
   - CLI 출력에서 핵심 내용 추출
   - 코드 변경이 있으면 분리
   - 요약 생성

5. 결과 보고:
   - Concertmaster에게 SendMessage로 전달

6. 실패 처리:
   - 에러 원인 분석 → 프롬프트 수정 → 1회 재시도
   - 재시도 실패 → 실패 보고 → Claude subagent가 즉시 대행
```

프롬프트 변환 규칙 (agent 정의에 내장):
- **codex-soloist**: 코드 블록 포함, 구체적 파일 경로 명시, `--output-schema` 활용
- **gemini-soloist**: 넓은 컨텍스트 활용 유도, `--output-format json` 활용
- 상황에 따라 Soloist가 자유 판단으로 변환 방식 조정 가능

### Claude subagents (역할별 동적)

Lead가 spawn 시 역할을 지정:
- architect — 설계/아키텍처
- tester — 테스트/검증
- reviewer — 코드 리뷰
- implementer — 구현
- 기타 필요에 따라 동적 생성

---

## Verified CLI Interfaces

### Codex CLI v0.77.0

```bash
# 비대화형 실행
codex exec -m <model> --json --full-auto --skip-git-repo-check "<prompt>"

# stdin 입력 (프롬프트를 인수 대신 stdin으로)
echo "<prompt>" | codex exec -m <model> --json --full-auto --skip-git-repo-check -

# 구조화 출력 (JSON Schema 강제)
codex exec --output-schema schema.json --json --full-auto "<prompt>"

# 마지막 응답을 파일로 저장
codex exec -o output.md --full-auto "<prompt>"

# 코드 리뷰 전용
codex exec review --full-auto
```

주요 플래그:
| 플래그 | 설명 |
|--------|------|
| `exec` | 비대화형 실행 (alias: `e`) |
| `--json` | JSONL 이벤트 스트림 출력 |
| `-m, --model` | 모델 지정 |
| `--full-auto` | 안전한 자동 실행 (`-a on-request, --sandbox workspace-write`) |
| `--dangerously-bypass-approvals-and-sandbox` | 완전 자동 (최후 수단) |
| `--skip-git-repo-check` | git repo 밖에서도 실행 |
| `--output-schema <file>` | JSON Schema로 출력 형식 강제 |
| `-o, --output-last-message <file>` | 마지막 응답 파일 저장 |
| `-C, --cd <dir>` | 작업 디렉토리 지정 |

출력 파싱: JSONL에서 `item.completed` → `item.text` 추출 (런타임 검증 필요)

### Gemini CLI v0.23.0

```bash
# 비대화형 실행
gemini -y --output-format json -m <model> "<prompt>"

# stdin 입력
echo "<prompt>" | gemini -y --output-format json

# 스트리밍 JSON
gemini -y --output-format stream-json "<prompt>"

# 특정 도구만 허용
gemini -y --allowed-tools shell,write-file "<prompt>"

# 추가 작업 디렉토리
gemini -y --include-directories ../lib,../docs "<prompt>"
```

주요 플래그:
| 플래그 | 설명 |
|--------|------|
| `-y, --yolo` | 모든 도구 자동 승인 |
| `--approval-mode` | `default` / `auto_edit` / `yolo` |
| `-m, --model` | 모델 지정 |
| `--output-format` | `text` / `json` / `stream-json` |
| `-p, --prompt` | 비대화형 프롬프트 (deprecated, positional 권장) |
| `--allowed-tools` | 허용 도구 제한 |
| `--include-directories` | 추가 작업 디렉토리 |

stdin: 500ms 타임아웃, 최대 8MB

### 보안 정책

```
기본 (안전):
  Codex: --full-auto (샌드박스 + 요청 시 승인)
  Gemini: --approval-mode auto_edit (편집 도구만 자동)

명시적 요청 시 (--yolo 플래그):
  Codex: --dangerously-bypass-approvals-and-sandbox
  Gemini: --yolo
```

---

## Round-Based Execution Flow

### 전체 흐름

```
1. 사용자 → Lead: 작업 요청
2. Lead: 에이전트 구성 결정 (프리셋 or 판단)
3. Lead: 가용성 체크 (codex --version, gemini --version)
4. Lead: 불가용 에이전트 폴백 적용
5. Lead: 모든 agent spawn (Concertmaster, subagents, soloists)
6. Lead → Concertmaster: 에이전트 이름 목록 + 작업 지시
7. Concertmaster: Round 1 실행
   ├── 각 에이전트에게 작업 지시 (SendMessage)
   ├── 결과 수집 (타임아웃 120초, 부분 결과 허용)
   ├── 관련 에이전트 결과만 선별하여 피드백 조합
   ├── 라운드 요약 파일 저장
   └── Lead에게 라운드 요약 보고
8. Lead: 요약 검토 → "계속" / "방향 수정" / "종료"
9. Concertmaster: Round 2 실행 (이전 라운드 피드백 포함)
   └── ... 반복
10. Lead: 최종 합성 (규칙 기반 우선) → 사용자 전달
```

### 시퀀스 예시: 코드 리뷰

```
사용자: "/claude-maestro review src/auth.ts"

Lead:
  프리셋 = review
  spawn: Concertmaster, reviewer, codex-soloist, gemini-soloist
  → Concertmaster에게 전달:
    "에이전트: reviewer, codex-soloist, gemini-soloist
     작업: src/auth.ts 코드 리뷰
     reviewer = 아키텍처/설계 관점
     codex-soloist = 보안/정확성 관점
     gemini-soloist = 가독성/대안 관점"

Concertmaster: Round 1
  → reviewer: "src/auth.ts를 아키텍처/설계 관점에서 리뷰해줘"
  → codex-soloist: "src/auth.ts를 보안/정확성 관점에서 리뷰해줘"
  → gemini-soloist: "src/auth.ts를 가독성/대안 관점에서 리뷰해줘"
  ← 결과 수집
  → 라운드 요약 저장 (.claude-maestro/rounds/round-1/)
  → Lead에게 보고

Lead: "보안 이슈 심각 — codex-soloist에게 SQL injection 부분 깊이 파고들라고 해"

Concertmaster: Round 2
  → codex-soloist: "SQL injection 취약점 상세 분석. reviewer가 지적한 입력 검증 누락도 참고."
  → reviewer: "Codex가 발견한 SQL injection + Gemini의 에러 처리 제안을 반영한 수정안 작성"
  → gemini-soloist: (이번 라운드 불참 — 관련 작업 없음)
  ← 결과 수집
  → Lead에게 보고

Lead: 최종 합성 → 사용자에게 통합 리뷰 결과 전달
```

### 시퀀스 예시: 풀스택 개발

```
사용자: "/claude-maestro --preset collab 대시보드 페이지 개발"

Lead:
  프리셋 = collab
  spawn: Concertmaster, architect, codex-soloist, gemini-soloist, tester

Concertmaster: Round 1 — 설계
  → architect: "대시보드 API 설계"
  → codex-soloist: "대시보드 데이터 모델/백엔드 설계"
  → gemini-soloist: "대시보드 UI 컴포넌트 구조 설계"
  → tester: (대기 — 아직 설계 단계)

Concertmaster: Round 2 — 구현 (이전 라운드 결과 참조)
  → architect: (이번 라운드 불참 — 설계 완료)
  → codex-soloist: "백엔드 구현. architect API 스펙 + gemini UI 요구사항 참고."
  → gemini-soloist: "프론트엔드 구현. architect API 스펙 + codex 데이터 모델 참고."
  → tester: "테스트 전략 수립. architect 설계 참고."

Concertmaster: Round 3 — 검증
  → tester: "통합 테스트 실행. codex 백엔드 + gemini 프론트엔드 결과 참고."
  → codex-soloist: "gemini 프론트엔드 코드 리뷰"
  → gemini-soloist: "codex 백엔드 코드 리뷰"
```

---

## Presets

프리셋 or Lead 판단으로 에이전트 구성을 결정한다.
사용자가 `--agents`로 직접 지정할 수도 있다.

**굵은** 에이전트는 필수, 나머지는 선택 (`--budget`으로 제어).

| 프리셋 | 에이전트 구성 | 라운드 수 | 최소 budget |
|--------|-------------|----------|------------|
| `review` | **reviewer**, codex-soloist(보안), gemini-soloist(가독성) | 2 | 1 |
| `build` | **architect**, **codex-soloist**(구현), tester, gemini-soloist(리뷰) | 3 | 2 |
| `research` | **codex-soloist**(기술분석), gemini-soloist(대안조사) | 2 | 1 |
| `decide` | **codex-soloist**(분석), gemini-soloist(다른관점) | 2 | 1 |
| `collab` | **architect**, **codex-soloist**(백엔드), gemini-soloist(프론트), tester | 3 | 2 |

### `--budget` 옵션

```bash
# 모든 에이전트 사용 (기본)
/claude-maestro review src/auth.ts

# 최대 2개 에이전트만
/claude-maestro --budget 2 review src/auth.ts

# 필수만
/claude-maestro --budget 1 review src/auth.ts

# 커스텀 에이전트 구성
/claude-maestro --agents "architect, codex-soloist" "인증 모듈 설계"
```

budget 선택 로직:
```
1. 필수 에이전트 수 = R
2. budget = B (미지정이면 B = 전체)
3. B < R → 에러: "이 프리셋은 최소 {R}개 에이전트 필요"
4. 선택 에이전트를 우선순위 순으로 정렬
5. 상위 (B - R)개 선택 에이전트 활성화
6. 나머지 비활성화 + "Gemini 관점 미포함" 경고
```

---

## Fallback Policy

### 에이전트 가용성에 따른 폴백

```
가용성 체크: codex --version / gemini --version

codex 미설치:
  → Claude subagent가 역할 프롬프트로 대행
  → "보안/정확성 관점에서만 리뷰하는 에이전트" 역할 부여
  → 사용자에게 알림: "Codex CLI 미설치 — Claude subagent가 대행합니다"

gemini 미설치:
  → 동일하게 Claude subagent 대행

둘 다 미설치:
  → Claude subagent들만으로 운영 (관점 분리)
```

### 대행 가능/불가 판단

```
"관점"이 필요한 작업 → 대행 가능
  예: 보안 리뷰, 아키텍처 분석, 코드 가독성 검토
  → Claude subagent에 역할 프롬프트 부여

"능력"이 필요한 작업 → 대행 불가
  예: Gemini 1M 토큰 컨텍스트로 전체 코드베이스 분석
  예: Codex 샌드박스에서 코드 실행 검증
  → "이 작업은 Gemini/Codex 고유 능력이 필요합니다.
     CLI를 설치하거나 작업 범위를 줄여주세요."
```

### 라운드 중 Soloist 실패

```
codex-soloist 실패 (타임아웃/에러):
  1. Soloist 내부에서 프롬프트 수정 → 1회 재시도
  2. 재시도 실패 → Concertmaster에게 실패 보고
  3. Claude subagent 즉시 spawn하여 해당 역할 대행
  4. 대행 에이전트가 남은 라운드 참여
```

---

## Synthesis Strategy

### 2단계 통합 파이프라인

```
Stage 1: Rule-Based Merge (규칙 기반, 항상 실행)
  ├── 구조적 중복 제거 (동일 파일/라인 참조)
  ├── 카테고리 분류 (보안/성능/가독성/아키텍처)
  ├── 합의 감지 (2+ 에이전트가 동일 이슈 지적)
  ├── 충돌 감지 (에이전트 간 상반된 의견)
  └── 심각도 정렬 (critical > warning > info)

Stage 2: LLM Polish (충돌 해소 시에만)
  ├── 충돌 해소가 필요한 경우만 Lead가 직접 판단
  ├── 규칙으로 처리 불가한 주관적 판단
  └── --no-polish 플래그로 Stage 2 완전 스킵 가능
```

Rule-Based Merge에서 **구조화된 항목 추출**을 위해:
- Codex: `--output-schema` 플래그로 JSON Schema 강제
- Gemini: `--output-format json` 플래그 활용
- Claude subagent: 프롬프트에 출력 형식 지정

Stage 2 스킵 조건:
- 충돌 없고 합의만 있는 경우
- 각 에이전트가 보완적 영역을 다룬 경우
- `--no-polish` 플래그 지정

---

## Context Management

### Lead 컨텍스트 보호

```
Lead가 받는 것: Concertmaster의 라운드 요약만 (상세 결과 아님)
상세 결과: .claude-maestro/rounds/ 파일에 저장
히스토리: plan.md에 전체 방향 조정 기록

Lead ↔ Concertmaster 통신 단절 시:
  → plan.md에서 히스토리 복구
  → 양쪽 다 plan.md 참조
```

### Concertmaster 컨텍스트 보호

```
라운드 수 제한: 기본 3라운드
5라운드 이상 시 경고
파일 기반 복구: .claude-maestro/rounds/ 에서 이전 라운드 참조 가능
```

### 라운드 수

```
Phase 1 (MVP): 고정 라운드 (프리셋별 지정, 기본 3)
Phase 2 (이후): 수렴 감지 추가
  - 변경률 < 10% → 조기 종료
  - 최소 2라운드 보장
```

---

## Error Handling

| 시나리오 | 처리 |
|---------|------|
| Soloist 타임아웃 | 결과 없이 라운드 진행, 다음 라운드에서 재시도 또는 Claude 대행 |
| Soloist 에러 | 프롬프트 수정 → 1회 재시도 → 실패 시 Claude subagent 즉시 대행 |
| CLI 미설치 | 관점 작업: Claude 대행 / 능력 작업: 대행 불가 안내 |
| Concertmaster 컨텍스트 초과 | 라운드 수 제한 (기본 3) + 파일 기반 복구 |
| Lead 컨텍스트 유실 | plan.md에서 히스토리 복구 |
| 전체 외부 에이전트 실패 | Claude subagent들만으로 운영 + 사용자 알림 |

---

## File Structure

### 런타임 디렉토리

```
.claude-maestro/
├── plan.md                       ← Lead의 히스토리 (에이전트 구성, 방향 조정 기록)
├── result.md                     ← 최종 합성 결과
└── rounds/
    ├── round-1/
    │   ├── summary.md            ← Concertmaster → Lead 보고용 요약
    │   ├── architect.md          ← Claude subagent 결과 원본
    │   ├── reviewer.md
    │   ├── codex-soloist.md      ← Codex 통역 결과
    │   └── gemini-soloist.md     ← Gemini 통역 결과
    ├── round-2/
    │   └── ...
    └── round-3/
        └── ...
```

### 프로젝트 구조

```
claude-maestro/
├── package.json
├── tsconfig.json
├── agents/
│   ├── concertmaster.md          ← Concertmaster agent 정의
│   ├── codex-soloist.md          ← Codex Bridge agent 정의
│   └── gemini-soloist.md         ← Gemini Bridge agent 정의
├── helpers/
│   ├── codex-call.ts             ← Codex CLI 호출 + JSONL 파싱
│   └── gemini-call.ts            ← Gemini CLI 호출 + JSON 파싱
├── skill/
│   └── SKILL.md                  ← Claude Code skill 정의
├── presets/
│   ├── review.json
│   ├── build.json
│   ├── research.json
│   ├── decide.json
│   └── collab.json
└── schemas/
    ├── codex-review.json         ← Codex --output-schema용
    └── codex-analysis.json
```

---

## Skill Definition

### SKILL.md

```markdown
---
name: claude-maestro
description: >
  Multi-model agent orchestration. Claude Code leads, Codex and Gemini
  collaborate as soloists via round-based communication.
  Trigger: "maestro", "multi-model", "orchestrate agents"
aliases: [maestro]
---

# claude-maestro

Claude Code를 Lead로, Codex/Gemini CLI를 Soloist로 활용하는
라운드 기반 멀티모델 오케스트레이션.

## Usage

/claude-maestro [options] "<task>"
/claude-maestro --preset <review|build|research|decide|collab> "<task>"
/maestro "<task>"

## Options

- --preset <name>       프리셋 사용
- --budget <N|auto>     에이전트 수 제한
- --agents <list>       에이전트 직접 지정 (예: "architect, codex-soloist")
- --no-polish           LLM polish 스킵
- --yolo                외부 CLI에 전체 자동 승인

## Execution Protocol

Lead (Claude Code)가 이 스킬 호출 시:

1. 에이전트 구성 결정 (프리셋 or 자체 판단)
2. 가용성 체크: Bash("codex --version"), Bash("gemini --version")
3. 불가용 에이전트 → 폴백 적용 (Claude subagent 대행 or 불가 안내)
4. 모든 agent spawn:
   - Agent(subagent_type="concertmaster", ...)
   - Agent(subagent_type="codex-soloist", ...) 또는 대행 subagent
   - Agent(subagent_type="gemini-soloist", ...) 또는 대행 subagent
   - Agent(역할별 Claude subagent)
5. Concertmaster에게 SendMessage: 에이전트 목록 + 작업 지시
6. 라운드 루프:
   a. Concertmaster 라운드 요약 수신
   b. plan.md 업데이트
   c. 방향 조정 판단 → Concertmaster에게 지시
7. 종료 시: 최종 합성 (규칙 기반) → 사용자 전달
```

### Skill 설치

```bash
# npm 패키지 설치
npm install -g claude-maestro

# Claude Code skill 설치 (global)
claude-maestro install-skill

# Claude Code skill 설치 (project)
claude-maestro install-skill --scope project
```

install-skill이 하는 일:
- `skill/SKILL.md` → `~/.claude/skills/claude-maestro/SKILL.md` (global)
- 또는 `.claude/skills/claude-maestro/SKILL.md` (project)
- `agents/*.md` → 해당 경로에 복사
- `helpers/*.ts` → 컴파일하여 복사
- `presets/*.json` → 복사
- `schemas/*.json` → 복사

npm postinstall:
```
┌──────────────────────────────────────────────┐
│  claude-maestro installed successfully!       │
│                                               │
│  To use with Claude Code:                     │
│    claude-maestro install-skill               │
│                                               │
│  Prerequisites:                               │
│    npm install -g @openai/codex    (optional)  │
│    npm install -g @google/gemini-cli (optional) │
└──────────────────────────────────────────────┘
```

---

## Helper Scripts

Node.js (TypeScript)로 작성. Soloist가 Bash를 통해 호출한다.

### helpers/codex-call.ts

```typescript
// 역할: Codex CLI 호출, JSONL 파싱, 결과 반환
// 입력: 프롬프트 (args 또는 stdin)
// 출력: 파싱된 텍스트 응답 (stdout)

interface CodexCallOptions {
  prompt: string;
  model?: string;           // default: 설정 파일 참조
  timeout?: number;         // default: 120000ms
  outputSchema?: string;    // JSON Schema 파일 경로
  cwd?: string;             // 작업 디렉토리
  fullAuto?: boolean;       // default: true
  dangerousMode?: boolean;  // default: false
}

// 실행: codex exec -m <model> --json --full-auto --skip-git-repo-check "<prompt>"
// 파싱: JSONL에서 item.completed 이벤트의 item.text 추출
// 출력: 파싱된 텍스트를 stdout으로 반환
```

### helpers/gemini-call.ts

```typescript
// 역할: Gemini CLI 호출, JSON 파싱, 결과 반환
// 입력: 프롬프트 (args 또는 stdin)
// 출력: 파싱된 텍스트 응답 (stdout)

interface GeminiCallOptions {
  prompt: string;
  model?: string;            // default: 설정 파일 참조
  timeout?: number;          // default: 120000ms
  outputFormat?: string;     // default: 'json'
  approvalMode?: string;     // default: 'auto_edit'
  cwd?: string;
  yolo?: boolean;            // default: false
}

// 실행: gemini --output-format json --approval-mode auto_edit -m <model> "<prompt>"
// 파싱: JSON 응답에서 텍스트 추출
// 출력: stdout으로 반환
```

---

## Implementation Priority

### Phase 1: Foundation (MVP)
1. Helper scripts (codex-call.ts, gemini-call.ts)
2. Agent definitions (concertmaster.md, codex-soloist.md, gemini-soloist.md)
3. SKILL.md + install-skill 명령
4. `review` 프리셋
5. Hub-spoke 패턴 (Lead → Concertmaster → agents → 결과 수집)
6. 규칙 기반 합성 (Stage 1만)
7. 기본 폴백 (Claude subagent 대행)

### Phase 2: Patterns + Presets
8. `build`, `collab` 프리셋
9. 라운드 기반 피드백 조합 (관련 에이전트 선별)
10. `--budget`, `--agents` 옵션
11. LLM Polish (Stage 2, `--no-polish` 플래그)
12. 에러 핸들링 강화 (타임아웃, 재시도, 즉시 대행)

### Phase 3: Advanced
13. `research`, `decide` 프리셋
14. 수렴 감지 (라운드 조기 종료)
15. Codex `--output-schema` 활용 구조화 출력
16. Gemini `--output-format stream-json` 중간 보고
17. 세션 재개 기능

---

## Key Differences from OMC

| 구분 | OMC /team | claude-maestro |
|------|-----------|----------------|
| **외부 CLI** | tmux 기반 one-shot 워커 | Soloist 통역사 (해석+재시도) |
| **통신** | CLI 워커는 SendMessage 불가 | Soloist가 중계하여 SendMessage 참여 |
| **라운드** | 없음 (태스크 기반) | 라운드 기반 (이전 결과 참조) |
| **합성** | Lead가 직접 | 규칙 기반 우선, LLM polish 선택 |
| **비용 제어** | 없음 | budget + 필수/선택 에이전트 |
| **폴백** | 없음 | Claude subagent 대행 + 능력 의존 불가 처리 |
| **컨텍스트 보호** | 없음 | Concertmaster 분리 + 파일 저장 + plan.md |

claude-maestro는 OMC와 **보완 관계**이다. OMC의 `/team`은 Claude subagent 중심 태스크 분배에 특화되어 있고, claude-maestro는 외부 모델의 고유 능력/관점을 라운드 기반으로 통합하는 데 특화되어 있다.
