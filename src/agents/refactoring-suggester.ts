import type { AgentDefinition } from '@anthropic-ai/claude-agent-sdk';
import { refactoringSuggesterPrompt } from '../prompts/refactoring-suggester.prompt.js';

export const refactoringSuggester: AgentDefinition = {
  description:
    'Identifies opportunities to modernize, simplify, or restructure a source code file, providing before/after code examples for each suggestion. Use this agent to find refactoring opportunities for any file in the pull request.',
  tools: ['Read', 'Grep', 'Glob', 'Skill'],
  prompt: refactoringSuggesterPrompt,
  model: 'inherit',
};
