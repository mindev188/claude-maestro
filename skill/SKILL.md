---
name: claude-maestro
description: >
  Multi-model agent orchestration. Claude Code leads, Codex and Gemini
  collaborate as soloists via round-based communication.
  Trigger: "maestro", "multi-model", "orchestrate agents"
aliases: [maestro]
---

# claude-maestro

Claude Code를 Lead로, Codex/Gemini CLI를 Soloist로 활용하는 라운드 기반 멀티모델 오케스트레이션.

## Usage

```
/claude-maestro [options] "<task>"
/claude-maestro --preset review "<task>"
/maestro "<task>"
```

## Options

- `--preset <name>` — 프리셋 사용 (review, build, research, decide, collab)
- `--budget <N>` — 에이전트 수 제한 (필수 에이전트는 항상 포함)
- `--agents <list>` — 에이전트 직접 지정 (예: "reviewer, codex-soloist")
- `--no-polish` — LLM polish 스킵 (규칙 기반 합성만)
- `--yolo` — 외부 CLI에 전체 자동 승인
- `--rounds <N>` — 라운드 수 지정 (기본: 프리셋에 따름)

## Execution Protocol

When invoked, Claude Code (Lead) MUST follow this protocol:

### Phase 1: Setup

1. **Load preset** (if --preset specified) or determine agent composition:
   Read the preset JSON from the installed presets directory.
   If no preset, analyze the task and decide which agents are needed.

2. **Check CLI availability**:
   ```
   Bash: codex --version
   Bash: gemini --version
   ```
   - Available → use soloist
   - Not available → fallback:
     - "Perspective" tasks: Claude subagent with role prompt substitutes
     - "Capability" tasks (long context, sandbox execution): report unavailable

3. **Apply --budget**: If budget < total agents, keep required agents + highest priority optional agents up to budget. Warn about excluded perspectives.

4. **Create working directory**:
   ```
   Bash: mkdir -p .claude-maestro/rounds
   ```

5. **Write plan.md**:
   Write agent composition and task to `.claude-maestro/plan.md`

### Phase 2: Spawn Agents

6. **Spawn all agents** (parallel):
   ```
   Agent(name="concertmaster", subagent_type="oh-my-claudecode:executor", prompt=<concertmaster.md content + initial instructions>)
   Agent(name="codex-soloist", subagent_type="oh-my-claudecode:executor", prompt=<codex-soloist.md content>)
   Agent(name="gemini-soloist", subagent_type="oh-my-claudecode:executor", prompt=<gemini-soloist.md content>)
   Agent(name="reviewer", subagent_type="oh-my-claudecode:executor", prompt="You are a code reviewer focusing on architecture and design...")
   ```

7. **Instruct Concertmaster**:
   ```
   SendMessage(to="concertmaster"):
     "Agents: reviewer, codex-soloist, gemini-soloist
      Task: <task description>
      Rounds: <N>
      Begin Round 1."
   ```

### Phase 3: Round Loop

8. **Wait for Concertmaster's round summary** (via SendMessage)

9. **Update plan.md** with round result and any direction changes

10. **Decide**:
    - "Continue" → SendMessage(to="concertmaster"): "Proceed to Round N+1"
    - "Adjust" → SendMessage(to="concertmaster"): "Direction change: <details>"
    - "Stop" → SendMessage(to="concertmaster"): "Stop. Produce final summary."

### Phase 4: Synthesis

11. **Read all round files**: `.claude-maestro/rounds/round-*/summary.md`

12. **Rule-based merge**:
    - Deduplicate findings (same file + same issue)
    - Categorize (security / performance / readability / architecture / bug)
    - Identify agreements (2+ agents flagged same issue)
    - Identify conflicts (agents disagree)
    - Sort by severity (critical > warning > info)

13. **LLM polish** (only if conflicts exist and --no-polish not set):
    - Resolve conflicts with reasoning
    - Produce final unified summary

14. **Write result**: `.claude-maestro/result.md`

15. **Present to user**: Display synthesized result

## Helpers Path

After `claude-maestro install-skill`, helpers are located at:
- Global: `~/.claude/skills/claude-maestro/helpers/`
- Project: `.claude/skills/claude-maestro/helpers/`

Soloists call helpers via:
```bash
Bash: node <helpers-path>/codex-call.js "<prompt>"
Bash: node <helpers-path>/gemini-call.js "<prompt>"
```
