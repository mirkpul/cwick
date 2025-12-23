-- Migration 012: Add OAuth Support
-- This migration adds support for social authentication (Google, GitHub, etc.)

-- Step 1: Add OAuth-related columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Step 2: Make password_hash nullable (OAuth users won't have passwords)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Step 3: Add unique constraint for OAuth users
-- A user can only have one account per OAuth provider
CREATE UNIQUE INDEX idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;

-- Step 4: Update user_role enum to rename 'professional' to 'kb_owner'
-- This better reflects the new system where users own Knowledge Bases

-- First, create new enum with updated role name
CREATE TYPE user_role_new AS ENUM ('super_admin', 'kb_owner', 'end_user');

-- Update existing 'professional' users to 'kb_owner'
-- Then migrate the column to the new type
ALTER TABLE users
  ALTER COLUMN role TYPE user_role_new
  USING CASE
    WHEN role::text = 'professional' THEN 'kb_owner'::user_role_new
    WHEN role::text = 'super_admin' THEN 'super_admin'::user_role_new
    WHEN role::text = 'end_user' THEN 'end_user'::user_role_new
    ELSE 'kb_owner'::user_role_new  -- Fallback
  END;

-- Drop old type and rename new type
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- Update the default value for role
ALTER TABLE users ALTER COLUMN role SET DEFAULT 'kb_owner';

-- Step 5: Add helpful comments
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider name (google, github, etc.) or NULL for email/password auth';
COMMENT ON COLUMN users.oauth_id IS 'Unique user ID from OAuth provider';
COMMENT ON COLUMN users.avatar_url IS 'User avatar URL (from OAuth or custom upload)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt password hash - NULL for OAuth users';
COMMENT ON TYPE user_role IS 'User role: super_admin (platform admin), kb_owner (creates KBs), end_user (chats with KBs)';

-- Step 6: Add index for avatar lookups (optional, for performance)
CREATE INDEX idx_users_avatar_url ON users(avatar_url) WHERE avatar_url IS NOT NULL;

-- Step 7: Add validation check to ensure either password OR oauth is set
-- Note: This is a soft check via comment, enforce in application logic
COMMENT ON TABLE users IS 'Users table: must have either (email + password_hash) OR (oauth_provider + oauth_id)';

-- Optional: Add a check constraint to ensure email is always present
-- (Uncomment if you want to enforce this at DB level)
-- ALTER TABLE users ADD CONSTRAINT check_users_auth_method
--   CHECK (
--     (password_hash IS NOT NULL AND oauth_provider IS NULL AND oauth_id IS NULL) OR
--     (oauth_provider IS NOT NULL AND oauth_id IS NOT NULL)
--   );
