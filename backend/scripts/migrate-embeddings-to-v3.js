#!/usr/bin/env node

/**
 * Migration Script: Upgrade Embeddings from ada-002 to text-embedding-3-small
 *
 * This script re-generates all embeddings in the knowledge base using the new
 * text-embedding-3-small model, which provides better score distribution and
 * improved retrieval accuracy.
 *
 * Usage:
 *   node scripts/migrate-embeddings-to-v3.js [options]
 *
 * Options:
 *   --dry-run          Show what would be migrated without making changes
 *   --twin-id=<id>     Migrate only a specific digital twin
 *   --batch-size=<n>   Number of entries to process per batch (default: 50)
 *   --force            Skip confirmation prompt
 *
 * Examples:
 *   node scripts/migrate-embeddings-to-v3.js --dry-run
 *   node scripts/migrate-embeddings-to-v3.js --twin-id=abc123
 *   node scripts/migrate-embeddings-to-v3.js --batch-size=100 --force
 */

require('dotenv').config();
const db = require('../src/config/database');
const LLMService = require('../src/services/llmService');
const readline = require('readline');

// Signal handlers for graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n⚠️  Migration interrupted by user (SIGINT). Cleaning up...');
  await db.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n⚠️  Migration terminated (SIGTERM). Cleaning up...');
  await db.end();
  process.exit(0);
});

// Parse command line arguments
const args = process.argv.slice(2);

// Parse batch size with validation
const batchSizeArg = args.find(arg => arg.startsWith('--batch-size='))?.split('=')[1];
let batchSize = 50; // default

if (batchSizeArg) {
  batchSize = parseInt(batchSizeArg, 10);
  if (isNaN(batchSize) || batchSize < 1 || batchSize > 1000) {
    console.error('❌ Error: batch-size must be a number between 1 and 1000');
    process.exit(1);
  }
}

const options = {
  dryRun: args.includes('--dry-run'),
  twinId: args.find(arg => arg.startsWith('--twin-id='))?.split('=')[1],
  batchSize,
  force: args.includes('--force'),
};

console.log('🚀 Embedding Migration Script v3');
console.log('='.repeat(50));
console.log(`Mode: ${options.dryRun ? 'DRY RUN' : 'LIVE'}`);
console.log(`Batch size: ${options.batchSize}`);
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
 * Get all knowledge base entries that need migration
 */
async function getEntriesToMigrate() {
  let query = `
    SELECT id, twin_id, content, file_name, chunk_index, total_chunks
    FROM knowledge_base
    WHERE embedding IS NOT NULL
  `;

  const params = [];

  if (options.twinId) {
    query += ' AND twin_id = $1';
    params.push(options.twinId);
  }

  query += ' ORDER BY twin_id, file_name, chunk_index';

  const result = await db.query(query, params);
  return result.rows;
}

/**
 * Process entries in batches
 */
async function processBatch(entries, startIndex) {
  const batch = entries.slice(startIndex, startIndex + options.batchSize);

  if (batch.length === 0) return 0;

  console.log(
    `\nProcessing batch ${Math.floor(startIndex / options.batchSize) + 1}: ` +
    `entries ${startIndex + 1}-${startIndex + batch.length}...`
  );

  try {
    // Extract content for batch embedding generation
    const contents = batch.map(entry => entry.content);

    console.log('  → Generating embeddings...');
    const embeddings = await LLMService.generateBatchEmbeddings(contents, 'openai');

    if (options.dryRun) {
      console.log(`  → [DRY RUN] Would update ${batch.length} embeddings`);
      return batch.length;
    }

    // Validate embeddings before updating
    const FileProcessingService = require('../src/services/fileProcessingService');
    for (let i = 0; i < embeddings.length; i++) {
      try {
        FileProcessingService.validateEmbedding(embeddings[i]);
      } catch (validationError) {
        throw new Error(
          `Invalid embedding for entry ${batch[i].id}: ${validationError.message}`
        );
      }
    }

    // Update embeddings in database with transaction safety
    console.log('  → Updating database...');
    let updateCount = 0;

    // Use a transaction for the batch
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      for (let i = 0; i < batch.length; i++) {
        const entry = batch[i];
        const embedding = embeddings[i];
        const embeddingVector = `[${embedding.join(',')}]`;

        await client.query(
          `UPDATE knowledge_base
           SET embedding = $1::vector,
               updated_at = NOW()
           WHERE id = $2`,
          [embeddingVector, entry.id]
        );

        updateCount++;

        // Progress indicator
        if (updateCount % 10 === 0) {
          process.stdout.write('.');
        }
      }

      await client.query('COMMIT');
      console.log(`\n  ✓ Updated ${updateCount} entries`);
      return updateCount;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error(`\n  ✗ Error processing batch:`, error.message);
    throw error;
  }
}

/**
 * Main migration function
 */
async function migrate() {
  try {
    // Get entries to migrate
    console.log('📊 Analyzing knowledge base...\n');
    const entries = await getEntriesToMigrate();

    if (entries.length === 0) {
      console.log('No entries found to migrate.');
      return;
    }

    // Group by twin for statistics
    const twinGroups = entries.reduce((acc, entry) => {
      acc[entry.twin_id] = (acc[entry.twin_id] || 0) + 1;
      return acc;
    }, {});

    console.log(`Total entries to migrate: ${entries.length}`);
    console.log(`Digital twins affected: ${Object.keys(twinGroups).length}`);
    console.log('\nBreakdown by twin:');
    Object.entries(twinGroups).forEach(([twinId, count]) => {
      console.log(`  - ${twinId}: ${count} entries`);
    });

    // Estimate cost and time
    const estimatedCost = (entries.length / 1000) * 0.00002; // $0.00002 per 1K tokens
    const estimatedMinutes = Math.ceil((entries.length / options.batchSize) * 0.5); // ~30s per batch

    console.log(`\n💰 Estimated cost: $${estimatedCost.toFixed(4)}`);
    console.log(`⏱️  Estimated time: ~${estimatedMinutes} minutes`);
    console.log();

    // Confirm before proceeding
    if (!options.dryRun) {
      const confirmed = await confirm(
        '⚠️  This will replace all existing embeddings. Continue?'
      );

      if (!confirmed) {
        console.log('\nMigration cancelled.');
        return;
      }
    }

    console.log('\n🔄 Starting migration...\n');
    const startTime = Date.now();

    // Process in batches
    let totalProcessed = 0;
    for (let i = 0; i < entries.length; i += options.batchSize) {
      const processed = await processBatch(entries, i);
      totalProcessed += processed;

      // Progress percentage
      const progress = ((totalProcessed / entries.length) * 100).toFixed(1);
      console.log(`Progress: ${progress}% (${totalProcessed}/${entries.length})`);

      // Delay between batches to avoid rate limiting (exponentially increase if needed)
      if (i + options.batchSize < entries.length) {
        const delayMs = 500; // 500ms delay between batches
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed successfully!');
    console.log(`Total entries processed: ${totalProcessed}`);
    console.log(`Time taken: ${duration} minutes`);
    console.log('='.repeat(50));

    if (options.dryRun) {
      console.log('\n💡 This was a dry run. Use without --dry-run to apply changes.');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await db.end();
  }
}

// Show help
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: node scripts/migrate-embeddings-to-v3.js [options]

Options:
  --dry-run          Show what would be migrated without making changes
  --twin-id=<id>     Migrate only a specific digital twin
  --batch-size=<n>   Number of entries to process per batch (default: 50)
  --force            Skip confirmation prompt
  --help, -h         Show this help message

Examples:
  # Preview migration without making changes
  node scripts/migrate-embeddings-to-v3.js --dry-run

  # Migrate a specific digital twin
  node scripts/migrate-embeddings-to-v3.js --twin-id=abc123

  # Migrate all with custom batch size
  node scripts/migrate-embeddings-to-v3.js --batch-size=100 --force

Note: Make sure to backup your database before running this script!
  `);
  process.exit(0);
}

// Run migration
migrate();
