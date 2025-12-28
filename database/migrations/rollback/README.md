# Migration Rollback Scripts

Rollback scripts to revert transformation migrations (010-013) back to the previous schema.

⚠️ **WARNING**: Use these scripts only in emergency situations during deployment.

## Rollback Scripts

### 1. `010_rollback_knowledge_base.sql`

Reverts migration 010 - transforms `knowledge_bases` back to `digital_twins`.

**What it does**:
- Renames `knowledge_bases` → `digital_twins`
- Renames column `kb_id` → `twin_id`
- Restores dropped columns (personality_traits, communication_style, capabilities, etc.)
- Removes new columns (description, is_public, share_url)
- Updates all foreign key references (kb_id → twin_id)

**Usage**:
```bash
psql -U digitaltwin_user -d digitaltwin -f database/migrations/rollback/010_rollback_knowledge_base.sql
```

### 2. `011_rollback_handover.sql`

Reverts migration 011 - restores the handover system.

**What it does**:
- Recreates `handover_notifications` table
- Adds `handed_over_at` column to `conversations`
- Restores `conversation_status` enum with 'handed_over' value
- Restores `message_sender` enum with 'professional' value

**Usage**:
```bash
psql -U digitaltwin_user -d digitaltwin -f database/migrations/rollback/011_rollback_handover.sql
```

### 3. `012_rollback_oauth.sql`

Reverts migration 012 - removes OAuth support.

**What it does**:
- Drops OAuth columns (oauth_provider, oauth_id, avatar_url)
- Makes `password_hash` NOT NULL again
- Updates user role enum (kb_owner → professional)

⚠️ **WARNING**: This will fail if OAuth users exist (users without password_hash).
Handle OAuth users before running this rollback.

**Usage**:
```bash
psql -U digitaltwin_user -d digitaltwin -f database/migrations/rollback/012_rollback_oauth.sql
```

## Full Rollback Procedure

If you need to rollback the entire transformation:

### Step 1: Stop Services

```bash
# Stop backend and frontend
docker-compose stop backend frontend
```

### Step 2: Backup Current State

```bash
# Even though you're rolling back, backup the current state
pg_dump -U digitaltwin_user -d digitaltwin -F c \
  -f backup_before_rollback_$(date +%Y%m%d_%H%M%S).dump
```

### Step 3: Run Rollback Scripts (Reverse Order)

```bash
# Rollback OAuth (012)
psql -U digitaltwin_user -d digitaltwin \
  -f database/migrations/rollback/012_rollback_oauth.sql

# Rollback Handover Removal (011)
psql -U digitaltwin_user -d digitaltwin \
  -f database/migrations/rollback/011_rollback_handover.sql

# Rollback Knowledge Base Transform (010)
psql -U digitaltwin_user -d digitaltwin \
  -f database/migrations/rollback/010_rollback_knowledge_base.sql
```

### Step 4: Restore Previous Application Code

```bash
# Checkout previous version
git checkout <previous-stable-tag>

# Rebuild containers
docker-compose build

# Start services
docker-compose up -d
```

### Step 5: Verify Rollback

```bash
# Verify tables
psql -U digitaltwin_user -d digitaltwin -c "\dt"

# Should see:
# - digital_twins (NOT knowledge_bases)
# - handover_notifications (restored)
# - users (without OAuth columns)

# Verify enums
psql -U digitaltwin_user -d digitaltwin -c "
  SELECT unnest(enum_range(NULL::conversation_status));
"
# Should show: active, handed_over, closed

psql -U digitaltwin_user -d digitaltwin -c "
  SELECT unnest(enum_range(NULL::message_sender));
"
# Should show: user, assistant, professional

psql -U digitaltwin_user -d digitaltwin -c "
  SELECT unnest(enum_range(NULL::user_role));
"
# Should show: super_admin, professional, end_user
```

## Handling OAuth Users During Rollback

If you have OAuth users (users without password_hash), you must handle them before rollback:

### Option 1: Set Temporary Passwords

```sql
-- Before running 012_rollback_oauth.sql
UPDATE users
SET password_hash = '$2b$10$TEMPORARY_HASH_INVALID_FOR_LOGIN'
WHERE password_hash IS NULL;
```

### Option 2: Delete OAuth Users

```sql
-- WARNING: This deletes user data!
DELETE FROM users WHERE password_hash IS NULL;
```

### Option 3: Skip OAuth Rollback

If you want to keep OAuth users but rollback other changes:

```bash
# Skip 012 rollback, only run 010 and 011
psql -U digitaltwin_user -d digitaltwin \
  -f database/migrations/rollback/011_rollback_handover.sql

psql -U digitaltwin_user -d digitaltwin \
  -f database/migrations/rollback/010_rollback_knowledge_base.sql
```

## Rollback Testing

Always test rollback procedures on staging before using in production.

### Test on Staging

```bash
# 1. Clone production to staging
pg_dump -U prod_user -h prod.db.com -d digitaltwin -F c -f prod.dump
pg_restore -U staging_user -h staging.db.com -d digitaltwin_staging prod.dump

# 2. Run rollback on staging
psql -U staging_user -h staging.db.com -d digitaltwin_staging \
  -f database/migrations/rollback/012_rollback_oauth.sql

psql -U staging_user -h staging.db.com -d digitaltwin_staging \
  -f database/migrations/rollback/011_rollback_handover.sql

psql -U staging_user -h staging.db.com -d digitaltwin_staging \
  -f database/migrations/rollback/010_rollback_knowledge_base.sql

# 3. Verify and test application
```

## Rollback Decision Triggers

Only rollback if:

- ✅ Critical functionality is broken (auth, KB creation, chat)
- ✅ Data corruption detected
- ✅ Security vulnerability discovered
- ✅ Performance degradation >50% from baseline
- ✅ Migration cannot be fixed within 30 minutes

Do NOT rollback if:

- ❌ Minor bugs that can be hotfixed
- ❌ UI issues that don't affect core functionality
- ❌ Performance degradation <25%
- ❌ Issues can be fixed with forward migration

## Rollback Authority

Only these people can authorize rollback (see TRANSFORMATION_PLAN.md):
- Team Lead
- CTO
- On-call Engineer (if team lead unreachable)

**Rollback decision must be made within 30 minutes of identifying critical issue.**

## Post-Rollback Actions

After successful rollback:

1. **Notify users**: Send email about temporary rollback
2. **Post-mortem**: Schedule meeting within 24 hours
3. **Document issues**: Record what went wrong in detail
4. **Fix issues**: Address root causes before next attempt
5. **Reschedule**: Plan new deployment date

## See Also

- `../../TRANSFORMATION_PLAN.md` - Full transformation plan with rollback procedures
- `../010_transform_to_knowledge_base.sql` - Forward migration
- `../011_remove_handover.sql` - Forward migration
- `../012_oauth_support_fixed.sql` - Forward migration
