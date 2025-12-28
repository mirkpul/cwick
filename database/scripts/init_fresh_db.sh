#!/bin/bash

# Initialize database from scratch using aggregated init_db.sql
# Use this for NEW deployments only

set -e

DB_USER="${DB_USER:-digitaltwin_user}"
DB_NAME="${DB_NAME:-digitaltwin}"
DB_HOST="${DB_HOST:-localhost}"
DB_PASSWORD="${DB_PASSWORD:-digitaltwin_pass}"

echo "🚀 Initializing fresh database..."
echo "Database: $DB_NAME@$DB_HOST"
echo ""

# Check if database exists
DB_EXISTS=$(psql -U postgres -h "$DB_HOST" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'" 2>/dev/null || echo "")

if [ "$DB_EXISTS" = "1" ]; then
  echo "⚠️  WARNING: Database '$DB_NAME' already exists!"
  read -p "Do you want to DROP and recreate it? (yes/no): " confirm

  if [ "$confirm" != "yes" ]; then
    echo "❌ Aborted."
    exit 1
  fi

  echo "🗑️  Dropping existing database..."
  psql -U postgres -h "$DB_HOST" -c "DROP DATABASE $DB_NAME;"
fi

# Create database
echo "📦 Creating database: $DB_NAME"
psql -U postgres -h "$DB_HOST" -c "CREATE DATABASE $DB_NAME;"

# Create user if not exists
echo "👤 Creating user: $DB_USER"
psql -U postgres -h "$DB_HOST" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
      CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD';
    END IF;
  END
  \$\$;
"

# Grant privileges
echo "🔑 Granting privileges..."
psql -U postgres -h "$DB_HOST" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

# Run init_db.sql
echo "📊 Running init_db.sql..."
psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" -f database/init_db.sql

echo ""
echo "✅ Database initialized successfully!"
echo ""
echo "📊 Connection info:"
echo "   Host: $DB_HOST"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo ""
