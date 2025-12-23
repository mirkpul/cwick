/**
 * Database entity types shared across services
 */

export interface User {
  id: string;
  email: string;
  password_hash: string;
  full_name: string;
  role: 'professional' | 'super_admin';
  subscription_tier: 'free' | 'basic' | 'professional' | 'enterprise';
  created_at: Date;
  updated_at: Date;
}

export interface DigitalTwin {
  id: string;
  user_id: string;
  name: string;
  profession: string;
  bio: string;
  avatar_url?: string;
  llm_provider: 'openai' | 'anthropic';
  llm_model: string;
  temperature: number;
  max_tokens: number;
  system_prompt?: string;
  handover_threshold: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface KnowledgeBaseEntry {
  id: string;
  digital_twin_id: string;
  content: string;
  embedding: number[];
  source_type: 'manual' | 'file' | 'email' | 'web';
  file_name?: string;
  chunk_index?: number;
  total_chunks?: number;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface EmailCredential {
  id: string;
  digital_twin_id: string;
  email_provider: 'gmail' | 'outlook' | 'imap';
  email_address: string;
  access_token_encrypted?: string;
  refresh_token_encrypted?: string;
  imap_host?: string;
  imap_port?: number;
  imap_username_encrypted?: string;
  imap_password_encrypted?: string;
  auto_sync_enabled: boolean;
  sync_frequency_hours: number;
  last_sync_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface Conversation {
  id: string;
  digital_twin_id: string;
  end_user_id: string;
  status: 'active' | 'handed_over' | 'closed';
  started_at: Date;
  ended_at?: Date;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender: 'user' | 'twin' | 'professional';
  content: string;
  created_at: Date;
}

export interface EndUser {
  id: string;
  name?: string;
  email?: string;
  created_at: Date;
}

export interface HandoverNotification {
  id: string;
  conversation_id: string;
  professional_id: string;
  reason: string;
  status: 'pending' | 'accepted' | 'resolved';
  created_at: Date;
  resolved_at?: Date;
}
