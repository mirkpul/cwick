/**
 * Benchmark Routes - API endpoints for RAG benchmarking
 */

import { Router } from 'express';
import benchmarkController from '../controllers/benchmarkController';
import { auth, requireRole } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(auth);

// All routes require kb_owner or super_admin role
router.use(requireRole(['kb_owner', 'super_admin']));

// ==================== DATASET ROUTES ====================

// Create a new dataset
router.post('/datasets', benchmarkController.createDataset.bind(benchmarkController));

// List datasets for a twin
router.get('/datasets', benchmarkController.listDatasets.bind(benchmarkController));

// Import dataset from JSON
router.post('/datasets/import', benchmarkController.importDataset.bind(benchmarkController));

// Get a single dataset
router.get('/datasets/:datasetId', benchmarkController.getDataset.bind(benchmarkController));

// Update a dataset
router.put('/datasets/:datasetId', benchmarkController.updateDataset.bind(benchmarkController));

// Delete a dataset
router.delete('/datasets/:datasetId', benchmarkController.deleteDataset.bind(benchmarkController));

// Export dataset to JSON
router.get('/datasets/:datasetId/export', benchmarkController.exportDataset.bind(benchmarkController));

// ==================== QUESTION ROUTES ====================

// Add a question to a dataset
router.post('/datasets/:datasetId/questions', benchmarkController.addQuestion.bind(benchmarkController));

// Bulk add questions
router.post('/datasets/:datasetId/questions/bulk', benchmarkController.bulkAddQuestions.bind(benchmarkController));

// List questions in a dataset
router.get('/datasets/:datasetId/questions', benchmarkController.listQuestions.bind(benchmarkController));

// Update a question
router.put('/questions/:questionId', benchmarkController.updateQuestion.bind(benchmarkController));

// Delete a question
router.delete('/questions/:questionId', benchmarkController.deleteQuestion.bind(benchmarkController));

// ==================== RUN ROUTES ====================

// Create a new benchmark run
router.post('/runs', benchmarkController.createRun.bind(benchmarkController));

// List runs for a twin
router.get('/runs', benchmarkController.listRuns.bind(benchmarkController));

// Get a single run
router.get('/runs/:runId', benchmarkController.getRun.bind(benchmarkController));

// Start a benchmark run
router.post('/runs/:runId/start', benchmarkController.startRun.bind(benchmarkController));

// Cancel a running benchmark
router.post('/runs/:runId/cancel', benchmarkController.cancelRun.bind(benchmarkController));

// Delete a run
router.delete('/runs/:runId', benchmarkController.deleteRun.bind(benchmarkController));

// Get results for a run
router.get('/runs/:runId/results', benchmarkController.getRunResults.bind(benchmarkController));

// ==================== COMPARISON & ANALYSIS ====================

// Compare two runs
router.post('/compare', benchmarkController.compareRuns.bind(benchmarkController));

// ==================== HUMAN EVALUATION ====================

// Submit human evaluation for a result
router.put('/results/:resultId/evaluate', benchmarkController.submitHumanEvaluation.bind(benchmarkController));

// ==================== SYNTHETIC GENERATION ====================

// Generate synthetic questions for a dataset
router.post('/datasets/:datasetId/generate', benchmarkController.generateSyntheticQuestions.bind(benchmarkController));

// Generate a complete synthetic dataset
router.post('/generate-dataset', benchmarkController.generateSyntheticDataset.bind(benchmarkController));

// ==================== LLM JUDGE EVALUATION ====================

// Evaluate a Q&A with LLM judge (full evaluation)
router.post('/evaluate', benchmarkController.evaluateWithLLMJudge.bind(benchmarkController));

// Evaluate faithfulness only
router.post('/evaluate/faithfulness', benchmarkController.evaluateFaithfulness.bind(benchmarkController));

// Evaluate answer relevance only
router.post('/evaluate/relevance', benchmarkController.evaluateRelevance.bind(benchmarkController));

// Detect hallucinations
router.post('/detect-hallucinations', benchmarkController.detectHallucinations.bind(benchmarkController));

export default router;
