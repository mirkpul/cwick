/**
 * Benchmark Controller - Handles API requests for RAG benchmarking
 */

import { Response, NextFunction } from 'express';
import datasetService from '../services/benchmark/datasetService';
import testRunnerService from '../services/benchmark/testRunnerService';
import syntheticGeneratorService from '../services/benchmark/syntheticGeneratorService';
import llmJudgeService from '../services/benchmark/llmJudgeService';
import { AuthenticatedRequest } from '../middleware/auth';

interface ContextItem {
  content: string;
  source?: string;
  [key: string]: unknown;
}

class BenchmarkController {
  // ==================== DATASET ENDPOINTS ====================

  /**
   * POST /api/benchmark/datasets
   * Create a new dataset
   */
  async createDataset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twinId, name, description, datasetType, tags } = req.body;

      if (!twinId || !name) {
        res.status(400).json({ error: 'twinId and name are required' });
        return;
      }

      const dataset = await datasetService.createDataset(twinId, {
        name,
        description,
        datasetType,
        tags
      });

      res.status(201).json(dataset);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/benchmark/datasets
   * List datasets for a twin
   */
  async listDatasets(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twinId, includeInactive, limit, offset } = req.query;

      if (!twinId) {
        res.status(400).json({ error: 'twinId is required' });
        return;
      }

      const datasets = await datasetService.listDatasets(twinId as string, {
        includeInactive: includeInactive === 'true',
        limit: parseInt(limit as string) || 50,
        offset: parseInt(offset as string) || 0
      });

      res.json(datasets);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/benchmark/datasets/:datasetId
   * Get a single dataset
   */
  async getDataset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const dataset = await datasetService.getDataset(datasetId);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      // Include stats
      const stats = await datasetService.getDatasetStats(datasetId);
      res.json({ ...dataset, stats });
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/benchmark/datasets/:datasetId
   * Update a dataset
   */
  async updateDataset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const updates = req.body;

      const dataset = await datasetService.updateDataset(datasetId, updates);

      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      res.json(dataset);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/benchmark/datasets/:datasetId
   * Delete a dataset
   */
  async deleteDataset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const { hard } = req.query;

      const result = await datasetService.deleteDataset(datasetId, hard === 'true');
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ==================== QUESTION ENDPOINTS ====================

  /**
   * POST /api/benchmark/datasets/:datasetId/questions
   * Add a question to a dataset
   */
  async addQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const questionData = req.body;

      if (!questionData.question) {
        res.status(400).json({ error: 'question is required' });
        return;
      }

      const question = await datasetService.addQuestion(datasetId, questionData);
      res.status(201).json(question);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/benchmark/datasets/:datasetId/questions/bulk
   * Bulk add questions to a dataset
   */
  async bulkAddQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const { questions } = req.body;

      if (!questions || !Array.isArray(questions) || questions.length === 0) {
        res.status(400).json({ error: 'questions array is required' });
        return;
      }

      const results = await datasetService.bulkAddQuestions(datasetId, questions);
      res.status(201).json({ added: results.length, questions: results });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/benchmark/datasets/:datasetId/questions
   * List questions in a dataset
   */
  async listQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const { includeInactive, questionType, difficulty, limit, offset } = req.query;

      const questions = await datasetService.listQuestions(datasetId, {
        includeInactive: includeInactive === 'true',
        questionType: questionType as string,
        difficulty: difficulty as string,
        limit: parseInt(limit as string) || 100,
        offset: parseInt(offset as string) || 0
      });

      res.json(questions);
    } catch (error) {
      next(error);
    }
  }

  /**
   * PUT /api/benchmark/questions/:questionId
   * Update a question
   */
  async updateQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { questionId } = req.params;
      const updates = req.body;

      const question = await datasetService.updateQuestion(questionId, updates);

      if (!question) {
        res.status(404).json({ error: 'Question not found' });
        return;
      }

      res.json(question);
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/benchmark/questions/:questionId
   * Delete a question
   */
  async deleteQuestion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { questionId } = req.params;
      const { hard } = req.query;

      const result = await datasetService.deleteQuestion(questionId, hard === 'true');

      if (!result) {
        res.status(404).json({ error: 'Question not found' });
        return;
      }

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ==================== IMPORT/EXPORT ====================

  /**
   * POST /api/benchmark/datasets/import
   * Import a dataset from JSON
   */
  async importDataset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twinId, data } = req.body;

      if (!twinId || !data) {
        res.status(400).json({ error: 'twinId and data are required' });
        return;
      }

      const dataset = await datasetService.importFromJson(twinId, data);
      res.status(201).json(dataset);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/benchmark/datasets/:datasetId/export
   * Export a dataset to JSON
   */
  async exportDataset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const data = await datasetService.exportToJson(datasetId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  }

  // ==================== RUN ENDPOINTS ====================

  /**
   * POST /api/benchmark/runs
   * Create a new benchmark run
   */
  async createRun(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twinId, datasetId, name, description, runType } = req.body;

      if (!twinId || !datasetId) {
        res.status(400).json({ error: 'twinId and datasetId are required' });
        return;
      }

      const run = await testRunnerService.createRun(twinId, datasetId, {
        name,
        description,
        runType
      });

      res.status(201).json(run);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/benchmark/runs
   * List runs for a twin
   */
  async listRuns(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twinId, status, limit, offset } = req.query;

      if (!twinId) {
        res.status(400).json({ error: 'twinId is required' });
        return;
      }

      const runs = await testRunnerService.listRuns(twinId as string, {
        status: status as string,
        limit: parseInt(limit as string) || 20,
        offset: parseInt(offset as string) || 0
      });

      res.json(runs);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/benchmark/runs/:runId
   * Get a single run
   */
  async getRun(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = req.params;
      const run = await testRunnerService.getRun(runId);

      if (!run) {
        res.status(404).json({ error: 'Run not found' });
        return;
      }

      res.json(run);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/benchmark/runs/:runId/start
   * Start a benchmark run
   */
  async startRun(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = req.params;

      // Start execution asynchronously
      testRunnerService.executeRun(runId).catch((error: Error) => {
        console.error(`Benchmark run ${runId} failed:`, error.message);
      });

      res.json({ message: 'Run started', runId });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/benchmark/runs/:runId/cancel
   * Cancel a running benchmark
   */
  async cancelRun(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = req.params;

      await testRunnerService.updateRunStatus(runId, 'cancelled', {
        completed_at: new Date()
      });

      res.json({ message: 'Run cancelled', runId });
    } catch (error) {
      next(error);
    }
  }

  /**
   * DELETE /api/benchmark/runs/:runId
   * Delete a run
   */
  async deleteRun(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = req.params;
      const result = await testRunnerService.deleteRun(runId);
      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/benchmark/runs/:runId/results
   * Get results for a run
   */
  async getRunResults(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runId } = req.params;
      const { limit, offset } = req.query;

      const results = await testRunnerService.getRunResults(runId, {
        limit: parseInt(limit as string) || 100,
        offset: parseInt(offset as string) || 0
      });

      res.json(results);
    } catch (error) {
      next(error);
    }
  }

  // ==================== COMPARISON ====================

  /**
   * POST /api/benchmark/compare
   * Compare two runs
   */
  async compareRuns(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { runIdA, runIdB } = req.body;

      if (!runIdA || !runIdB) {
        res.status(400).json({ error: 'runIdA and runIdB are required' });
        return;
      }

      const comparison = await testRunnerService.compareRuns(runIdA, runIdB);
      res.json(comparison);
    } catch (error) {
      next(error);
    }
  }

  // ==================== HUMAN EVALUATION ====================

  /**
   * PUT /api/benchmark/results/:resultId/evaluate
   * Add human evaluation to a result
   */
  async submitHumanEvaluation(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { resultId } = req.params;
      const { rating, feedback } = req.body;
      const userId = req.user!.userId;

      if (!rating || rating < 1 || rating > 5) {
        res.status(400).json({ error: 'rating must be between 1 and 5' });
        return;
      }

      const result = await testRunnerService.addHumanEvaluation(resultId, userId, {
        rating,
        feedback
      });

      res.json(result);
    } catch (error) {
      next(error);
    }
  }

  // ==================== SYNTHETIC GENERATION ====================

  /**
   * POST /api/benchmark/datasets/:datasetId/generate
   * Generate synthetic Q&A pairs for a dataset
   */
  async generateSyntheticQuestions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { datasetId } = req.params;
      const { count = 20, types, difficulties } = req.body;

      // Get dataset to find twin_id
      const dataset = await datasetService.getDataset(datasetId);
      if (!dataset) {
        res.status(404).json({ error: 'Dataset not found' });
        return;
      }

      // Generate questions
      const generated = await syntheticGeneratorService.generateFromKnowledgeBase(
        dataset.twin_id,
        {
          count: Math.min(count, 100), // Cap at 100
          types: types || ['simple', 'complex'],
          difficulties: difficulties || ['easy', 'medium', 'hard']
        }
      );

      // Add to dataset
      if (generated.length > 0) {
        await datasetService.bulkAddQuestions(datasetId, generated);
      }

      // Update dataset type to hybrid if it was golden
      if (dataset.dataset_type === 'golden') {
        await datasetService.updateDataset(datasetId, { datasetType: 'hybrid' });
      }

      res.status(201).json({
        generated: generated.length,
        questions: generated
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/benchmark/generate-dataset
   * Generate a complete synthetic dataset
   */
  async generateSyntheticDataset(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { twinId, name, totalQuestions = 50, typeDistribution, difficultyDistribution } = req.body;

      if (!twinId) {
        res.status(400).json({ error: 'twinId is required' });
        return;
      }

      // Generate dataset with questions
      const datasetData = await syntheticGeneratorService.generateBenchmarkDataset(twinId, {
        name,
        totalQuestions: Math.min(totalQuestions, 100),
        typeDistribution,
        difficultyDistribution
      });

      // Save to database
      const dataset = await datasetService.importFromJson(twinId, datasetData);

      res.status(201).json(dataset);
    } catch (error) {
      next(error);
    }
  }

  // ==================== LLM JUDGE EVALUATION ====================

  /**
   * POST /api/benchmark/evaluate
   * Evaluate a single Q&A with LLM judge
   */
  async evaluateWithLLMJudge(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, answer, context } = req.body;

      if (!question || !answer) {
        res.status(400).json({ error: 'question and answer are required' });
        return;
      }

      const evaluation = await llmJudgeService.evaluateRAGResponse(
        question,
        answer,
        context || []
      );

      res.json(evaluation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/benchmark/evaluate/faithfulness
   * Evaluate faithfulness only
   */
  async evaluateFaithfulness(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { answer, context } = req.body;

      if (!answer || !context) {
        res.status(400).json({ error: 'answer and context are required' });
        return;
      }

      const evaluation = await llmJudgeService.evaluateFaithfulness(answer, context as ContextItem[]);
      res.json(evaluation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/benchmark/evaluate/relevance
   * Evaluate answer relevance only
   */
  async evaluateRelevance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { question, answer } = req.body;

      if (!question || !answer) {
        res.status(400).json({ error: 'question and answer are required' });
        return;
      }

      const evaluation = await llmJudgeService.evaluateAnswerRelevance(question, answer);
      res.json(evaluation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/benchmark/detect-hallucinations
   * Detect hallucinations in an answer
   */
  async detectHallucinations(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { answer, context } = req.body;

      if (!answer) {
        res.status(400).json({ error: 'answer is required' });
        return;
      }

      const detection = await llmJudgeService.detectHallucinations(answer, context || []);
      res.json(detection);
    } catch (error) {
      next(error);
    }
  }
}

export default new BenchmarkController();
