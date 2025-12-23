import { BaseClient, BaseClientConfig } from './base-client';

export interface DocumentProcessingClientConfig extends Omit<BaseClientConfig, 'baseURL'> {
  baseURL?: string;
}

export class DocumentProcessingClient extends BaseClient {
  constructor(config: DocumentProcessingClientConfig) {
    super({
      ...config,
      baseURL: config.baseURL || process.env.DOC_PROCESSING_URL || 'http://localhost:3015',
    });
  }
}
