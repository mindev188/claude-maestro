import type { CallOptions, CallResult, CliAvailability } from './types.js';
export declare function parseCodexJsonl(output: string): string;
export declare function buildCodexArgs(options: CallOptions): string[];
export declare function checkCodexAvailability(): CliAvailability;
export declare function callCodex(options: CallOptions): Promise<CallResult>;
