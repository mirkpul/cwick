-- Migration 011: Remove Handover System
-- This migration completely removes the handover functionality from the RAG system

-- Step 1: Drop handover_notifications table
DROP TABLE IF EXISTS handover_notifications CASCADE;

-- Step 2: Remove handover-related columns from conversations
ALTER TABLE conversations
  DROP COLUMN IF EXISTS handed_over_at;

-- Step 3: Update conversation_status enum to remove 'handed_over' status
-- PostgreSQL doesn't support removing enum values directly, so we need to:
-- 1. Create a new enum type
-- 2. Migrate data
-- 3. Drop old type
-- 4. Rename new type

-- First, update any 'handed_over' conversations to 'active'
UPDATE conversations
SET status = 'active'
WHERE status = 'handed_over';

-- Create new enum without 'handed_over'
CREATE TYPE conversation_status_new AS ENUM ('active', 'closed');

-- Update the column to use the new type
ALTER TABLE conversations
  ALTER COLUMN status TYPE conversation_status_new
  USING status::text::conversation_status_new;

-- Drop old type and rename new type
DROP TYPE conversation_status;
ALTER TYPE conversation_status_new RENAME TO conversation_status;

-- Step 4: Update message_sender enum
-- Remove 'professional' and rename 'twin' to 'assistant' for clarity

-- First, update any 'professional' messages to 'twin' (which will become 'assistant')
UPDATE messages
SET sender = 'twin'
WHERE sender = 'professional';

-- Create new enum with 'user' and 'assistant' only
CREATE TYPE message_sender_new AS ENUM ('user', 'assistant');

-- Update the column to use the new type
-- Map 'twin' → 'assistant', 'user' stays as 'user'
ALTER TABLE messages
  ALTER COLUMN sender TYPE message_sender_new
  USING CASE
    WHEN sender = 'twin' THEN 'assistant'::message_sender_new
    WHEN sender = 'user' THEN 'user'::message_sender_new
    ELSE 'assistant'::message_sender_new  -- Fallback
  END;

-- Drop old type and rename new type
DROP TYPE message_sender;
ALTER TYPE message_sender_new RENAME TO message_sender;

-- Step 5: Drop indexes related to handover
DROP INDEX IF EXISTS idx_handover_notifications_user_id;
DROP INDEX IF EXISTS idx_handover_notifications_is_read;

-- Step 6: Add helpful comments
COMMENT ON TYPE conversation_status IS 'Conversation status: active (ongoing) or closed (ended)';
COMMENT ON TYPE message_sender IS 'Message sender: user (end-user) or assistant (AI/RAG)';
COMMENT ON COLUMN conversations.status IS 'Current conversation status (active or closed)';
COMMENT ON COLUMN messages.sender IS 'Who sent this message (user or assistant)';

-- Step 7: Clean up analytics events related to handover (optional)
-- You may want to keep these for historical data, but you can delete them if preferred
-- DELETE FROM analytics_events WHERE event_type IN ('handover_triggered', 'handover_accepted');

-- Add comment to clarify handover removal
COMMENT ON TABLE conversations IS 'Chat conversations between end-users and Knowledge Base AI assistants (no human handover)';
