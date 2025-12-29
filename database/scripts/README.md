# Database Scripts

Utility script for database initialization.

## Script

### `init_fresh_db.sh` - Fresh Database Installation

Initialize a new database from scratch using the complete `init_db.sql` schema.

**Use when**: New deployment, development setup, testing, or fresh installation.

**Usage**:
```bash
# Default (localhost)
./database/scripts/init_fresh_db.sh

# Custom database
DB_HOST=localhost \
DB_NAME=digitaltwin \
DB_USER=digitaltwin_user \
DB_PASSWORD=digitaltwin_pass \
./database/scripts/init_fresh_db.sh
```

**What it does**:
- Creates database (drops if exists, with confirmation)
- Creates user with password
- Grants privileges
- Runs `init_db.sql` (complete schema with all tables, indexes, and constraints)

## Environment Variables

All scripts support these environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_NAME` | `digitaltwin` | Database name |
| `DB_USER` | `digitaltwin_user` | Database user |
| `DB_PASSWORD` | `digitaltwin_pass` | User password |

## Examples

### Development Setup (Fresh Install)

```bash
# Set up fresh local database
./database/scripts/init_fresh_db.sh

# Verify tables created
psql -U digitaltwin_user -d digitaltwin -c "\dt"

# Check schema
psql -U digitaltwin_user -d digitaltwin -c "
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  ORDER BY table_name;
"
```

### Production Setup

```bash
# 1. Set environment variables
export DB_HOST=prod.db.example.com
export DB_NAME=digitaltwin_prod
export DB_USER=digitaltwin_user
export DB_PASSWORD=secure_password

# 2. Run initialization
./database/scripts/init_fresh_db.sh

# 3. Verify
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"
```

### Staging/Testing Environment

```bash
# Create test database
DB_NAME=digitaltwin_test \
DB_USER=test_user \
DB_PASSWORD=test_pass \
./database/scripts/init_fresh_db.sh
```

## Schema Information

The `init_db.sql` file contains the complete database schema including:

- **Extensions**: uuid-ossp, vector (pgvector), pg_trgm
- **ENUM Types**: user_role, subscription_tier, llm_provider, conversation_status, message_sender, email_provider, document_job_status
- **Core Tables**: users, subscriptions, knowledge_bases, knowledge_base, end_users, conversations, messages
- **Email Integration**: email_credentials, email_knowledge, email_sync_history
- **RAG & Benchmarking**: benchmark_datasets, benchmark_questions, benchmark_runs, benchmark_results, benchmark_ab_tests
- **Web Scraping**: web_sources, web_scrape_runs
- **Tracking**: llm_usage, vector_store, document_processing_jobs, analytics_events
- **Indexes**: Optimized for performance on all tables
- **Constraints**: Foreign keys, unique constraints, check constraints
- **Triggers**: Auto-update `updated_at` timestamps
- **Views**: LLM cost analytics

## Troubleshooting

### Script Fails: "psql: command not found"

Install PostgreSQL client tools:
```bash
# macOS
brew install postgresql@16

# Ubuntu/Debian
sudo apt-get install postgresql-client

# RHEL/CentOS
sudo yum install postgresql
```

### Permission Denied

Make script executable:
```bash
chmod +x database/scripts/init_fresh_db.sh
```

### Database Already Exists

The script will prompt for confirmation before dropping. Type `yes` to proceed.

### Connection Failed

Verify PostgreSQL is running and credentials are correct:
```bash
psql -h $DB_HOST -U $DB_USER -d postgres -c "SELECT version();"
```

## See Also

- `../init_db.sql` - Complete database schema
- `../seeds/` - Optional seed data for development
- `../../docs/setup/guide.md` - Full setup documentation
