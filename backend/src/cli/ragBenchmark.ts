#!/usr/bin/env node

/**
 * RAG Benchmark CLI Tool
 *
 * Usage:
 *   npx ts-node src/cli/ragBenchmark.ts dataset create --name "Test" --twin <id>
 *   npx ts-node src/cli/ragBenchmark.ts dataset list --twin <id>
 *   npx ts-node src/cli/ragBenchmark.ts run create --dataset <id> --name "Baseline"
 *   npx ts-node src/cli/ragBenchmark.ts run start <runId>
 *   npx ts-node src/cli/ragBenchmark.ts compare <runA> <runB>
 */

import { Command } from 'commander';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

// Load environment
dotenv.config();

// Initialize database connection
import { pool } from '../config/database';

// Services
import datasetService from '../services/benchmark/datasetService';
import testRunnerService from '../services/benchmark/testRunnerService';

// CLI Interface for Dataset (with string dates for JSON output)
interface DatasetCLI {
  id: string;
  name: string;
  dataset_type: string;
  description?: string;
  is_active: boolean;
  created_at: string;
  active_questions?: number;
  kb_id: string;
  total_questions?: number;
}

interface DatasetStats {
  total_questions: number;
  simple_count: number;
  complex_count: number;
  multi_hop_count: number;
  easy_count: number;
  medium_count: number;
  hard_count: number;
}

// CLI Interface for Question (matching DB schema)
interface _QuestionCLI {
  id: string;
  question: string;
  question_type: string;
  difficulty: string;
}

// CLI Interface for BenchmarkRun
interface BenchmarkRunCLI {
  id: string;
  name?: string;
  status: string;
  progress: number;
  run_type: string;
  dataset_id: string;
  dataset_name?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error_message?: string;
  aggregate_metrics?: {
    overall?: {
      successful: number;
      total_questions: number;
    };
  };
}

interface RunResult {
  aggregateMetrics: {
    retrieval: {
      context_precision: number;
      context_recall: number;
      mrr: number;
      ndcg: number;
      hit_rate: number;
      avg_latency_ms: number;
    };
    generation: {
      faithfulness: number;
      answer_relevance: number;
      avg_latency_ms: number;
    };
    overall: {
      success_rate: number;
      total_questions: number;
      avg_total_latency_ms: number;
    };
  };
}

interface QuestionResult {
  input_question: string;
  generated_answer?: string;
  total_latency_ms?: number;
  metrics?: {
    retrieval?: {
      precision?: number;
      recall?: number;
    };
  };
}

interface ComparisonData {
  name: string;
  a: number;
  b: number;
  pct_change: number;
  better: 'a' | 'b' | 'tie';
}

interface Comparison {
  runA: { id: string; name?: string };
  runB: { id: string; name?: string };
  comparison: Record<string, ComparisonData>;
  summary: {
    aWins: number;
    bWins: number;
    ties: number;
    winner: 'a' | 'b' | 'tie';
  };
}

const program = new Command();

program
  .name('rag-benchmark')
  .description('RAG Benchmark CLI for VirtualCoach')
  .version('1.0.0');

// ==================== DATASET COMMANDS ====================

const datasetCmd = program.command('dataset').description('Manage benchmark datasets');

datasetCmd
  .command('create')
  .description('Create a new benchmark dataset')
  .requiredOption('--name <name>', 'Dataset name')
  .requiredOption('--twin <kbId>', 'Knowledge Base ID')
  .option('--type <type>', 'Dataset type (golden|synthetic|hybrid)', 'golden')
  .option('--description <desc>', 'Dataset description')
  .action(async (options: { name: string; twin: string; type: string; description?: string }) => {
    try {
      const dataset = await datasetService.createDataset(options.twin, {
        name: options.name,
        description: options.description || '',
        datasetType: options.type
      });

      // Convert Date to string for CLI display
      const datasetCLI: DatasetCLI = {
        ...dataset,
        created_at: dataset.created_at instanceof Date ? dataset.created_at.toISOString() : dataset.created_at
      };

      console.log('\n✅ Dataset created successfully!\n');
      console.log(`  ID:   ${datasetCLI.id}`);
      console.log(`  Name: ${datasetCLI.name}`);
      console.log(`  Type: ${datasetCLI.dataset_type}`);
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

datasetCmd
  .command('list')
  .description('List datasets for a twin')
  .requiredOption('--twin <kbId>', 'Knowledge Base ID')
  .option('--all', 'Include inactive datasets')
  .action(async (options: { twin: string; all?: boolean }) => {
    try {
      const datasets = await datasetService.listDatasets(options.twin, {
        includeInactive: options.all
      });

      if (datasets.length === 0) {
        console.log('\nNo datasets found.\n');
      } else {
        console.log(`\n📊 Found ${datasets.length} dataset(s):\n`);
        console.log('─'.repeat(80));

        for (const ds of datasets) {
          const createdDate = ds.created_at instanceof Date ? ds.created_at : new Date(ds.created_at);
          console.log(`  ${ds.name}`);
          console.log(`    ID:        ${ds.id}`);
          console.log(`    Type:      ${ds.dataset_type}`);
          console.log(`    Questions: ${ds.active_questions || 0}`);
          console.log(`    Created:   ${createdDate.toLocaleDateString()}`);
          console.log('');
        }
      }

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

datasetCmd
  .command('info')
  .description('Get dataset details')
  .argument('<datasetId>', 'Dataset ID')
  .action(async (datasetId: string) => {
    try {
      const dataset = await datasetService.getDataset(datasetId);

      if (!dataset) {
        console.log('\n❌ Dataset not found.\n');
        await pool.end();
        process.exit(1);
      }

      const stats: DatasetStats = await datasetService.getDatasetStats(datasetId);
      const createdDate = dataset.created_at instanceof Date ? dataset.created_at : new Date(dataset.created_at);

      console.log(`\n📊 Dataset: ${dataset.name}\n`);
      console.log('─'.repeat(50));
      console.log(`  ID:          ${dataset.id}`);
      console.log(`  Type:        ${dataset.dataset_type}`);
      console.log(`  Description: ${dataset.description || '(none)'}`);
      console.log(`  Active:      ${dataset.is_active ? 'Yes' : 'No'}`);
      console.log(`  Created:     ${createdDate.toLocaleString()}`);
      console.log('');
      console.log('  📝 Questions:');
      console.log(`    Total:     ${stats.total_questions}`);
      console.log(`    Simple:    ${stats.simple_count}`);
      console.log(`    Complex:   ${stats.complex_count}`);
      console.log(`    Multi-hop: ${stats.multi_hop_count}`);
      console.log('');
      console.log('  🎯 Difficulty:');
      console.log(`    Easy:   ${stats.easy_count}`);
      console.log(`    Medium: ${stats.medium_count}`);
      console.log(`    Hard:   ${stats.hard_count}`);
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

datasetCmd
  .command('add-question')
  .description('Add a question to a dataset')
  .requiredOption('--dataset <datasetId>', 'Dataset ID')
  .requiredOption('--question <text>', 'Question text')
  .option('--answer <text>', 'Expected answer')
  .option('--type <type>', 'Question type (simple|complex|multi_hop)', 'simple')
  .option('--difficulty <level>', 'Difficulty (easy|medium|hard)', 'medium')
  .action(async (options: { dataset: string; question: string; answer?: string; type: string; difficulty: string }) => {
    try {
      const question = await datasetService.addQuestion(options.dataset, {
        question: options.question,
        expectedAnswer: options.answer,
        questionType: options.type,
        difficulty: options.difficulty
      });

      console.log('\n✅ Question added!\n');
      console.log(`  ID: ${question.id}`);
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

datasetCmd
  .command('import')
  .description('Import dataset from JSON file')
  .requiredOption('--twin <kbId>', 'Knowledge Base ID')
  .requiredOption('--file <path>', 'JSON file path')
  .action(async (options: { twin: string; file: string }) => {
    try {
      const data = JSON.parse(fs.readFileSync(options.file, 'utf8'));

      const dataset = await datasetService.importFromJson(options.twin, data);

      console.log('\n✅ Dataset imported!\n');
      console.log(`  ID:        ${dataset.id}`);
      console.log(`  Name:      ${dataset.name}`);
      console.log(`  Questions: ${dataset.total_questions}`);
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

datasetCmd
  .command('export')
  .description('Export dataset to JSON')
  .argument('<datasetId>', 'Dataset ID')
  .option('--output <path>', 'Output file path')
  .action(async (datasetId: string, options: { output?: string }) => {
    try {
      const data = await datasetService.exportToJson(datasetId);

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(data, null, 2));
        console.log(`\n✅ Dataset exported to ${options.output}\n`);
      } else {
        console.log(JSON.stringify(data, null, 2));
      }

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

datasetCmd
  .command('generate')
  .description('Generate synthetic Q&A pairs from knowledge base')
  .requiredOption('--dataset <datasetId>', 'Target dataset ID')
  .option('--count <n>', 'Number of questions to generate', '20')
  .option('--types <types>', 'Question types (comma-separated: simple,complex,multi_hop)', 'simple,complex')
  .option('--difficulties <diffs>', 'Difficulties (comma-separated: easy,medium,hard)', 'easy,medium,hard')
  .action(async (options: { dataset: string; count: string; types: string; difficulties: string }) => {
    try {
      const syntheticGeneratorService = await import('../services/benchmark/syntheticGeneratorService');

      const dataset = await datasetService.getDataset(options.dataset);
      if (!dataset) {
        console.error('❌ Dataset not found');
        await pool.end();
        process.exit(1);
      }

      console.log('\n🤖 Generating synthetic questions...\n');

      const types = options.types.split(',').map(t => t.trim());
      const difficulties = options.difficulties.split(',').map(d => d.trim());
      const count = parseInt(options.count);

      const onProgress = (progress: number, current: number, total: number): void => {
        process.stdout.write(`\r  Progress: ${progress}% (${current}/${total})`);
      };

      const generated = await syntheticGeneratorService.default.generateFromKnowledgeBase(
        dataset.kb_id,
        { count, types, difficulties, onProgress }
      );

      // Convert GeneratedQA to format expected by bulkAddQuestions
      if (generated.length > 0) {
        const formattedQuestions = generated.map(qa => ({
          question: qa.question,
          expectedAnswer: qa.expectedAnswer,
          questionType: qa.questionType || 'simple',
          difficulty: qa.difficulty || 'medium',
          sourceType: qa.sourceType,
          sourceKbIds: qa.sourceKbIds
        }));
        await datasetService.bulkAddQuestions(options.dataset, formattedQuestions);
      }

      console.log(`\n\n✅ Generated ${generated.length} questions!\n`);

      // Show sample
      if (generated.length > 0) {
        console.log('  Sample question:');
        console.log(`    Q: ${generated[0].question.substring(0, 80)}...`);
        console.log(`    Type: ${generated[0].questionType || 'simple'}, Difficulty: ${generated[0].difficulty || 'medium'}`);
      }
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('\n❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

// ==================== RUN COMMANDS ====================

const runCmd = program.command('run').description('Manage benchmark runs');

runCmd
  .command('create')
  .description('Create a new benchmark run')
  .requiredOption('--dataset <datasetId>', 'Dataset ID')
  .option('--name <name>', 'Run name')
  .option('--type <type>', 'Run type (full|retrieval_only|generation_only)', 'full')
  .action(async (options: { dataset: string; name?: string; type: string }) => {
    try {
      // Get dataset to find kb_id
      const dataset = await datasetService.getDataset(options.dataset);
      if (!dataset) {
        console.error('❌ Dataset not found');
        await pool.end();
        process.exit(1);
      }

      const run = await testRunnerService.createRun(dataset.kb_id, options.dataset, {
        name: options.name || `Run ${new Date().toISOString().slice(0, 16)}`,
        runType: options.type
      });

      console.log('\n✅ Run created!\n');
      console.log(`  ID:      ${run.id}`);
      console.log(`  Name:    ${run.name || 'Unnamed'}`);
      console.log(`  Status:  ${run.status}`);
      console.log(`  Type:    ${run.run_type}`);
      console.log('');
      console.log('  To start: npx ts-node src/cli/ragBenchmark.ts run start ' + run.id);
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

runCmd
  .command('list')
  .description('List runs for a twin')
  .requiredOption('--twin <kbId>', 'Knowledge Base ID')
  .option('--status <status>', 'Filter by status')
  .option('--limit <n>', 'Limit results', '10')
  .action(async (options: { twin: string; status?: string; limit: string }) => {
    try {
      const runs = await testRunnerService.listRuns(options.twin, {
        status: options.status,
        limit: parseInt(options.limit)
      });

      if (runs.length === 0) {
        console.log('\nNo runs found.\n');
      } else {
        console.log(`\n🏃 Found ${runs.length} run(s):\n`);
        console.log('─'.repeat(90));

        for (const run of runs) {
          const statusIcon: Record<string, string> = {
            pending: '⏳',
            running: '🔄',
            completed: '✅',
            failed: '❌',
            cancelled: '🚫'
          };

          const runWithExtras = run as unknown as BenchmarkRunCLI;
          const createdDate = new Date(String(runWithExtras.created_at));
          const progress = runWithExtras.progress || 0;

          console.log(`  ${statusIcon[run.status] || '❓'} ${run.name || 'Unnamed'}`);
          console.log(`    ID:       ${run.id}`);
          console.log(`    Dataset:  ${runWithExtras.dataset_name || run.dataset_id}`);
          console.log(`    Status:   ${run.status} (${progress}%)`);
          console.log(`    Created:  ${createdDate.toLocaleString()}`);

          if (runWithExtras.aggregate_metrics?.overall) {
            const m = runWithExtras.aggregate_metrics.overall;
            console.log(`    Results:  ${m.successful}/${m.total_questions} successful`);
          }
          console.log('');
        }
      }

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

runCmd
  .command('start')
  .description('Start a benchmark run')
  .argument('<runId>', 'Run ID')
  .option('--verbose', 'Show detailed progress')
  .action(async (runId: string, options: { verbose?: boolean }) => {
    try {
      console.log('\n🚀 Starting benchmark run...\n');

      const onProgress = (progress: number, current: number, total: number): void => {
        if (options.verbose) {
          console.log(`  [${progress}%] Question ${current}/${total}`);
        } else {
          process.stdout.write(`\r  Progress: ${progress}% (${current}/${total})`);
        }
      };

      const result: RunResult = await testRunnerService.executeRun(runId, { onProgress });

      console.log('\n\n✅ Benchmark completed!\n');
      console.log('─'.repeat(50));

      const metrics = result.aggregateMetrics;

      console.log('\n📊 Retrieval Metrics:');
      console.log(`  Context Precision: ${(metrics.retrieval.context_precision * 100).toFixed(1)}%`);
      console.log(`  Context Recall:    ${(metrics.retrieval.context_recall * 100).toFixed(1)}%`);
      console.log(`  MRR:               ${(metrics.retrieval.mrr * 100).toFixed(1)}%`);
      console.log(`  NDCG:              ${(metrics.retrieval.ndcg * 100).toFixed(1)}%`);
      console.log(`  Hit Rate:          ${(metrics.retrieval.hit_rate * 100).toFixed(1)}%`);
      console.log(`  Avg Latency:       ${metrics.retrieval.avg_latency_ms}ms`);

      if (metrics.generation.faithfulness > 0) {
        console.log('\n📝 Generation Metrics:');
        console.log(`  Faithfulness:      ${(metrics.generation.faithfulness * 100).toFixed(1)}%`);
        console.log(`  Answer Relevance:  ${(metrics.generation.answer_relevance * 100).toFixed(1)}%`);
        console.log(`  Avg Latency:       ${metrics.generation.avg_latency_ms}ms`);
      }

      console.log('\n📈 Overall:');
      console.log(`  Success Rate:      ${(metrics.overall.success_rate * 100).toFixed(1)}%`);
      console.log(`  Total Questions:   ${metrics.overall.total_questions}`);
      console.log(`  Avg Total Latency: ${metrics.overall.avg_total_latency_ms}ms`);
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('\n❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

runCmd
  .command('status')
  .description('Check run status')
  .argument('<runId>', 'Run ID')
  .action(async (runId: string) => {
    try {
      const run = await testRunnerService.getRun(runId);

      if (!run) {
        console.log('\n❌ Run not found.\n');
        await pool.end();
        process.exit(1);
      }

      const statusIcon: Record<string, string> = {
        pending: '⏳',
        running: '🔄',
        completed: '✅',
        failed: '❌',
        cancelled: '🚫'
      };

      const runWithExtras = run as unknown as BenchmarkRunCLI;
      const progress = runWithExtras.progress || 0;

      console.log(`\n${statusIcon[run.status] || '❓'} Run: ${run.name || 'Unnamed'}\n`);
      console.log('─'.repeat(50));
      console.log(`  ID:       ${run.id}`);
      console.log(`  Status:   ${run.status}`);
      console.log(`  Progress: ${progress}%`);
      console.log(`  Type:     ${run.run_type}`);
      console.log(`  Dataset:  ${runWithExtras.dataset_name || run.dataset_id}`);

      if (runWithExtras.started_at) {
        const startedDate = new Date(String(runWithExtras.started_at));
        console.log(`  Started:  ${startedDate.toLocaleString()}`);
      }
      if (runWithExtras.completed_at) {
        const completedDate = new Date(String(runWithExtras.completed_at));
        console.log(`  Finished: ${completedDate.toLocaleString()}`);
      }
      if (runWithExtras.error_message) {
        console.log(`  Error:    ${runWithExtras.error_message}`);
      }
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

runCmd
  .command('results')
  .description('Show run results')
  .argument('<runId>', 'Run ID')
  .option('--limit <n>', 'Limit results', '10')
  .action(async (runId: string, options: { limit: string }) => {
    try {
      const run = await testRunnerService.getRun(runId);
      if (!run) {
        console.error('❌ Run not found');
        await pool.end();
        process.exit(1);
      }

      const results = await testRunnerService.getRunResults(runId, {
        limit: parseInt(options.limit)
      }) as unknown as QuestionResult[];

      console.log(`\n📊 Results for: ${run.name || 'Unnamed'}\n`);
      console.log('─'.repeat(80));

      for (const r of results) {
        const metrics = r.metrics || {};
        const retrieval = metrics.retrieval || {};

        console.log(`\n  Q: ${r.input_question.substring(0, 60)}...`);
        console.log(`     Precision: ${((retrieval.precision || 0) * 100).toFixed(0)}%`);
        console.log(`     Recall:    ${((retrieval.recall || 0) * 100).toFixed(0)}%`);
        console.log(`     Latency:   ${r.total_latency_ms || 0}ms`);

        if (r.generated_answer) {
          console.log(`     Answer:    ${r.generated_answer.substring(0, 50)}...`);
        }
      }
      console.log('');

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

// ==================== COMPARE COMMAND ====================

program
  .command('compare')
  .description('Compare two benchmark runs')
  .argument('<runA>', 'First run ID')
  .argument('<runB>', 'Second run ID')
  .option('--format <format>', 'Output format (table|json)', 'table')
  .action(async (runA: string, runB: string, options: { format: string }) => {
    try {
      const comparison = await testRunnerService.compareRuns(runA, runB) as unknown as Comparison;

      if (options.format === 'json') {
        console.log(JSON.stringify(comparison, null, 2));
      } else {
        console.log('\n📊 Benchmark Comparison\n');
        console.log('─'.repeat(70));
        console.log(`  Run A: ${comparison.runA.name || comparison.runA.id}`);
        console.log(`  Run B: ${comparison.runB.name || comparison.runB.id}`);
        console.log('─'.repeat(70));

        console.log('\n  Metric                    A         B        Diff     Better');
        console.log('  ' + '─'.repeat(62));

        for (const [_key, data] of Object.entries(comparison.comparison)) {
          const isLatency = data.name.includes('Latency');
          const aVal = isLatency ? `${data.a}ms` : `${(data.a * 100).toFixed(1)}%`;
          const bVal = isLatency ? `${data.b}ms` : `${(data.b * 100).toFixed(1)}%`;
          const diff = data.pct_change >= 0 ? `+${data.pct_change.toFixed(1)}%` : `${data.pct_change.toFixed(1)}%`;
          const better = data.better === 'a' ? '← A' : data.better === 'b' ? 'B →' : 'tie';

          console.log(`  ${data.name.padEnd(22)} ${aVal.padStart(8)} ${bVal.padStart(8)} ${diff.padStart(10)} ${better.padStart(8)}`);
        }

        console.log('\n  ' + '─'.repeat(62));
        console.log(`  Summary: A wins ${comparison.summary.aWins}, B wins ${comparison.summary.bWins}, ties ${comparison.summary.ties}`);
        console.log(`  Winner:  ${comparison.summary.winner === 'tie' ? 'Tie' : comparison.summary.winner.toUpperCase()}`);
        console.log('');
      }

      await pool.end();
    } catch (error) {
      console.error('❌ Error:', (error as Error).message);
      await pool.end();
      process.exit(1);
    }
  });

// Parse arguments
program.parse();
