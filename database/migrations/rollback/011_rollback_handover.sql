-- Rollback 011: Restore Handover System
-- This rollback script restores the handover functionality that was removed in migration 011
-- WARNING: This recreates tables and enum values but does NOT restore deleted historical data

-- Step 1: Recreate handover_notifications table
CREATE TABLE IF NOT EXISTS handover_notifications (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  reason TEXT,
  confidence_score DECIMAL(3,2),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Step 2: Add back handover column to conversations
ALTER TABLE conversations
  ADD COLUMN IF NOT EXISTS handed_over_at TIMESTAMP;

-- Step 3: Restore conversation_status enum with 'handed_over'
-- PostgreSQL doesn't support adding enum values in transactions, so we need to:
-- 1. Create a new enum type
-- 2. Migrate data
-- 3. Drop old type
-- 4. Rename new type

-- Create new enum with 'handed_over' status
DROP TYPE IF EXISTS conversation_status_new;
CREATE TYPE conversation_status_new AS ENUM ('active', 'handed_over', 'closed');

-- Update the column to use the new type
ALTER TABLE conversations
  ALTER COLUMN status TYPE conversation_status_new
  USING status::text::conversation_status_new;

-- Drop old type and rename new type
DROP TYPE conversation_status;
ALTER TYPE conversation_status_new RENAME TO conversation_status;

-- Step 4: Restore message_sender enum with 'professional' and 'twin'
-- Create new enum with all three sender types
DROP TYPE IF EXISTS message_sender_new;
CREATE TYPE message_sender_new AS ENUM ('user', 'twin', 'professional');

-- Update the column to use the new type
-- Map 'assistant' → 'twin', 'user' stays as 'user'
ALTER TABLE messages
  ALTER COLUMN sender TYPE message_sender_new
  USING CASE
    WHEN sender::text = 'assistant' THEN 'twin'::message_sender_new
    WHEN sender::text = 'user' THEN 'user'::message_sender_new
    ELSE 'twin'::message_sender_new  -- Fallback
  END;

-- Drop old type and rename new type
DROP TYPE message_sender;
ALTER TYPE message_sender_new RENAME TO message_sender;

-- Step 5: Recreate indexes for handover_notifications
CREATE INDEX IF NOT EXISTS idx_handover_notifications_conversation_id
  ON handover_notifications(conversation_id);

CREATE INDEX IF NOT EXISTS idx_handover_notifications_user_id
  ON handover_notifications(user_id);

CREATE INDEX IF NOT EXISTS idx_handover_notifications_is_read
  ON handover_notifications(is_read) WHERE is_read = false;

CREATE INDEX IF NOT EXISTS idx_handover_notifications_created_at
  ON handover_notifications(created_at DESC);

-- Step 6: Add index for handed_over_at column
CREATE INDEX IF NOT EXISTS idx_conversations_handed_over_at
  ON conversations(handed_over_at) WHERE handed_over_at IS NOT NULL;

-- Step 7: Add trigger for handover_notifications updated_at
CREATE TRIGGER IF NOT EXISTS update_handover_notifications_updated_at
BEFORE UPDATE ON handover_notifications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Update comments
COMMENT ON TABLE handover_notifications IS 'Notifications for professionals when AI twin needs to hand over conversation to human';
COMMENT ON TYPE conversation_status IS 'Conversation status: active (ongoing), handed_over (transferred to professional), or closed (ended)';
COMMENT ON TYPE message_sender IS 'Message sender: user (end-user), twin (AI/RAG), or professional (human expert)';
COMMENT ON COLUMN conversations.status IS 'Current conversation status (active, handed_over, or closed)';
COMMENT ON COLUMN conversations.handed_over_at IS 'Timestamp when conversation was handed over to professional';
COMMENT ON COLUMN messages.sender IS 'Who sent this message (user, twin, or professional)';
COMMENT ON COLUMN handover_notifications.confidence_score IS 'AI confidence score that triggered the handover (if applicable)';
COMMENT ON COLUMN handover_notifications.reason IS 'Reason for handover (low confidence, explicit user request, etc.)';

-- Update conversations table comment
COMMENT ON TABLE conversations IS 'Chat conversations between end-users and Digital Twin AI assistants (with professional handover capability)';

-- Rollback complete
DO $$
BEGIN
  RAISE NOTICE 'Rollback 011 complete: Handover system restored';
  RAISE NOTICE 'WARNING: Historical handover_notifications data was not restored';
  RAISE NOTICE 'WARNING: Message sender mapping: assistant → twin';
END $$;
