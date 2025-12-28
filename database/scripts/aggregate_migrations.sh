#!/bin/bash

# Generate aggregated init_db.sql from individual migrations
# Run this whenever migrations change

set -e

MIGRATIONS_DIR="database/migrations"
OUTPUT_FILE="database/init_db.sql"

echo "📦 Aggregating migrations into init_db.sql..."
echo ""

# Start with header
cat > "$OUTPUT_FILE" << 'EOF'
-- ============================================
-- RAG Multitenant Knowledge Base System
-- Complete Database Schema
-- Generated from migrations 001-013
-- Auto-generated - DO NOT EDIT MANUALLY
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

EOF

# Aggregate migrations (001-009 for base, then transformed schema)
echo "Adding base migrations (001-009)..."

for i in {1..9}; do
  migration_file=$(printf "$MIGRATIONS_DIR/%03d_*.sql" $i)

  if [ -f $migration_file ]; then
    echo "  ➕ $(basename $migration_file)"
    echo "" >> "$OUTPUT_FILE"
    echo "-- Migration: $(basename $migration_file)" >> "$OUTPUT_FILE"
    cat "$migration_file" >> "$OUTPUT_FILE"
    echo "" >> "$OUTPUT_FILE"
  fi
done

# Note: DON'T include 010-013 as they're transformations
# Instead, the init_db.sql should have the FINAL schema

echo ""
echo "✅ Generated: $OUTPUT_FILE"
echo "📊 Size: $(wc -c < "$OUTPUT_FILE") bytes"
echo ""
echo "⚠️  NOTE: Review and manually adjust init_db.sql to reflect"
echo "   the FINAL schema after transformations (010-013)."
echo ""
echo "   You need to manually apply the following changes:"
echo "   - Rename digital_twins → knowledge_bases"
echo "   - Remove handover_notifications table"
echo "   - Add OAuth fields to users table"
echo "   - Add 'gemini' to llm_provider enum"
echo "   - Update foreign keys (twin_id → kb_id)"
echo ""
