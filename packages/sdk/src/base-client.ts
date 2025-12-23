/**
 * Base HTTP client for service-to-service communication
 */
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import { retry } from '@virtualcoach/shared-utils';
import type { ApiResponse, HealthCheckResponse } from '@virtualcoach/shared-types';

export interface BaseClientConfig {
  baseURL: string;
  timeout?: number;
  apiKey?: string;
  retryOptions?: {
    maxAttempts?: number;
    delayMs?: number;
  };
}

export class BaseClient {
  protected client: AxiosInstance;
  protected retryOptions: any;

  constructor(config: BaseClientConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(config.apiKey && { 'X-API-Key': config.apiKey }),
      },
    });

    this.retryOptions = config.retryOptions || { maxAttempts: 3, delayMs: 1000 };
  }

  protected async request<T>(config: AxiosRequestConfig): Promise<T> {
    return retry(async () => {
      const response = await this.client.request<ApiResponse<T>>(config);
      if (!response.data.success) {
        throw new Error(response.data.error || 'Request failed');
      }
      return response.data.data as T;
    }, this.retryOptions);
  }

  async health(): Promise<HealthCheckResponse> {
    const response = await this.client.get<HealthCheckResponse>('/health');
    return response.data;
  }
}
