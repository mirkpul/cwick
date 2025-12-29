#!/usr/bin/env node

/**
 * Environment Variables Validation Script
 * Validates that all required environment variables are set and properly formatted
 *
 * Usage:
 *   node scripts/validate-env.js
 *   node scripts/validate-env.js --env=production
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

// Parse command line arguments
const args = process.argv.slice(2);
const envArg = args.find(arg => arg.startsWith('--env='));
const targetEnv = envArg ? envArg.split('=')[1] : 'development';

console.log(`${colors.blue}🔍 Validating environment variables for: ${targetEnv}${colors.reset}\n`);

// Load .env file
const envPath = targetEnv === 'production'
  ? path.join(__dirname, '..', '.env.production')
  : path.join(__dirname, '..', '.env');

if (!fs.existsSync(envPath)) {
  console.error(`${colors.red}❌ Environment file not found: ${envPath}${colors.reset}`);
  console.error(`${colors.yellow}💡 Tip: Copy .env.example to ${path.basename(envPath)}${colors.reset}\n`);
  process.exit(1);
}

// Simple .env parser
function parseEnv(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const env = {};

  content.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (line.trim().startsWith('#') || !line.trim()) return;

    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
      env[key.trim()] = valueParts.join('=').trim();
    }
  });

  return env;
}

const env = parseEnv(envPath);

// Validation rules
const validations = {
  // Required for all environments
  required: [
    'DATABASE_URL',
    'JWT_SECRET',
    'ENCRYPTION_KEY',
    'PORT',
    'NODE_ENV',
    'CORS_ORIGIN',
    'FRONTEND_URL',
  ],

  // At least one LLM provider required
  llmProviders: [
    'OPENAI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GEMINI_API_KEY',
  ],

  // OAuth pairs (if one is set, all in group must be set)
  oauthGroups: [
    {
      name: 'Google OAuth (User Login)',
      vars: ['GOOGLE_OAUTH_CLIENT_ID', 'GOOGLE_OAUTH_CLIENT_SECRET', 'GOOGLE_OAUTH_REDIRECT_URI'],
    },
    {
      name: 'GitHub OAuth (User Login)',
      vars: ['GITHUB_OAUTH_CLIENT_ID', 'GITHUB_OAUTH_CLIENT_SECRET', 'GITHUB_OAUTH_REDIRECT_URI'],
    },
    {
      name: 'Gmail Integration',
      vars: ['GMAIL_CLIENT_ID', 'GMAIL_CLIENT_SECRET', 'GMAIL_REDIRECT_URI'],
    },
    {
      name: 'Outlook Integration',
      vars: ['OUTLOOK_CLIENT_ID', 'OUTLOOK_CLIENT_SECRET', 'OUTLOOK_REDIRECT_URI'],
    },
  ],

  // Production-specific validations
  production: {
    minLength: {
      JWT_SECRET: 32,
      ENCRYPTION_KEY: 32,
    },
    mustNotContain: {
      JWT_SECRET: ['change-in-production', 'your-secret', 'example'],
      ENCRYPTION_KEY: ['change-in-production', 'your-encryption', 'example'],
      DATABASE_URL: ['localhost', '127.0.0.1'],
    },
    mustStartWith: {
      CORS_ORIGIN: ['https://'],
      FRONTEND_URL: ['https://'],
    },
  },
};

// Validation results
const results = {
  errors: [],
  warnings: [],
  success: [],
};

// Check required variables
console.log(`${colors.blue}📋 Checking required variables...${colors.reset}`);
validations.required.forEach(varName => {
  if (!env[varName] || env[varName] === '') {
    results.errors.push(`Missing required variable: ${varName}`);
  } else {
    results.success.push(`✓ ${varName}`);
  }
});

// Check LLM providers (at least one required)
console.log(`${colors.blue}🤖 Checking LLM providers...${colors.reset}`);
const hasLLMProvider = validations.llmProviders.some(varName => env[varName] && env[varName] !== '');
if (!hasLLMProvider) {
  results.errors.push(`At least one LLM provider API key required: ${validations.llmProviders.join(', ')}`);
} else {
  validations.llmProviders.forEach(varName => {
    if (env[varName] && env[varName] !== '') {
      results.success.push(`✓ ${varName}`);
    }
  });
}

// Check OAuth groups
console.log(`${colors.blue}🔐 Checking OAuth configurations...${colors.reset}`);
validations.oauthGroups.forEach(group => {
  const setVars = group.vars.filter(varName => env[varName] && env[varName] !== '');

  if (setVars.length > 0 && setVars.length < group.vars.length) {
    const missingVars = group.vars.filter(varName => !env[varName] || env[varName] === '');
    results.warnings.push(`${group.name}: Partial configuration. Missing: ${missingVars.join(', ')}`);
  } else if (setVars.length === group.vars.length) {
    results.success.push(`✓ ${group.name}`);
  }
});

// Production-specific validations
if (targetEnv === 'production') {
  console.log(`${colors.blue}🏭 Running production-specific checks...${colors.reset}`);

  // Check minimum lengths
  Object.entries(validations.production.minLength).forEach(([varName, minLength]) => {
    if (env[varName] && env[varName].length < minLength) {
      results.errors.push(`${varName} must be at least ${minLength} characters (current: ${env[varName].length})`);
    }
  });

  // Check for forbidden values
  Object.entries(validations.production.mustNotContain).forEach(([varName, forbiddenValues]) => {
    if (env[varName]) {
      forbiddenValues.forEach(forbidden => {
        if (env[varName].toLowerCase().includes(forbidden.toLowerCase())) {
          results.errors.push(`${varName} contains forbidden value: "${forbidden}"`);
        }
      });
    }
  });

  // Check required prefixes
  Object.entries(validations.production.mustStartWith).forEach(([varName, prefixes]) => {
    if (env[varName]) {
      const hasValidPrefix = prefixes.some(prefix => env[varName].startsWith(prefix));
      if (!hasValidPrefix) {
        results.errors.push(`${varName} must start with one of: ${prefixes.join(', ')} (current: ${env[varName].substring(0, 20)}...)`);
      }
    }
  });

  // Check NODE_ENV
  if (env.NODE_ENV !== 'production') {
    results.warnings.push(`NODE_ENV should be 'production' (current: ${env.NODE_ENV})`);
  }
}

// Print results
console.log('\n' + '='.repeat(60));
console.log(`${colors.green}✅ Success (${results.success.length}):${colors.reset}`);
results.success.forEach(msg => console.log(`  ${colors.gray}${msg}${colors.reset}`));

if (results.warnings.length > 0) {
  console.log(`\n${colors.yellow}⚠️  Warnings (${results.warnings.length}):${colors.reset}`);
  results.warnings.forEach(msg => console.log(`  ${colors.yellow}${msg}${colors.reset}`));
}

if (results.errors.length > 0) {
  console.log(`\n${colors.red}❌ Errors (${results.errors.length}):${colors.reset}`);
  results.errors.forEach(msg => console.log(`  ${colors.red}${msg}${colors.reset}`));
  console.log('\n' + '='.repeat(60));
  process.exit(1);
}

console.log('\n' + '='.repeat(60));
console.log(`${colors.green}🎉 All validations passed!${colors.reset}\n`);
process.exit(0);
