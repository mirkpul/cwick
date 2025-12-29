-- ============================================
-- Test User Seed Script
-- Creates a test user for development/testing
-- ============================================
--
-- Test User Credentials:
-- Email: test@example.com
-- Password: Test123456!
-- Role: kb_owner (professional)
--
-- To apply this script to Docker database:
-- docker exec -i digitaltwin-db psql -U digitaltwin_user -d digitaltwin < database/seed/test_user.sql
--
-- Or from inside the container:
-- docker exec -it digitaltwin-db psql -U digitaltwin_user -d digitaltwin -f /docker-entrypoint-initdb.d/seed_test_user.sql
-- ============================================

-- Password hash for "Test123456!" (bcrypt with salt rounds = 10)
-- Generated using: bcrypt.hash('Test123456!', 10)
-- $2b$10$X5k3K5JZ0QZ0X5k3K5JZ0O5k3K5JZ0QZ0X5k3K5JZ0QZ0X5k3K5JZ0

-- Check if user already exists
DO $$
DECLARE
    test_user_id UUID;
BEGIN
    -- Check if test user exists
    SELECT id INTO test_user_id FROM users WHERE email = 'test@example.com';

    IF test_user_id IS NULL THEN
        -- Create test user
        INSERT INTO users (
            id,
            email,
            password_hash,
            full_name,
            role,
            is_active,
            email_verified,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'test@example.com',
            '$2b$10$vI8aWBnW3fID.ZQ4/zo1G.q1lRps.9cGLcZEiGDMVr5yUE1NQ', -- Test123456!
            'Test User',
            'kb_owner',
            true,
            true,
            NOW(),
            NOW()
        ) RETURNING id INTO test_user_id;

        RAISE NOTICE 'Created test user with ID: %', test_user_id;

        -- Create free subscription for test user
        INSERT INTO subscriptions (
            user_id,
            tier,
            monthly_message_limit,
            current_period_start,
            current_period_end,
            created_at,
            updated_at
        ) VALUES (
            test_user_id,
            'free',
            100,
            NOW(),
            NOW() + INTERVAL '30 days',
            NOW(),
            NOW()
        );

        RAISE NOTICE 'Created free subscription for test user';

    ELSE
        RAISE NOTICE 'Test user already exists with ID: %', test_user_id;
    END IF;
END $$;

-- Display test user info
SELECT
    id,
    email,
    full_name,
    role,
    is_active,
    email_verified,
    created_at
FROM users
WHERE email = 'test@example.com';
