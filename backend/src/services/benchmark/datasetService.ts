/**
 * Dataset Service - CRUD operations for benchmark datasets and questions
 */

import { pool } from '../../config/database';
import { v4 as uuidv4 } from 'uuid';

interface Dataset {
  id: string;
  kb_id: string;
  name: string;
  description: string;
  dataset_type: string;
  tags: string[];
  is_active: boolean;
  total_questions: number;
  created_at: Date;
  active_questions?: number;
}

interface Question {
  id: string;
  dataset_id: string;
  question: string;
  expected_answer: string | null;
  expected_context_ids: string[];
  question_type: string;
  difficulty: string;
  source_type: string;
  source_kb_id: string | null;
  tags: string[];
  is_active: boolean;
  created_at: Date;
}

interface CreateDatasetParams {
  name: string;
  description: string;
  datasetType?: string;
  tags?: string[];
}

interface AddQuestionParams {
  question: string;
  expectedAnswer?: string | null;
  expectedContextIds?: string[];
  questionType?: string;
  difficulty?: string;
  sourceType?: string;
  sourceKbId?: string | null;
  tags?: string[];
}

type ImportedQuestion = {
  [K in keyof AddQuestionParams]?: AddQuestionParams[K];
};

interface ListOptions {
  includeInactive?: boolean;
  limit?: number;
  offset?: number;
  questionType?: string | null;
  difficulty?: string | null;
}

class DatasetService {
  // ==================== DATASET OPERATIONS ====================

  /**
   * Create a new benchmark dataset
   */
  async createDataset(twinId: string, { name, description, datasetType = 'golden', tags = [] }: CreateDatasetParams): Promise<Dataset> {
    const id = uuidv4();
    const result = await pool.query<Dataset>(
      `INSERT INTO benchmark_datasets
       (id, kb_id, name, description, dataset_type, tags)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [id, twinId, name, description, datasetType, JSON.stringify(tags)]
    );
    return result.rows[0];
  }

  /**
   * Get dataset by ID
   */
  async getDataset(datasetId: string): Promise<Dataset | null> {
    const result = await pool.query<Dataset>(
      `SELECT d.*,
              COUNT(q.id) FILTER (WHERE q.is_active = true) as active_questions
       FROM benchmark_datasets d
       LEFT JOIN benchmark_questions q ON q.dataset_id = d.id
       WHERE d.id = $1
       GROUP BY d.id`,
      [datasetId]
    );
    return result.rows[0] || null;
  }

  /**
   * List datasets for a twin
   */
  async listDatasets(twinId: string, { includeInactive = false, limit = 50, offset = 0 }: ListOptions = {}): Promise<Dataset[]> {
    const whereClause = includeInactive
      ? 'WHERE d.kb_id = $1'
      : 'WHERE d.kb_id = $1 AND d.is_active = true';

    const result = await pool.query<Dataset>(
      `SELECT d.*,
              COUNT(q.id) FILTER (WHERE q.is_active = true) as active_questions
       FROM benchmark_datasets d
       LEFT JOIN benchmark_questions q ON q.dataset_id = d.id
       ${whereClause}
       GROUP BY d.id
       ORDER BY d.created_at DESC
       LIMIT $2 OFFSET $3`,
      [twinId, limit, offset]
    );
    return result.rows;
  }

  /**
   * Update dataset
   */
  async updateDataset(datasetId: string, updates: Partial<CreateDatasetParams & { isActive: boolean }>): Promise<Dataset> {
    const allowedFields = ['name', 'description', 'dataset_type', 'is_active', 'tags'];
    const setClause: string[] = [];
    const values: unknown[] = [datasetId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key) && value !== undefined) {
        const dbKey = key === 'datasetType' ? 'dataset_type' : key === 'isActive' ? 'is_active' : key;
        setClause.push(`${dbKey} = $${paramIndex}`);
        values.push(key === 'tags' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return this.getDataset(datasetId) as Promise<Dataset>;
    }

    const result = await pool.query<Dataset>(
      `UPDATE benchmark_datasets
       SET ${setClause.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );
    return result.rows[0];
  }

  /**
   * Delete dataset (soft delete by default)
   */
  async deleteDataset(datasetId: string, hard = false): Promise<{ deleted: boolean } | Dataset> {
    if (hard) {
      await pool.query('DELETE FROM benchmark_datasets WHERE id = $1', [datasetId]);
      return { deleted: true };
    }
    return this.updateDataset(datasetId, { isActive: false });
  }

  // ==================== QUESTION OPERATIONS ====================

  /**
   * Add a question to a dataset
   */
  async addQuestion(datasetId: string, params: AddQuestionParams): Promise<Question> {
    const {
      question,
      expectedAnswer = null,
      expectedContextIds = [],
      questionType = 'simple',
      difficulty = 'medium',
      sourceType = 'manual',
      sourceKbId = null,
      tags = [],
    } = params;

    const id = uuidv4();
    const result = await pool.query<Question>(
      `INSERT INTO benchmark_questions
       (id, dataset_id, question, expected_answer, expected_context_ids,
        question_type, difficulty, source_type, source_kb_id, tags)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id, datasetId, question, expectedAnswer, expectedContextIds,
        questionType, difficulty, sourceType, sourceKbId, JSON.stringify(tags),
      ]
    );

    // Update dataset question count
    await this._updateQuestionCount(datasetId);

    return result.rows[0];
  }

  /**
   * Bulk add questions to a dataset
   */
  async bulkAddQuestions(datasetId: string, questions: AddQuestionParams[]): Promise<Question[]> {
    const results: Question[] = [];
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      for (const q of questions) {
        const id = uuidv4();
        const result = await client.query<Question>(
          `INSERT INTO benchmark_questions
           (id, dataset_id, question, expected_answer, expected_context_ids,
            question_type, difficulty, source_type, source_kb_id, tags)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           RETURNING *`,
          [
            id,
            datasetId,
            q.question,
            q.expectedAnswer || null,
            q.expectedContextIds || [],
            q.questionType || 'simple',
            q.difficulty || 'medium',
            q.sourceType || 'manual',
            q.sourceKbId || null,
            JSON.stringify(q.tags || []),
          ]
        );
        results.push(result.rows[0]);
      }

      // Update dataset question count
      await client.query(
        `UPDATE benchmark_datasets
         SET total_questions = (
           SELECT COUNT(*) FROM benchmark_questions
           WHERE dataset_id = $1 AND is_active = true
         )
         WHERE id = $1`,
        [datasetId]
      );

      await client.query('COMMIT');
      return results;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get question by ID
   */
  async getQuestion(questionId: string): Promise<Question | null> {
    const result = await pool.query<Question>(
      'SELECT * FROM benchmark_questions WHERE id = $1',
      [questionId]
    );
    return result.rows[0] || null;
  }

  /**
   * List questions in a dataset
   */
  async listQuestions(datasetId: string, options: ListOptions = {}): Promise<Question[]> {
    const {
      includeInactive = false,
      questionType = null,
      difficulty = null,
      limit = 100,
      offset = 0,
    } = options;

    const conditions = ['dataset_id = $1'];
    const values: unknown[] = [datasetId];
    let paramIndex = 2;

    if (!includeInactive) {
      conditions.push('is_active = true');
    }

    if (questionType) {
      conditions.push(`question_type = $${paramIndex}`);
      values.push(questionType);
      paramIndex++;
    }

    if (difficulty) {
      conditions.push(`difficulty = $${paramIndex}`);
      values.push(difficulty);
      paramIndex++;
    }

    values.push(limit, offset);

    const result = await pool.query<Question>(
      `SELECT * FROM benchmark_questions
       WHERE ${conditions.join(' AND ')}
       ORDER BY created_at ASC
       LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      values
    );
    return result.rows;
  }

  /**
   * Update question
   */
  async updateQuestion(questionId: string, updates: Partial<AddQuestionParams & { isActive: boolean }>): Promise<Question> {
    const allowedFields = [
      'question', 'expected_answer', 'expected_context_ids',
      'question_type', 'difficulty', 'is_active', 'tags',
    ];
    const setClause: string[] = [];
    const values: unknown[] = [questionId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(updates)) {
      const dbKey = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (allowedFields.includes(dbKey) && value !== undefined) {
        setClause.push(`${dbKey} = $${paramIndex}`);
        values.push(dbKey === 'tags' ? JSON.stringify(value) : value);
        paramIndex++;
      }
    }

    if (setClause.length === 0) {
      return this.getQuestion(questionId) as Promise<Question>;
    }

    const result = await pool.query<Question>(
      `UPDATE benchmark_questions
       SET ${setClause.join(', ')}
       WHERE id = $1
       RETURNING *`,
      values
    );

    // Update dataset question count if is_active changed
    if ('isActive' in updates) {
      const question = result.rows[0];
      if (question) {
        await this._updateQuestionCount(question.dataset_id);
      }
    }

    return result.rows[0];
  }

  /**
   * Delete question (soft delete by default)
   */
  async deleteQuestion(questionId: string, hard = false): Promise<{ deleted: boolean } | Question | null> {
    const question = await this.getQuestion(questionId);
    if (!question) return null;

    if (hard) {
      await pool.query('DELETE FROM benchmark_questions WHERE id = $1', [questionId]);
      await this._updateQuestionCount(question.dataset_id);
      return { deleted: true };
    }

    return this.updateQuestion(questionId, { isActive: false });
  }

  // ==================== HELPER METHODS ====================

  /**
   * Update the total_questions count on a dataset
   */
  async _updateQuestionCount(datasetId: string): Promise<void> {
    await pool.query(
      `UPDATE benchmark_datasets
       SET total_questions = (
         SELECT COUNT(*) FROM benchmark_questions
         WHERE dataset_id = $1 AND is_active = true
       )
       WHERE id = $1`,
      [datasetId]
    );
  }

  /**
   * Get dataset statistics
   */
  async getDatasetStats(datasetId: string): Promise<import('../../types/benchmark').DatasetStats> {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE is_active = true) as total_questions,
         COUNT(*) FILTER (WHERE question_type = 'simple' AND is_active = true) as simple_count,
         COUNT(*) FILTER (WHERE question_type = 'complex' AND is_active = true) as complex_count,
         COUNT(*) FILTER (WHERE question_type = 'multi_hop' AND is_active = true) as multi_hop_count,
         COUNT(*) FILTER (WHERE difficulty = 'easy' AND is_active = true) as easy_count,
         COUNT(*) FILTER (WHERE difficulty = 'medium' AND is_active = true) as medium_count,
         COUNT(*) FILTER (WHERE difficulty = 'hard' AND is_active = true) as hard_count,
         COUNT(*) FILTER (WHERE expected_answer IS NOT NULL AND is_active = true) as with_expected_answer,
         COUNT(*) FILTER (WHERE array_length(expected_context_ids, 1) > 0 AND is_active = true) as with_expected_context
       FROM benchmark_questions
       WHERE dataset_id = $1`,
      [datasetId]
    );
    return result.rows[0];
  }

  /**
   * Clone a dataset (useful for creating variations)
   */
  async cloneDataset(datasetId: string, newName?: string): Promise<Dataset> {
    const original = await this.getDataset(datasetId);
    if (!original) throw new Error('Dataset not found');

    // Create new dataset
    const newDataset = await this.createDataset(original.kb_id, {
      name: newName || `${original.name} (Copy)`,
      description: original.description,
      datasetType: original.dataset_type,
      tags: original.tags || [],
    });

    // Copy questions
    const questions = await this.listQuestions(datasetId, { includeInactive: false });
    if (questions.length > 0) {
      await this.bulkAddQuestions(
        newDataset.id,
        questions.map(q => ({
          question: q.question,
          expectedAnswer: q.expected_answer,
          expectedContextIds: q.expected_context_ids,
          questionType: q.question_type,
          difficulty: q.difficulty,
          sourceType: q.source_type,
          sourceKbId: q.source_kb_id,
          tags: q.tags,
        }))
      );
    }

    return this.getDataset(newDataset.id) as Promise<Dataset>;
  }

  /**
   * Import dataset from JSON
   */
  async importFromJson(twinId: string, jsonData: Record<string, unknown>): Promise<Dataset> {
    const name = jsonData.name as string;
    const description = jsonData.description as string;
    const datasetType = (jsonData.datasetType as string) || 'golden';
    const tags = (jsonData.tags as string[]) || [];
    const questions = (jsonData.questions as Record<string, unknown>[]) || [];

    const dataset = await this.createDataset(twinId, {
      name,
      description,
      datasetType,
      tags,
    });

    const formattedQuestions: AddQuestionParams[] = Array.isArray(questions)
      ? questions
          .map(question => ({
            question: String((question as ImportedQuestion).question || ''),
            expectedAnswer: (question as ImportedQuestion).expectedAnswer ?? null,
            expectedContextIds: (question as ImportedQuestion).expectedContextIds || [],
            questionType: (question as ImportedQuestion).questionType,
            difficulty: (question as ImportedQuestion).difficulty,
            sourceType: (question as ImportedQuestion).sourceType,
            sourceKbId: (question as ImportedQuestion).sourceKbId ?? null,
            tags: (question as ImportedQuestion).tags || [],
          }))
          .filter(q => q.question.trim().length > 0)
      : [];

    if (formattedQuestions.length > 0) {
      await this.bulkAddQuestions(dataset.id, formattedQuestions);
    }

    return this.getDataset(dataset.id) as Promise<Dataset>;
  }

  /**
   * Export dataset to JSON
   */
  async exportToJson(datasetId: string): Promise<Record<string, unknown>> {
    const dataset = await this.getDataset(datasetId);
    if (!dataset) throw new Error('Dataset not found');

    const questions = await this.listQuestions(datasetId, { includeInactive: false });

    return {
      name: dataset.name,
      description: dataset.description,
      datasetType: dataset.dataset_type,
      tags: dataset.tags,
      exportedAt: new Date().toISOString(),
      questions: questions.map(q => ({
        question: q.question,
        expectedAnswer: q.expected_answer,
        expectedContextIds: q.expected_context_ids,
        questionType: q.question_type,
        difficulty: q.difficulty,
        tags: q.tags,
      })),
    };
  }
}

export default new DatasetService();
