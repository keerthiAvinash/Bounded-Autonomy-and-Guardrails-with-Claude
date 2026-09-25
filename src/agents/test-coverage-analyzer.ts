import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { testCoverageAnalyzerPrompt } from '../prompts/test-coverage-analyzer.prompt.js';

export const testCoverageAnalyzer: AgentDefinition = {
  description:
    'Evaluates test completeness for a source code file by locating and reading its corresponding test files, then identifies untested functions, classes, and edge cases with prioritized, actionable test suggestions. Use this agent to assess test coverage for any file in the pull request.',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  prompt: testCoverageAnalyzerPrompt,
  model: 'inherit',
};
