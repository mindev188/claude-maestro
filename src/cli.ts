import { installSkill } from './install-skill.js';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const args = process.argv.slice(2);
const command = args[0];

async function main(): Promise<void> {
  switch (command) {
    case 'install-skill': {
      const scope = args.includes('--scope') && args[args.indexOf('--scope') + 1] === 'project'
        ? 'project' as const
        : 'global' as const;
      await installSkill(scope);
      break;
    }

    case '--version':
    case '-v': {
      const pkgPath = join(__dirname, '..', 'package.json');
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
      console.log(pkg.version);
      break;
    }

    case '--help':
    case '-h':
    case undefined: {
      console.log(`
claude-maestro — Multi-model agent orchestration for Claude Code

Commands:
  install-skill              Install Claude Code skill (global)
  install-skill --scope project  Install skill for current project

Options:
  --version, -v              Show version
  --help, -h                 Show this help

Prerequisites:
  npm install -g @openai/codex     (optional — Codex CLI)
  npm install -g @google/gemini-cli (optional — Gemini CLI)
`);
      break;
    }

    default:
      console.error(`Unknown command: ${command}`);
      console.error('Run "claude-maestro --help" for usage');
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
