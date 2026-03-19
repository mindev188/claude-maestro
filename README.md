# claude-maestro

Multi-model agent orchestration for Claude Code. Claude Code acts as the Lead (Maestro), orchestrating Codex CLI and Gemini CLI as soloists through round-based collaboration.

## Why

Claude Code cannot be called via OAuth from external tools — but it *can* call other CLI-based agents. claude-maestro flips the paradigm: Claude Code becomes the hub that spawns and coordinates Codex and Gemini as specialized workers, each contributing unique strengths.

- **Claude Code (Lead)**: Reasoning, planning, synthesis
- **Codex CLI (Soloist)**: Code execution, security analysis, bug detection
- **Gemini CLI (Soloist)**: Large context analysis, alternative approaches, readability review

## Architecture

```
User ──► Claude Code (Lead)
              │
              ├── Concertmaster (round manager)
              │       ├── Codex Soloist ──► codex CLI
              │       ├── Gemini Soloist ──► gemini CLI
              │       └── Reviewer (Claude subagent)
              │
              └── Synthesis ──► Final Result
```

Each round: **instruct → wait → collect → combine → report**. The Concertmaster manages rounds and selective context passing so the Lead's context window stays clean.

## Prerequisites

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) (required)
- [Codex CLI](https://github.com/openai/codex) (optional)
- [Gemini CLI](https://github.com/google-gemini/gemini-cli) (optional)

Missing CLIs gracefully degrade — perspective tasks fall back to Claude subagents, capability tasks report unavailable.

## Installation

```bash
# Install the package
npm install -g claude-maestro

# Install the Claude Code skill
claude-maestro install-skill

# Or install for current project only
claude-maestro install-skill --scope project
```

This copies agent definitions, skill file, helpers, and presets into your Claude Code skills directory.

## Usage

In a Claude Code session:

```
/claude-maestro --preset review "review src/auth.ts for security issues"
/maestro "analyze this codebase architecture"
```

### Options

| Flag | Description |
|------|-------------|
| `--preset <name>` | Use a preset (review, build, research, decide, collab) |
| `--budget <N>` | Limit number of agents (required agents always included) |
| `--agents <list>` | Specify agents directly (e.g. "reviewer, codex-soloist") |
| `--rounds <N>` | Number of collaboration rounds |
| `--no-polish` | Skip LLM polish, rule-based synthesis only |
| `--yolo` | Full auto-approval for external CLIs |

### Presets

| Preset | Agents | Rounds | Purpose |
|--------|--------|--------|---------|
| `review` | reviewer + codex-soloist + gemini-soloist | 2 | Multi-perspective code review |

More presets coming in Phase 2.

## CLI Commands

```bash
claude-maestro install-skill              # Install skill globally
claude-maestro install-skill --scope project  # Install for current project
claude-maestro --version                  # Show version
claude-maestro --help                     # Show help
```

## Development

```bash
git clone https://github.com/mindevolution/claude-maestro.git
cd claude-maestro
npm install
npm run build    # TypeScript compilation
npm test         # Run tests
```

## License

MIT
