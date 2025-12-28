-- ============================================
-- RAG Multitenant Knowledge Base System
-- Complete Database Schema (POST-TRANSFORMATION)
-- Version 1.0 - After migrations 010-013
-- ============================================
-- NOTE: This is a DRAFT. After testing migrations on a fresh DB,
--       run: pg_dump --schema-only -U digitaltwin_user -d digitaltwin > init_db.sql
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ENUMS (POST-TRANSFORMATION)
-- ============================================

-- User roles (professional → kb_owner)
CREATE TYPE user_role AS ENUM ('super_admin', 'kb_owner', 'end_user');

-- Subscription tiers
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');

-- LLM providers (added gemini)
CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic', 'gemini', 'ollama', 'custom');

-- Conversation status (removed 'handed_over')
CREATE TYPE conversation_status AS ENUM ('active', 'closed');

-- Message sender (removed 'professional', twin → assistant)
CREATE TYPE message_sender AS ENUM ('user', 'assistant');

-- Email providers
CREATE TYPE email_provider AS ENUM ('gmail', 'outlook', 'imap');

-- Document job status
CREATE TYPE document_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================
-- TODO: Complete schema below
-- ============================================
-- This is a DRAFT init_db.sql. 
-- 
-- To generate the COMPLETE init_db.sql:
-- 
-- 1. Test migrations on a fresh database:
--    createdb digitaltwin_fresh
--    psql -U digitaltwin_user -d digitaltwin_fresh -f database/migrations/001_initial_schema.sql
--    psql -U digitaltwin_user -d digitaltwin_fresh -f database/migrations/002_email_knowledge_base.sql
--    ...
--    psql -U digitaltwin_user -d digitaltwin_fresh -f database/migrations/013_add_gemini_llm_provider.sql
--
-- 2. Export the final schema:
--    pg_dump --schema-only --no-owner --no-acl \
--      -U digitaltwin_user -d digitaltwin_fresh > database/init_db.sql
--
-- 3. Verify the generated init_db.sql contains:
--    - knowledge_bases (NOT digital_twins)
--    - kb_id foreign keys (NOT twin_id)
--    - gemini in llm_provider enum
--    - kb_owner in user_role enum (NOT professional)
--    - NO handover_notifications table
--    - OAuth columns in users table
--
-- ============================================

COMMENT ON DATABASE digitaltwin IS 'Draft schema - Generate final with pg_dump after testing migrations';
