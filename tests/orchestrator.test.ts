import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@anthropic-ai/claude-agent-sdk', () => ({
  query: vi.fn(),
}));

import { query } from '@anthropic-ai/claude-agent-sdk';
import { CodeReviewOrchestrator } from '../src/orchestrator.js';

function mockAsyncIterable(messages: unknown[]) {
  return {
    [Symbol.asyncIterator]() {
      let i = 0;
      return {
        next: async () => {
          if (i < messages.length) {
            return { value: messages[i++], done: false };
          }
          return { value: undefined, done: true };
        },
      };
    },
  };
}

const validReport = {
  pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
  fileReviews: [
    {
      file: 'README',
      codeQuality: { file: 'README', issues: [], overallScore: 90, summary: 'Looks fine.' },
      testCoverage: {
        file: 'README',
        hasTests: false,
        testFiles: [],
        untestedPaths: [],
        coverageEstimate: 0,
        summary: 'Documentation file, no tests applicable.',
      },
      refactorings: { file: 'README', suggestions: [], summary: 'No changes needed.' },
    },
  ],
  summary: {
    totalFiles: 1,
    overallScore: 90,
    criticalIssues: 0,
    highPriorityTests: 0,
    refactoringOpportunities: 0,
  },
  recommendations: [],
  metadata: {
    analyzedAt: new Date().toISOString(),
    duration: 100,
    agentVersions: {},
  },
};

describe('CodeReviewOrchestrator', () => {
  beforeEach(() => {
    vi.mocked(query).mockReset();
  });

  describe('Configuration', () => {
    it('should initialize with default options', () => {
      const orchestrator = new CodeReviewOrchestrator();
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });

    it('should accept custom rate limit configuration', () => {
      const orchestrator = new CodeReviewOrchestrator({
        rateLimits: { maxRequestsPerMinute: 10, maxConcurrent: 2, maxTokensPerMinute: 5000 },
      });
      expect(orchestrator).toBeInstanceOf(CodeReviewOrchestrator);
    });
  });

  describe('reviewPullRequest', () => {
    it('should fetch PR files from GitHub MCP', async () => {
      vi.mocked(query).mockReturnValue(
        mockAsyncIterable([{ type: 'result', structured_output: validReport }]) as ReturnType<typeof query>
      );

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(query).toHaveBeenCalledTimes(1);
      const callArgs = vi.mocked(query).mock.calls[0]![0] as any;
      expect(callArgs.options.mcpServers).toBeDefined();
      expect(callArgs.options.mcpServers.github).toBeDefined();
      expect(callArgs.prompt).toContain('octocat/Hello-World');
    });

    it('should spawn all 3 subagents in parallel', async () => {
      vi.mocked(query).mockReturnValue(
        mockAsyncIterable([{ type: 'result', structured_output: validReport }]) as ReturnType<typeof query>
      );

      const orchestrator = new CodeReviewOrchestrator();
      await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      const callArgs = vi.mocked(query).mock.calls[0]![0] as any;
      expect(Object.keys(callArgs.options.agents)).toEqual(
        expect.arrayContaining([
          'code-quality-analyzer',
          'test-coverage-analyzer',
          'refactoring-suggester',
        ])
      );
      expect(callArgs.options.allowedTools).toContain('Task');
    });

    it('should aggregate results into ReviewReport', async () => {
      vi.mocked(query).mockReturnValue(
        mockAsyncIterable([{ type: 'result', structured_output: validReport }]) as ReturnType<typeof query>
      );

      const orchestrator = new CodeReviewOrchestrator();
      const result = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(result.pullRequest).toEqual({ owner: 'octocat', repo: 'Hello-World', number: 1 });
      expect(result.fileReviews).toHaveLength(1);
      expect(result.summary.overallScore).toBe(90);
    });

    it('should validate output with Zod schema', async () => {
      vi.mocked(query).mockReturnValue(
        mockAsyncIterable([{ type: 'result', structured_output: validReport }]) as ReturnType<typeof query>
      );

      const orchestrator = new CodeReviewOrchestrator();
      const result = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);

      expect(result).toMatchObject({
        pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
      });
    });

    it('throws a clear error when the SDK never produces a structured_output', async () => {
      vi.mocked(query).mockReturnValue(mockAsyncIterable([{ type: 'result' }]) as ReturnType<typeof query>);

      const orchestrator = new CodeReviewOrchestrator({ maxTurns: 1 });
      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow();
    }, 10000);

    it('throws when the SDK output fails schema validation', async () => {
      vi.mocked(query).mockReturnValue(
        mockAsyncIterable([{ type: 'result', structured_output: { not: 'a valid report' } }]) as any
      );

      const orchestrator = new CodeReviewOrchestrator({ maxTurns: 1 });
      await expect(
        orchestrator.reviewPullRequest('octocat', 'Hello-World', 1)
      ).rejects.toThrow();
    }, 10000);
  });

  describe('Integration', () => {
    it.skip('should review a real small PR', async () => {
      const orchestrator = new CodeReviewOrchestrator();
      const result = await orchestrator.reviewPullRequest('octocat', 'Hello-World', 1);
      expect(result.pullRequest.owner).toBe('octocat');
    });
  });
});

