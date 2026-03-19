import { spawn, execSync } from 'node:child_process';
import type { CallOptions, CallResult, CliAvailability } from './types.js';

const DEFAULT_TIMEOUT = 120_000;
const MAX_BUFFER_SIZE = 10 * 1024 * 1024;

export function parseCodexJsonl(output: string): string {
  const trimmed = output.trim();
  if (!trimmed) return '';

  const lines = trimmed.split('\n').filter(l => l.trim());
  const messages: string[] = [];

  for (const line of lines) {
    try {
      const event = JSON.parse(line);

      if (event.type === 'item.completed' && event.item?.type === 'agent_message' && event.item.text) {
        messages.push(event.item.text);
      } else if (event.type === 'message' && event.content) {
        if (typeof event.content === 'string') {
          messages.push(event.content);
        } else if (Array.isArray(event.content)) {
          for (const part of event.content) {
            if (part.type === 'text' && part.text) {
              messages.push(part.text);
            }
          }
        }
      } else if (event.type === 'output_text' && event.text) {
        messages.push(event.text);
      }
    } catch {
      messages.push(line);
    }
  }

  return messages.join('\n');
}

export function buildCodexArgs(options: CallOptions): string[] {
  const args = ['exec', '--json'];

  if (options.dangerousMode) {
    args.push('--dangerously-bypass-approvals-and-sandbox');
  } else {
    args.push('--full-auto');
  }

  args.push('--skip-git-repo-check');

  if (options.model) {
    args.push('-m', options.model);
  }

  if (options.cwd) {
    args.push('-C', options.cwd);
  }

  args.push(options.prompt);

  return args;
}

export function checkCodexAvailability(): CliAvailability {
  try {
    const version = execSync('codex --version', {
      encoding: 'utf-8',
      timeout: 10_000,
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return { available: true, version };
  } catch (err) {
    return { available: false, error: (err as Error).message };
  }
}

export async function callCodex(options: CallOptions): Promise<CallResult> {
  const startTime = Date.now();
  const timeout = options.timeout ?? DEFAULT_TIMEOUT;
  const args = buildCodexArgs(options);

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;

    const child = spawn('codex', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd,
    });

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGTERM');
        setTimeout(() => { if (!child.killed) child.kill('SIGKILL'); }, 5000);
        resolve({
          success: false,
          content: '',
          raw: stdout,
          durationMs: Date.now() - startTime,
          error: `Codex timed out after ${timeout}ms`,
        });
      }
    }, timeout);

    child.stdout?.on('data', (data: Buffer) => {
      if (stdout.length < MAX_BUFFER_SIZE) stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      if (stderr.length < MAX_BUFFER_SIZE) stderr += data.toString();
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      const durationMs = Date.now() - startTime;

      if (code === 0) {
        resolve({
          success: true,
          content: parseCodexJsonl(stdout),
          raw: stdout,
          durationMs,
        });
      } else {
        resolve({
          success: false,
          content: '',
          raw: stdout,
          durationMs,
          error: stderr || `Codex exited with code ${code}`,
        });
      }
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({
        success: false,
        content: '',
        raw: '',
        durationMs: Date.now() - startTime,
        error: `Failed to spawn codex: ${err.message}`,
      });
    });
  });
}
