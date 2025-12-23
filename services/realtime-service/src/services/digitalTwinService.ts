import db from '../config/database';
import logger from '../config/logger';
import appConfig from '../config/appConfig';

type JsonValue = Record<string, unknown> | null;

export interface DigitalTwin {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  bio: string;
  llm_provider: string;
  llm_model: string;
  system_prompt: string;
  personality_traits: JsonValue;
  communication_style: string;
  capabilities: JsonValue;
  services: JsonValue;
  pricing_info: JsonValue;
  rag_config: RAGConfig;
  created_at: Date;
  updated_at: Date;
  is_active: boolean;
}

export interface KnowledgeBaseEntry {
  id?: string;
  twin_id: string;
  title: string;
  content: string;
  content_type: string;
  source_url?: string;
  embedding?: string;
  created_at?: Date;
}

export interface RAGConfig {
  knowledgeBaseThreshold?: number;
  emailThreshold?: number;
  hybridSearchEnabled?: boolean;
  vectorWeight?: number;
  bm25Weight?: number;
  fusionMethod?: string;
  rerankingEnabled?: boolean;
  useDiversityFilter?: boolean;
  diversityThreshold?: number;
  useMMR?: boolean;
  mmrLambda?: number;
  semanticBoostEnabled?: boolean;
  maxBoost?: number;
  minBoostThreshold?: number;
  dynamicBoostEnabled?: boolean;
  temporalDecayEnabled?: boolean;
  decayHalfLifeDays?: number;
  maxResults?: number;
  maxEmailRatio?: number;
  maxKBRatio?: number;
  ingestion?: {
    tableMaxColumns?: number;
  };
}

class DigitalTwinService {
  async getDigitalTwinById(twinId: string): Promise<DigitalTwin | null> {
    try {
      const result = await db.query<DigitalTwin>(
        'SELECT * FROM digital_twins WHERE id = $1 AND is_active = true',
        [twinId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get digital twin by id error:', error);
      throw error;
    }
  }

  async getDigitalTwinByUserId(userId: string): Promise<DigitalTwin | null> {
    try {
      const result = await db.query<DigitalTwin>(
        'SELECT * FROM digital_twins WHERE user_id = $1 AND is_active = true',
        [userId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      logger.error('Get digital twin by user id error:', error);
      throw error;
    }
  }

  /**
   * Get RAG configuration for a digital twin
   * Returns stored config merged with defaults from appConfig
   */
  async getRAGConfig(twinId: string): Promise<RAGConfig | null> {
    try {
      const result = await db.query(
        'SELECT rag_config FROM digital_twins WHERE id = $1',
        [twinId]
      );

      if (result.rows.length === 0) {
        return null;
      }

      // Default RAG config from appConfig
      const defaultConfig: RAGConfig = {
        knowledgeBaseThreshold: appConfig.semanticSearch.sourceThresholds.knowledgeBase,
        emailThreshold: appConfig.semanticSearch.sourceThresholds.email,
        hybridSearchEnabled: appConfig.ragOptimization.hybridSearch.enabled,
        vectorWeight: appConfig.ragOptimization.hybridSearch.vectorWeight,
        bm25Weight: appConfig.ragOptimization.hybridSearch.bm25Weight,
        fusionMethod: appConfig.ragOptimization.hybridSearch.fusionMethod,
        rerankingEnabled: appConfig.ragOptimization.reranking.enabled,
        useDiversityFilter: appConfig.ragOptimization.reranking.useDiversityFilter,
        diversityThreshold: appConfig.ragOptimization.reranking.diversityThreshold,
        useMMR: appConfig.ragOptimization.reranking.useMMR,
        mmrLambda: appConfig.ragOptimization.reranking.mmrLambda,
        semanticBoostEnabled: appConfig.ragOptimization.reranking.semanticBoost.enabled,
        maxBoost: appConfig.ragOptimization.reranking.semanticBoost.maxBoost,
        minBoostThreshold: appConfig.ragOptimization.reranking.semanticBoost.minThreshold,
        dynamicBoostEnabled: false,
        temporalDecayEnabled: false,
        decayHalfLifeDays: 365,
        maxResults: appConfig.ragOptimization.reranking.finalK,
        maxEmailRatio: appConfig.semanticSearch.ensembleBalancing.maxEmailRatio,
        maxKBRatio: appConfig.semanticSearch.ensembleBalancing.maxKBRatio,
        ingestion: {
          tableMaxColumns: appConfig.ragOptimization.assetEnrichment.tables.maxColumns,
        },
      };

      // Merge stored config with defaults (stored values override defaults)
      const storedConfig = (result.rows[0] as { rag_config?: Partial<RAGConfig> }).rag_config || {};
      return { ...defaultConfig, ...storedConfig };
    } catch (error) {
      logger.error('Get RAG config error:', error);
      throw error;
    }
  }
}

export default new DigitalTwinService();
