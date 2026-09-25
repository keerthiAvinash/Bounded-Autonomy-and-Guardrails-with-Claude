import { query } from '@anthropic-ai/claude-agent-sdk';
import { ReviewReportSchema, ReviewReportJSONSchema, ReviewReport } from './types/report-types.js';
import { mcpServersConfig } from './config/mcp.config.js';
import { codeQualityAnalyzer, testCoverageAnalyzer, refactoringSuggester } from './agents/index.js';
import { orchestratorPrompt } from './prompts/orchestrator.prompt.js';
import { RateLimiter, RateLimiterConfig } from './utils/rate-limiter.js';
import { withRetry, withTimeout, ReviewError, ErrorCodes, formatError } from './utils/error-handler.js';

export interface OrchestratorOptions {
  rateLimits?: Partial<RateLimiterConfig>;
  maxTurns?: number;
  timeoutMs?: number;
}

export class CodeReviewOrchestrator {
  private rateLimiter: RateLimiter;
  private maxTurns: number;
  private timeoutMs: number;

  constructor(options: OrchestratorOptions = {}) {
    this.rateLimiter = new RateLimiter(options.rateLimits ?? {});
    this.maxTurns = options.maxTurns ?? 50;
    this.timeoutMs = options.timeoutMs ?? 300000;
  }

  async reviewPullRequest(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    await this.rateLimiter.acquire();

    try {
      return await withRetry(() =>
        withTimeout(
          () => this.runQuery(owner, repo, prNumber),
          this.timeoutMs,
          `Review of ${owner}/${repo}#${prNumber} timed out`
        )
      );
    } finally {
      this.rateLimiter.release();
    }
  }

  private async runQuery(
    owner: string,
    repo: string,
    prNumber: number
  ): Promise<ReviewReport> {
    const userPrompt = `${orchestratorPrompt}\n\nAnalyze pull request #${prNumber} in ${owner}/${repo}.`;

    const result = query({
      prompt: userPrompt,
      options: {
        agents: {
          'code-quality-analyzer': codeQualityAnalyzer,
          'test-coverage-analyzer': testCoverageAnalyzer,
          'refactoring-suggester': refactoringSuggester,
        },
        mcpServers: mcpServersConfig,
        allowedTools: [
          'Task',
          'Read',
          'Grep',
          'Glob',
          'Skill',
          'mcp__github__pull_request_read',
          'mcp__github__get_pull_request_files',
          'mcp__eslint__lint-files',
        ],
        model: process.env.ANTHROPIC_MODEL,
        maxTurns: this.maxTurns,
        permissionMode: 'bypassPermissions',
        outputFormat: {
          type: 'json_schema',
          schema: ReviewReportJSONSchema,
        },
      },
    });

    let structuredOutput: unknown;

    for await (const message of result) {
      if (message.type === 'result' && 'structured_output' in message && message.structured_output) {
        structuredOutput = message.structured_output;
      }
    }

    if (!structuredOutput) {
      throw new ReviewError(
        'The SDK never produced a structured_output result',
        ErrorCodes.STRUCTURED_OUTPUT_FAILED,
        { owner, repo, prNumber }
      );
    }

    const parsed = ReviewReportSchema.safeParse(structuredOutput);

    if (!parsed.success) {
      throw new ReviewError(
        `Structured output failed schema validation: ${formatError(parsed.error)}`,
        ErrorCodes.VALIDATION_FAILED,
        { issues: parsed.error.issues }
      );
    }

    return parsed.data;
  }
}
