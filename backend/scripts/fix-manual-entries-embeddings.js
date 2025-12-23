#!/usr/bin/env node

/**
 * Fix Script: Generate Embeddings for Manual Knowledge Base Entries
 *
 * This script finds all knowledge base entries that were added manually (without embeddings)
 * and generates embeddings for them.
 *
 * Usage:
 *   node scripts/fix-manual-entries-embeddings.js [options]
 *
 * Options:
 *   --dry-run          Show what would be updated without making changes
 *   --twin-id=<id>     Fix only entries for a specific digital twin
 *   --force            Skip confirmation prompt
 *
 * Examples:
 *   node scripts/fix-manual-entries-embeddings.js --dry-run
 *   node scripts/fix-manual-entries-embeddings.js --twin-id=abc123
 *   node scripts/fix-manual-entries-embeddings.js --force
 */

require('dotenv').config();
const db = require('../src/config/database');
const LLMService = require('../src/services/llmService');
const readline = require('readline');

// Signal handlers for graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Fix script interrupted by user (SIGINT). Cleaning up...');
  await db.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Fix script terminated (SIGTERM). Cleaning up...');
  await db.end();
  process.exit(0);
});

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  dryRun: args.includes('--dry-run'),
  twinId: args.find(arg => arg.startsWith('--twin-id='))?.split('=')[1],
  force: args.includes('--force'),
};

console.log('🔧 Fix Manual Entries Embeddings Script');
console.log('='.repeat(50));
console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
if (options.twinId) {
  console.log(`Twin ID filter: ${options.twinId}`);
}
console.log('='.repeat(50));
console.log();

/**
 * Prompt user for confirmation
 */
async function confirm(message) {
  if (options.force) return true;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question(`${message} (y/n): `, answer => {
      rl.close();
      resolve(answer.toLowerCase() === 'y');
    });
  });
}

/**
 * Get entries without embeddings
 */
async function getEntriesWithoutEmbeddings() {
  let query = `
    SELECT id, twin_id, title, content, content_type, created_at
    FROM knowledge_base
    WHERE embedding IS NULL
  `;

  const params = [];

  if (options.twinId) {
    query += ' AND twin_id = $1';
    params.push(options.twinId);
  }

  query += ' ORDER BY created_at DESC';

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Main fix function
 */
async function fixEmbeddings() {
  try {
    console.log('📊 Analyzing knowledge base...\n');
    const entries = await getEntriesWithoutEmbeddings();

    if (entries.length === 0) {
      console.log('✅ No entries found without embeddings. All good!');
      return;
    }

    console.log(`Found ${entries.length} entries without embeddings:\n`);

    // Group by twin
    const twinGroups = entries.reduce((acc, entry) => {
      acc[entry.twin_id] = (acc[entry.twin_id] || 0) + 1;
      return acc;
    }, {});

    console.log('Breakdown by twin:');
    Object.entries(twinGroups).forEach(([twinId, count]) => {
      console.log(`  - ${twinId}: ${count} entries`);
    });

    // Show sample entries
    console.log('\nSample entries:');
    entries.slice(0, 5).forEach((entry, idx) => {
      console.log(`  ${idx + 1}. "${entry.title}" (${entry.content_type || 'text'})`);
      console.log(`     Content: ${entry.content.substring(0, 80)}...`);
    });

    // Estimate cost
    const estimatedCost = (entries.length / 1000) * 0.00002;
    console.log(`\n💰 Estimated cost: $${estimatedCost.toFixed(4)}`);
    console.log();

    // Confirm
    if (!options.dryRun) {
      const confirmed = await confirm(
        '⚠️  This will generate embeddings for all entries above. Continue?'
      );

      if (!confirmed) {
        console.log('\nFix cancelled.');
        return;
      }
    }

    console.log('\n🔄 Processing entries...\n');
    let processed = 0;
    let failed = 0;

    for (const entry of entries) {
      try {
        console.log(`Processing "${entry.title}"...`);

        if (!options.dryRun) {
          // Generate embedding
          const embedding = await LLMService.generateEmbedding(entry.content, 'openai');

          // Validate embedding before updating
          const FileProcessingService = require('../src/services/fileProcessingService');
          FileProcessingService.validateEmbedding(embedding);

          const embeddingVector = `[${embedding.join(',')}]`;

          // Update entry
          await db.query(
            `UPDATE knowledge_base
             SET embedding = $1::vector,
                 updated_at = NOW()
             WHERE id = $2`,
            [embeddingVector, entry.id]
          );

          console.log(`  ✓ Embedding generated and saved`);
        } else {
          console.log(`  [DRY RUN] Would generate embedding`);
        }

        processed++;

        // Delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        console.error(`  ✗ Error: ${error.message}`);
        failed++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Fix completed!');
    console.log(`Processed: ${processed}/${entries.length}`);
    if (failed > 0) {
      console.log(`Failed: ${failed}`);
    }
    console.log('='.repeat(50));

    if (options.dryRun) {
      console.log('\n💡 This was a dry run. Use without --dry-run to apply changes.');
    }

  } catch (error) {
    console.error('\n❌ Fix failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/fix-manual-entries-embeddings.js [options]

Options:
  --dry-run          Show what would be updated without making changes
  --twin-id=<id>     Fix only entries for a specific digital twin
  --force            Skip confirmation prompt
  --help, -h         Show this help message

Examples:
  # Preview what would be fixed
  node scripts/fix-manual-entries-embeddings.js --dry-run

  # Fix a specific digital twin
  node scripts/fix-manual-entries-embeddings.js --twin-id=abc123

  # Fix all without confirmation
  node scripts/fix-manual-entries-embeddings.js --force
  `);
  process.exit(0);
}

// Run fix
fixEmbeddings();
