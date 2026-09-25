import { describe, it, expect } from 'vitest';
import { zodToJsonSchema } from 'zod-to-json-schema';
import {
  CodeQualityResultSchema,
  TestCoverageResultSchema,
  RefactoringSuggestionSchema,
} from '../src/types/analysis-results.js';
import { ReviewReportSchema } from '../src/types/report-types.js';

describe('CodeQualityResultSchema', () => {
  it('accepts valid data', () => {
    const valid = {
      file: 'src/example.ts',
      issues: [
        {
          line: 42,
          severity: 'high',
          category: 'security',
          description: 'Potential SQL injection via string concatenation',
          suggestion: 'Use parameterized queries',
        },
      ],
      overallScore: 78,
      summary: 'One high-severity security issue found.',
    };
    expect(() => CodeQualityResultSchema.parse(valid)).not.toThrow();
  });

  it('accepts an empty issues array', () => {
    const valid = {
      file: 'src/clean.ts',
      issues: [],
      overallScore: 100,
      summary: 'No issues found.',
    };
    expect(() => CodeQualityResultSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid severity enum value', () => {
    const invalid = {
      file: 'src/example.ts',
      issues: [
        { line: 1, severity: 'super-critical', category: 'security', description: 'x', suggestion: 'y' },
      ],
      overallScore: 50,
      summary: 'x',
    };
    expect(() => CodeQualityResultSchema.parse(invalid)).toThrow();
  });

  it('rejects a score outside 0-100', () => {
    const invalid = { file: 'src/example.ts', issues: [], overallScore: 150, summary: 'x' };
    expect(() => CodeQualityResultSchema.parse(invalid)).toThrow();
  });

  it('accepts boundary scores of 0 and 100', () => {
    const zero = { file: 'a.ts', issues: [], overallScore: 0, summary: 'x' };
    const hundred = { file: 'a.ts', issues: [], overallScore: 100, summary: 'x' };
    expect(() => CodeQualityResultSchema.parse(zero)).not.toThrow();
    expect(() => CodeQualityResultSchema.parse(hundred)).not.toThrow();
  });

  it('rejects missing required fields', () => {
    expect(() => CodeQualityResultSchema.parse({ file: 'src/example.ts' })).toThrow();
  });
});

describe('TestCoverageResultSchema', () => {
  it('accepts valid data', () => {
    const valid = {
      file: 'src/example.ts',
      hasTests: true,
      testFiles: ['src/example.test.ts'],
      untestedPaths: [
        { type: 'function', location: 'parseConfig()', priority: 'high', reasoning: 'No test covers the error path', suggestedTest: 'Test that parseConfig() throws on missing apiKey' },
      ],
      coverageEstimate: 65,
      summary: 'Mostly covered, missing error-path tests.',
    };
    expect(() => TestCoverageResultSchema.parse(valid)).not.toThrow();
  });

  it('accepts an empty testFiles array when hasTests is false', () => {
    const valid = { file: 'src/untested.ts', hasTests: false, testFiles: [], untestedPaths: [], coverageEstimate: 0, summary: 'No tests found.' };
    expect(() => TestCoverageResultSchema.parse(valid)).not.toThrow();
  });

  it('rejects an invalid priority enum value', () => {
    const invalid = {
      file: 'src/example.ts', hasTests: true, testFiles: [],
      untestedPaths: [{ type: 'function', location: 'x', priority: 'urgent', reasoning: 'x', suggestedTest: 'x' }],
      coverageEstimate: 50, summary: 'x',
    };
    expect(() => TestCoverageResultSchema.parse(invalid)).toThrow();
  });

  it('rejects wrong types for hasTests', () => {
    const invalid = { file: 'src/example.ts', hasTests: 'yes', testFiles: [], untestedPaths: [], coverageEstimate: 50, summary: 'x' };
    expect(() => TestCoverageResultSchema.parse(invalid)).toThrow();
  });
});

describe('RefactoringSuggestionSchema', () => {
  it('accepts valid data', () => {
    const valid = {
      file: 'src/example.ts',
      suggestions: [
        { type: 'extract-function', location: 'processOrder()', impact: 'medium', description: 'Function does too much; split validation from processing', before: 'function processOrder(o) { /* ... */ }', after: 'function validateOrder(o) {...}\nfunction processOrder(o) {...}', benefits: 'Improves testability and readability' },
      ],
      summary: 'One extract-function opportunity found.',
    };
    expect(() => RefactoringSuggestionSchema.parse(valid)).not.toThrow();
  });

  it('accepts an empty suggestions array', () => {
    expect(() => RefactoringSuggestionSchema.parse({ file: 'src/clean.ts', suggestions: [], summary: 'No suggestions.' })).not.toThrow();
  });

  it('rejects an invalid type enum value', () => {
    const invalid = {
      file: 'src/example.ts',
      suggestions: [{ type: 'delete-everything', location: 'x', impact: 'low', description: 'x', before: 'x', after: 'x', benefits: 'x' }],
      summary: 'x',
    };
    expect(() => RefactoringSuggestionSchema.parse(invalid)).toThrow();
  });
});

describe('ReviewReportSchema', () => {
  const validReport = {
    pullRequest: { owner: 'octocat', repo: 'Hello-World', number: 1 },
    fileReviews: [
      {
        file: 'src/example.ts',
        codeQuality: { file: 'src/example.ts', issues: [], overallScore: 90, summary: 'Looks good.' },
        testCoverage: { file: 'src/example.ts', hasTests: true, testFiles: ['src/example.test.ts'], untestedPaths: [], coverageEstimate: 90, summary: 'Well covered.' },
        refactorings: { file: 'src/example.ts', suggestions: [], summary: 'No changes needed.' },
      },
    ],
    summary: { totalFiles: 1, overallScore: 90, criticalIssues: 0, highPriorityTests: 0, refactoringOpportunities: 0 },
    recommendations: [{ priority: 'low', category: 'style', description: 'Minor style nit', files: ['src/example.ts'] }],
    metadata: { analyzedAt: new Date().toISOString(), duration: 12345, agentVersions: { 'code-quality-analyzer': '1.0.0' } },
  };

  it('accepts a fully valid report', () => {
    expect(() => ReviewReportSchema.parse(validReport)).not.toThrow();
  });

  it('accepts an empty fileReviews array (edge case)', () => {
    const edgeCase = { ...validReport, fileReviews: [], summary: { ...validReport.summary, totalFiles: 0 } };
    expect(() => ReviewReportSchema.parse(edgeCase)).not.toThrow();
  });

  it('rejects a report missing the pullRequest field', () => {
    const { pullRequest, ...invalid } = validReport;
    expect(() => ReviewReportSchema.parse(invalid)).toThrow();
  });

  it('rejects an invalid recommendation priority', () => {
    const invalid = { ...validReport, recommendations: [{ priority: 'urgent', category: 'x', description: 'x', files: [] }] };
    expect(() => ReviewReportSchema.parse(invalid)).toThrow();
  });
});

describe('JSON Schema export', () => {
  it('produces a valid JSON schema object for ReviewReportSchema', () => {
    const jsonSchema = zodToJsonSchema(ReviewReportSchema, { $refStrategy: 'root' });
    expect(jsonSchema).toBeTypeOf('object');
    expect(jsonSchema).toHaveProperty('properties');
  });

  it('marks required top-level properties correctly', () => {
    const jsonSchema = zodToJsonSchema(ReviewReportSchema, { $refStrategy: 'root' }) as { required?: string[] };
    expect(jsonSchema.required).toEqual(
      expect.arrayContaining(['pullRequest', 'fileReviews', 'summary', 'recommendations', 'metadata'])
    );
  });
});
