-- Rollback 012: Remove OAuth Support
-- This rollback script removes OAuth authentication support added in migration 012
-- WARNING: This will FAIL if OAuth users exist (users with NULL password_hash)
-- WARNING: OAuth user data (oauth_provider, oauth_id, avatar_url) will be LOST

-- Step 1: Check for OAuth users and handle them
-- CRITICAL: This rollback will fail if there are users with NULL password_hash
-- You must either:
-- A) Delete OAuth users (data loss!)
-- B) Set temporary passwords for them
-- C) Keep OAuth columns and skip this rollback

DO $$
DECLARE
  oauth_user_count INTEGER;
BEGIN
  -- Count users with OAuth (NULL password_hash)
  SELECT COUNT(*) INTO oauth_user_count
  FROM users
  WHERE password_hash IS NULL;

  IF oauth_user_count > 0 THEN
    RAISE WARNING 'Found % OAuth users (users with NULL password_hash)', oauth_user_count;
    RAISE WARNING 'These users will need password_hash set or will be deleted';
    RAISE WARNING 'Options:';
    RAISE WARNING '  1. Set temporary passwords: UPDATE users SET password_hash = ''$2b$10$TEMP_INVALID'' WHERE password_hash IS NULL;';
    RAISE WARNING '  2. Delete OAuth users: DELETE FROM users WHERE password_hash IS NULL;';
    RAISE WARNING '  3. Abort rollback and keep OAuth support';

    -- Uncomment ONE of the following based on your decision:

    -- OPTION 1: Set temporary invalid password (users cannot login until reset)
    -- UPDATE users
    -- SET password_hash = '$2b$10$OAUTH_USER_TEMP_PASSWORD_INVALID_FOR_LOGIN_NEEDS_RESET'
    -- WHERE password_hash IS NULL;
    -- RAISE NOTICE 'Set temporary passwords for % OAuth users', oauth_user_count;

    -- OPTION 2: Delete OAuth users (DATA LOSS!)
    -- DELETE FROM users WHERE password_hash IS NULL;
    -- RAISE NOTICE 'Deleted % OAuth users', oauth_user_count;

    -- OPTION 3: Abort rollback (default - safest)
    RAISE EXCEPTION 'Aborting rollback: % OAuth users exist. Handle them first (see warnings above).', oauth_user_count;
  END IF;
END $$;

-- Step 2: Drop OAuth-related indexes
DROP INDEX IF EXISTS idx_users_oauth;
DROP INDEX IF EXISTS idx_users_avatar_url;

-- Step 3: Drop OAuth columns from users table
ALTER TABLE users
  DROP COLUMN IF EXISTS oauth_provider,
  DROP COLUMN IF EXISTS oauth_id,
  DROP COLUMN IF EXISTS avatar_url;

-- Step 4: Make password_hash NOT NULL again
-- This will fail if there are still users with NULL password_hash
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- Step 5: Restore user_role enum with 'professional' instead of 'kb_owner'

-- First, remove default on role column
ALTER TABLE users ALTER COLUMN role DROP DEFAULT;

-- Create new enum with 'professional' role
DROP TYPE IF EXISTS user_role_new;
CREATE TYPE user_role_new AS ENUM ('super_admin', 'professional', 'end_user');

-- Update existing 'kb_owner' users to 'professional'
ALTER TABLE users
  ALTER COLUMN role TYPE user_role_new
  USING CASE
    WHEN role::text = 'kb_owner' THEN 'professional'::user_role_new
    WHEN role::text = 'super_admin' THEN 'super_admin'::user_role_new
    WHEN role::text = 'end_user' THEN 'end_user'::user_role_new
    ELSE 'professional'::user_role_new
  END;

-- Drop old type and rename new type
DROP TYPE IF EXISTS user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- Set default value for role
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'professional'::user_role;

-- Step 6: Update comments
COMMENT ON COLUMN users.password_hash IS 'Bcrypt password hash - required for all users';
COMMENT ON TYPE user_role IS 'User role: super_admin (platform admin), professional (creates Digital Twins), end_user (chats with twins)';
COMMENT ON TABLE users IS 'Users table: email + password authentication only';

-- Remove OAuth-specific comments
COMMENT ON COLUMN users.oauth_provider IS NULL;
COMMENT ON COLUMN users.oauth_id IS NULL;
COMMENT ON COLUMN users.avatar_url IS NULL;

-- Rollback complete
DO $$
BEGIN
  RAISE NOTICE 'Rollback 012 complete: OAuth support removed';
  RAISE NOTICE 'WARNING: OAuth columns (oauth_provider, oauth_id, avatar_url) have been dropped';
  RAISE NOTICE 'WARNING: User role renamed: kb_owner → professional';
  RAISE NOTICE 'All users now require email + password authentication';
END $$;
