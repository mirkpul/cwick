#!/bin/bash

# Run incremental migrations for existing deployments
# This applies only the transformation migrations (010-013)

set -e  # Exit on error

DB_USER="${DB_USER:-digitaltwin_user}"
DB_NAME="${DB_NAME:-digitaltwin}"
DB_HOST="${DB_HOST:-localhost}"

MIGRATIONS_DIR="database/migrations"

echo "🔄 Running transformation migrations..."
echo "Database: $DB_NAME@$DB_HOST"
echo "User: $DB_USER"
echo ""

# Function to run a migration
run_migration() {
  local migration_file=$1
  local migration_name=$(basename "$migration_file")

  echo "➡️  Applying: $migration_name"

  psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f "$migration_file"

  if [ $? -eq 0 ]; then
    echo "✅ Success: $migration_name"
  else
    echo "❌ Failed: $migration_name"
    exit 1
  fi

  echo ""
}

# Run transformation migrations in order
echo "📊 Phase 1: Transform to Knowledge Base"
run_migration "$MIGRATIONS_DIR/010_transform_to_knowledge_base.sql"

echo "🗑️  Phase 2: Remove Handover System"
run_migration "$MIGRATIONS_DIR/011_remove_handover.sql"

echo "🔐 Phase 3: Add OAuth Support"
run_migration "$MIGRATIONS_DIR/012_oauth_support_fixed.sql"

echo "🤖 Phase 4: Add Gemini LLM Provider"
run_migration "$MIGRATIONS_DIR/013_add_gemini_llm_provider.sql"

echo ""
echo "✨ All migrations completed successfully!"
echo ""

# Verify migration
echo "📋 Database info:"
psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -c "
  SELECT
    'Tables: ' || COUNT(*)
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
"
