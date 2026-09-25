import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import { CodeReviewOrchestrator } from './orchestrator.js';
import { ReportGenerator } from './utils/report-generator.js';
import { logger } from './utils/logger.js';
import { formatError } from './utils/error-handler.js';

dotenv.config();

async function main() {
  const [owner, repo, prStr] = process.argv.slice(2);

  if (!owner || !repo || !prStr) {
    console.error('Usage: npm run dev -- <owner> <repo> <pr-number>');
    console.error('Example: npm run dev -- octocat Hello-World 1');
    process.exit(1);
  }

  const prNumber = Number(prStr);
  if (!Number.isInteger(prNumber) || prNumber <= 0) {
    console.error(`Invalid PR number: "${prStr}". It must be a positive integer.`);
    process.exit(1);
  }

  const hasAnthropicKey = Boolean(process.env.ANTHROPIC_API_KEY);
  const hasAwsCreds = Boolean(
    process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
  );

  if (hasAwsCreds) {
    if (!process.env.AWS_REGION) {
      console.error(
        'AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY are set but AWS_REGION is missing. Set AWS_REGION in your .env.'
      );
      process.exit(1);
    }
    console.log('🔐 Using AWS Bedrock authentication');
  } else if (hasAnthropicKey) {
    console.log('🔐 Using Anthropic API authentication');
  } else {
    console.error(
      'No authentication configured. Set ONE of the following in your .env:\n' +
        '  - ANTHROPIC_API_KEY=sk-ant-...\n' +
        '  - AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY + AWS_REGION (for Bedrock)'
    );
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_MODEL) {
    console.error(
      'ANTHROPIC_MODEL environment variable is required. Example values:\n' +
        '  - Anthropic API: ANTHROPIC_MODEL=claude-sonnet-4-5-20250929\n' +
        '  - AWS Bedrock:   ANTHROPIC_MODEL=us.anthropic.claude-sonnet-4-5-20250929-v1:0'
    );
    process.exit(1);
  }

  console.log(`Starting review of ${owner}/${repo} PR #${prNumber}...`);

  try {
    const orchestrator = new CodeReviewOrchestrator();
    const report = await orchestrator.reviewPullRequest(owner, repo, prNumber);

    const reportGenerator = new ReportGenerator();
    const outDir = path.resolve(process.cwd(), 'reports');
    fs.mkdirSync(outDir, { recursive: true });

    const baseName = `${owner}_${repo}_${prNumber}`;
    const jsonPath = path.join(outDir, `${baseName}.json`);
    const mdPath = path.join(outDir, `${baseName}.md`);
    const htmlPath = path.join(outDir, `${baseName}.html`);

    fs.writeFileSync(jsonPath, reportGenerator.generateJSONReport(report));
    fs.writeFileSync(mdPath, reportGenerator.generateMarkdownReport(report));
    fs.writeFileSync(htmlPath, reportGenerator.generateHTMLReport(report));

    logger.info('Review complete. Reports saved:');
    logger.info(`  JSON:     ${path.relative(process.cwd(), jsonPath)}`);
    logger.info(`  Markdown: ${path.relative(process.cwd(), mdPath)}`);
    logger.info(`  HTML:     ${path.relative(process.cwd(), htmlPath)}`);
    logger.info(`  Overall score: ${report.summary.overallScore}/100`);
  } catch (error) {
    console.error('Error running code review:', formatError(error));
    process.exit(1);
  }
}

main();
