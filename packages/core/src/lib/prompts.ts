import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Loads the prompt pool from prompts.json at the core package root.
 * Falls back to an empty array if the file is not found.
 */
let _prompts: string[] = [];
try {
  const raw = readFileSync(join(__dirname, '../../prompts.json'), 'utf-8');
  _prompts = JSON.parse(raw) as string[];
} catch {
  // prompts.json optional — apps can seed their own
}

export function getRandomPrompt(): string {
  if (_prompts.length === 0) return 'An AI-generated image';
  return _prompts[Math.floor(Math.random() * _prompts.length)];
}

export function getAllPrompts(): string[] {
  return _prompts;
}
