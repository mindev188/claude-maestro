# claude-maestro

[English](README.md) | **한국어**

Claude Code를 위한 멀티모델 에이전트 오케스트레이션. Claude Code가 Lead(마에스트로)로서 Codex CLI와 Gemini CLI를 라운드 기반 협업으로 지휘합니다.

## 왜 만들었나

Claude Code는 외부에서 OAuth로 호출할 수 없습니다. 하지만 Claude Code *안에서* 다른 CLI 에이전트를 호출하는 것은 가능합니다. claude-maestro는 이 구조를 활용합니다: Claude Code가 허브가 되어 Codex와 Gemini를 전문 작업자로 생성하고 조율합니다.

- **Claude Code (Lead)**: 추론, 기획, 합성
- **Codex CLI (Soloist)**: 코드 실행, 보안 분석, 버그 탐지
- **Gemini CLI (Soloist)**: 대용량 컨텍스트 분석, 대안 제시, 가독성 리뷰

## 아키텍처

```
사용자 ──► Claude Code (Lead)
              │
              ├── Concertmaster (라운드 관리자)
              │       ├── Codex Soloist ──► codex CLI
              │       ├── Gemini Soloist ──► gemini CLI
              │       └── Reviewer (Claude subagent)
              │
              └── 합성 ──► 최종 결과
```

라운드 흐름: **지시 → 대기 → 수집 → 조합 → 보고**. Concertmaster가 라운드를 관리하고 선별적 컨텍스트 전달로 Lead의 컨텍스트 윈도우를 보호합니다.

## 사전 요구사항

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (필수)
- [Codex CLI](https://github.com/openai/codex) (선택)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) (선택)

CLI가 없으면 자동으로 폴백합니다 — 관점 작업은 Claude subagent로 대체, 능력 작업(대용량 컨텍스트, 샌드박스 등)은 사용 불가로 보고합니다.

## 설치

```bash
# 패키지 설치
npm install -g claude-maestro

# Claude Code 스킬 설치
claude-maestro install-skill

# 현재 프로젝트에만 설치
claude-maestro install-skill --scope project
```

에이전트 정의, 스킬 파일, 헬퍼, 프리셋이 Claude Code 스킬 디렉토리에 복사됩니다.

## 사용법

Claude Code 세션에서:

```
/claude-maestro --preset review "src/auth.ts 보안 리뷰"
/maestro "이 코드베이스 아키텍처 분석해줘"
```

### 옵션

| 플래그 | 설명 |
|--------|------|
| `--preset <name>` | 프리셋 사용 (review, build, research, decide, collab) |
| `--budget <N>` | 에이전트 수 제한 (필수 에이전트는 항상 포함) |
| `--agents <list>` | 에이전트 직접 지정 (예: "reviewer, codex-soloist") |
| `--rounds <N>` | 협업 라운드 수 |
| `--no-polish` | LLM 다듬기 건너뜀, 규칙 기반 합성만 사용 |
| `--yolo` | 외부 CLI 전체 자동 승인 |

### 프리셋

| 프리셋 | 에이전트 | 라운드 | 용도 |
|--------|----------|--------|------|
| `review` | reviewer + codex-soloist + gemini-soloist | 2 | 다관점 코드 리뷰 |

Phase 2에서 추가 프리셋 예정.

## CLI 명령어

```bash
claude-maestro install-skill              # 글로벌 스킬 설치
claude-maestro install-skill --scope project  # 프로젝트용 설치
claude-maestro --version                  # 버전 확인
claude-maestro --help                     # 도움말
```

## 개발

```bash
git clone https://github.com/mindev188/claude-maestro.git
cd claude-maestro
npm install
npm run build    # TypeScript 컴파일
npm test         # 테스트 실행
```

## 라이센스

MIT
