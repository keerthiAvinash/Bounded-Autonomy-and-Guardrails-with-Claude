import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { codeQualityAnalyzerPrompt } from '../prompts/code-quality-analyzer.prompt.js';

export const codeQualityAnalyzer: AgentDefinition = {
  description:
    'Analyzes a source code file for security vulnerabilities, performance issues, and maintainability concerns, and returns severity-leveled findings. Use this agent to review code quality for any file in the pull request.',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  prompt: codeQualityAnalyzerPrompt,
  model: 'inherit',
};
