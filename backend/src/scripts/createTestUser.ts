/**
 * Create Test User Script
 *
 * Creates a test user for development and testing purposes.
 *
 * Test Credentials:
 * - Email: test@example.com
 * - Password: Test123456!
 * - Role: kb_owner
 *
 * Usage:
 *   npm run create-test-user
 *
 * Or directly:
 *   npx ts-node src/scripts/createTestUser.ts
 */

import authService from '../services/authService';
import db from '../config/database';
import logger from '../config/logger';

const TEST_USER = {
  email: 'test@example.com',
  password: 'Test123456!',
  fullName: 'Test User',
  role: 'kb_owner'
};

async function createTestUser() {
  try {
    logger.info('Starting test user creation...');

    // Check if user already exists
    const existingUser = await db.query(
      'SELECT id, email, full_name, role FROM users WHERE email = $1',
      [TEST_USER.email]
    );

    if (existingUser.rows.length > 0) {
      const user = existingUser.rows[0];
      logger.info('Test user already exists:');
      logger.info(`  ID: ${user.id}`);
      logger.info(`  Email: ${user.email}`);
      logger.info(`  Name: ${user.full_name}`);
      logger.info(`  Role: ${user.role}`);
      logger.info('\nYou can log in with:');
      logger.info(`  Email: ${TEST_USER.email}`);
      logger.info(`  Password: ${TEST_USER.password}`);
      return;
    }

    // Register new test user
    const result = await authService.register(
      TEST_USER.email,
      TEST_USER.password,
      TEST_USER.fullName,
      TEST_USER.role
    );

    logger.info('✅ Test user created successfully!');
    logger.info(`  ID: ${result.user.id}`);
    logger.info(`  Email: ${result.user.email}`);
    logger.info(`  Name: ${result.user.full_name}`);
    logger.info(`  Role: ${result.user.role}`);
    logger.info('\nYou can now log in with:');
    logger.info(`  Email: ${TEST_USER.email}`);
    logger.info(`  Password: ${TEST_USER.password}`);
    logger.info('\nGenerated JWT token (valid for 7 days):');
    logger.info(`  ${result.token.substring(0, 50)}...`);

  } catch (error) {
    logger.error('❌ Failed to create test user:', error);
    throw error;
  } finally {
    // Close database connection
    await db.pool.end();
    process.exit(0);
  }
}

// Run the script
createTestUser();
