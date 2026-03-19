import type { CallOptions, CallResult, CliAvailability } from './types.js';
export declare function parseGeminiJson(output: string): string;
export declare function buildGeminiArgs(options: CallOptions): string[];
export declare function checkGeminiAvailability(): CliAvailability;
export declare function callGemini(options: CallOptions): Promise<CallResult>;
