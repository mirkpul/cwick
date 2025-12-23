-- Migration 013: Add Gemini LLM Provider
-- This migration adds 'gemini' to the llm_provider enum for Google's Gemini AI support

-- Step 1: Add 'gemini' to llm_provider enum
-- PostgreSQL requires adding enum values using ALTER TYPE ... ADD VALUE
ALTER TYPE llm_provider ADD VALUE IF NOT EXISTS 'gemini';

-- Step 2: Add helpful comment
COMMENT ON TYPE llm_provider IS 'Supported LLM providers: openai (GPT models), anthropic (Claude), gemini (Google AI), ollama (local), custom';

-- Note: The new value 'gemini' is now available for use in knowledge_bases.llm_provider
-- Users can select Gemini models like 'gemini-pro', 'gemini-pro-vision', etc.
