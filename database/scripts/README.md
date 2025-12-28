# Database Scripts

Utility scripts for database initialization and migration management.

## Scripts Overview

### 1. `run_migrations.sh` - Incremental Migrations

Apply transformation migrations (010-013) to an **existing** database.

**Use when**: You have an existing deployment and need to upgrade.

**Usage**:
```bash
# Default (localhost)
./database/scripts/run_migrations.sh

# Custom database
DB_HOST=production.db.example.com \
DB_NAME=digitaltwin \
DB_USER=digitaltwin_user \
./database/scripts/run_migrations.sh
```

**What it does**:
- Runs migrations 010, 011, 012, 013 in order
- Transforms digital_twins → knowledge_bases
- Removes handover system
- Adds OAuth support
- Adds Gemini LLM provider

### 2. `init_fresh_db.sh` - Fresh Installation

Initialize a new database from scratch using aggregated `init_db.sql`.

**Use when**: New deployment, development setup, testing.

**Usage**:
```bash
# Default (localhost)
./database/scripts/init_fresh_db.sh

# Custom database
DB_HOST=localhost \
DB_NAME=digitaltwin_test \
DB_USER=test_user \
DB_PASSWORD=test_pass \
./database/scripts/init_fresh_db.sh
```

**What it does**:
- Creates database (drops if exists, with confirmation)
- Creates user with password
- Grants privileges
- Runs init_db.sql (complete schema)

### 3. `aggregate_migrations.sh` - Generate Init Script

Aggregate individual migrations into a single `init_db.sql` file.

**Use when**: Migrations have changed and you need to regenerate init_db.sql.

**Usage**:
```bash
./database/scripts/aggregate_migrations.sh
```

**What it does**:
- Combines migrations 001-009 into init_db.sql
- Generates header and extension setup
- **IMPORTANT**: Requires manual review to apply transformations (010-013)

**Post-generation steps**:
1. Review generated `database/init_db.sql`
2. Manually apply transformation logic:
   - Rename `digital_twins` → `knowledge_bases`
   - Remove `handover_notifications` table
   - Add OAuth fields to `users` table
   - Add `'gemini'` to `llm_provider` enum
   - Update all `twin_id` → `kb_id` foreign keys

## Environment Variables

All scripts support these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_NAME` | `digitaltwin` | Database name |
| `DB_USER` | `digitaltwin_user` | Database user |
| `DB_PASSWORD` | `digitaltwin_pass` | User password (init_fresh_db.sh only) |

## Examples

### Development Setup (Fresh Install)

```bash
# Set up fresh local database
./database/scripts/init_fresh_db.sh

# Verify
psql -U digitaltwin_user -d digitaltwin -c "\dt"
```

### Production Migration (Existing DB)

```bash
# 1. Backup first!
pg_dump -U digitaltwin_user -h prod.db.com -d digitaltwin \
  -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# 2. Run migrations
DB_HOST=prod.db.com \
DB_NAME=digitaltwin \
DB_USER=digitaltwin_user \
./database/scripts/run_migrations.sh

# 3. Verify
psql -U digitaltwin_user -h prod.db.com -d digitaltwin -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
"
```

### Testing on Staging

```bash
# Clone production to staging
pg_dump -U prod_user -h prod.db.com -d digitaltwin -F c -f prod_backup.dump
pg_restore -U staging_user -h staging.db.com -d digitaltwin_staging prod_backup.dump

# Run migrations on staging
DB_HOST=staging.db.com \
DB_NAME=digitaltwin_staging \
DB_USER=staging_user \
./database/scripts/run_migrations.sh
```

### Regenerate Init Script

```bash
# After modifying migrations 001-009
./database/scripts/aggregate_migrations.sh

# Review and manually edit
vim database/init_db.sql

# Test on fresh database
dropdb digitaltwin_test && createdb digitaltwin_test
psql -U digitaltwin_user -d digitaltwin_test -f database/init_db.sql
```

## Troubleshooting

### Script Fails: "psql: command not found"

Install PostgreSQL client tools:
```bash
# macOS
brew install postgresql

# Ubuntu/Debian
sudo apt-get install postgresql-client

# RHEL/CentOS
sudo yum install postgresql
```

### Permission Denied

Make scripts executable:
```bash
chmod +x database/scripts/*.sh
```

### Database Already Exists (init_fresh_db.sh)

The script will prompt for confirmation before dropping. Type `yes` to proceed.

### Migration Fails Mid-way

Migrations use `set -e` (exit on error). If a migration fails:

1. Check error message
2. Fix the issue (schema conflict, missing table, etc.)
3. Run rollback script if needed (see `database/migrations/rollback/`)
4. Re-run the migration script

## See Also

- `../migrations/` - Individual migration files
- `../migrations/rollback/` - Rollback scripts
- `../init_db.sql` - Aggregated initialization script
- `../../TRANSFORMATION_PLAN.md` - Complete transformation guide
