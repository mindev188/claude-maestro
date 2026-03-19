import { existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export function resolveInstallPaths(scope, home = homedir(), cwd = process.cwd()) {
    const base = scope === 'global'
        ? join(home, '.claude', 'skills', 'claude-maestro')
        : join(cwd, '.claude', 'skills', 'claude-maestro');
    return {
        skillDir: base,
        helpersDir: join(base, 'helpers'),
        agentsDir: join(base, 'agents'),
        presetsDir: join(base, 'presets'),
    };
}
export function collectFiles(packageRoot) {
    const files = [];
    // Skill definition
    files.push({ src: join(packageRoot, 'skill', 'SKILL.md'), dest: 'SKILL.md' });
    // Agent definitions
    for (const agent of ['concertmaster.md', 'codex-soloist.md', 'gemini-soloist.md']) {
        files.push({ src: join(packageRoot, 'agents', agent), dest: join('agents', agent) });
    }
    // Compiled helpers
    for (const helper of ['codex-call.js', 'gemini-call.js', 'types.js']) {
        files.push({ src: join(packageRoot, 'dist', 'helpers', helper), dest: join('helpers', helper) });
    }
    // Presets
    files.push({ src: join(packageRoot, 'src', 'presets', 'review.json'), dest: join('presets', 'review.json') });
    return files;
}
function getPackageRoot() {
    return join(__dirname, '..');
}
function ensureDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}
export async function installSkill(scope = 'global') {
    const packageRoot = getPackageRoot();
    const paths = resolveInstallPaths(scope);
    const files = collectFiles(packageRoot);
    ensureDir(paths.skillDir);
    ensureDir(paths.helpersDir);
    ensureDir(paths.agentsDir);
    ensureDir(paths.presetsDir);
    let installed = 0;
    let skipped = 0;
    for (const file of files) {
        const destPath = join(paths.skillDir, file.dest);
        ensureDir(dirname(destPath));
        if (!existsSync(file.src)) {
            console.warn(`  SKIP: ${file.dest} (source not found: ${file.src})`);
            skipped++;
            continue;
        }
        copyFileSync(file.src, destPath);
        installed++;
    }
    const scopeLabel = scope === 'global' ? '~/.claude' : '.claude';
    console.log(`\nclaude-maestro skill installed (${scopeLabel}/skills/claude-maestro/)`);
    console.log(`  ${installed} files installed, ${skipped} skipped`);
    console.log(`\nUsage in Claude Code:`);
    console.log(`  /claude-maestro --preset review "review src/auth.ts"`);
    console.log(`  /maestro "analyze this codebase"`);
}
//# sourceMappingURL=install-skill.js.map