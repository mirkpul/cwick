# 🔄 Digital Twin → Simple RAG Multitenant - Transformation Plan

## Executive Summary

Transformation of the existing Digital Twin SAAS platform into a simplified RAG (Retrieval-Augmented Generation) multitenant system where users create Knowledge Bases (KB), validate them with benchmarks, and share them via chat interface.

**Deployment Strategy**: Big Bang (single release, all changes at once)
**Project Timeline**: Estimated 3-4 weeks development + 1 week pre-deployment validation
**Deployment Window**: TBD (requires maintenance downtime ~2-4 hours)

---

## 🎯 Transformation Goals

### What We Keep ✅
- All KB data sources (documents, FAQ, web scraping, email integration)
- Complete benchmark/evaluation system
- Conversation system with end_users
- Subscription tiers with usage limits
- Advanced RAG configuration (hybrid search, reranking, etc.)
- Dashboard with tabs structure
- OpenAI + Anthropic LLM providers
- PostgreSQL with pgvector
- React + TypeScript + Tailwind CSS frontend

### What We Add 🆕
- **Gemini (Google AI)** LLM provider
- **OAuth Social Login** (Google, GitHub)
- Simplified KB creation flow

### What We Remove ❌
- Complete handover system (tables, services, WebSocket notifications)
- Digital Twin personality/capabilities/business settings
- OnboardingWizard (multi-step twin creation)
- Professional intervention in conversations

### What We Transform 🔄
- `digital_twins` table → `knowledge_bases` (conceptually)
- `ProfessionalDashboard` → `KBManagementDashboard`
- Routes: `digitalTwinRoutes` → `knowledgeBaseRoutes`
- Services: `digitalTwinService` → `knowledgeBaseService`
- User role: `professional` → `kb_owner`

---

## 📊 Implementation Status Tracker

Track progress of all transformation tasks. Update checkboxes as work is completed.

### Phase 1: Database Migrations
- [ ] Migration 010: Transform digital_twins → knowledge_bases
  - [ ] Write migration SQL
  - [ ] Test on local database
  - [ ] Test on staging database
  - [ ] Verify all foreign key updates
  - [ ] Verify index recreation
- [ ] Migration 011: Remove handover system
  - [ ] Write migration SQL
  - [ ] Test enum type migrations
  - [ ] Verify data conversion (handed_over → active)
  - [ ] Test on staging database
- [ ] Migration 012: Add OAuth support
  - [ ] Write migration SQL
  - [ ] Test role enum migration
  - [ ] Verify nullable password_hash
  - [ ] Test on staging database
- [ ] Migration 013: Add Gemini LLM provider
  - [ ] Write migration SQL
  - [ ] Test llm_provider enum update
  - [ ] Test on staging database
- [ ] Database Initialization Scripts
  - [ ] Create aggregated init_db.sql (complete schema)
  - [ ] Create run_migrations.sh (incremental migrations)
  - [ ] Create init_fresh_db.sh (fresh install)
  - [ ] Create aggregate_migrations.sh (generate init_db)
  - [ ] Test all scripts on local environment
  - [ ] Update docker-compose.yml for init_db.sql
- [ ] Create rollback scripts for all migrations
  - [ ] 010_rollback_knowledge_base.sql
  - [ ] 011_rollback_handover.sql
  - [ ] 012_rollback_oauth.sql
- [ ] Full backup script tested
- [ ] Validation queries documented and tested

### Phase 2: Backend Core Refactoring
- [ ] Services
  - [ ] Rename digitalTwinService.ts → knowledgeBaseService.ts
  - [ ] Update all function names (createDigitalTwin → createKnowledgeBase)
  - [ ] Update all database queries (digital_twins → knowledge_bases)
  - [ ] Remove personality/capabilities logic
  - [ ] Update tests
- [ ] Routes
  - [ ] Rename digitalTwinRoutes.ts → knowledgeBaseRoutes.ts
  - [ ] Update route paths (/api/digital-twins → /api/knowledge-bases)
  - [ ] Update path parameters (twinId → kbId)
  - [ ] Update controller method calls
  - [ ] Update tests
- [ ] Types & Interfaces
  - [ ] Update all type definitions (DigitalTwin → KnowledgeBase)
  - [ ] Update all interfaces
  - [ ] Update constants

### Phase 3: Backend New Features
- [ ] Gemini LLM Integration
  - [ ] Install @google/generative-ai dependency
  - [ ] Update LLMProvider type enum
  - [ ] Implement generateResponseGemini()
  - [ ] Implement generateStreamingResponseGemini()
  - [ ] Add error handling
  - [ ] Write tests
  - [ ] Test with real Gemini API
- [ ] OAuth Authentication
  - [ ] Install passport dependencies
  - [ ] Create oauth.config.ts
  - [ ] Create oauthService.ts
  - [ ] Create oauthRoutes.ts
  - [ ] Implement Google OAuth strategy
  - [ ] Implement GitHub OAuth strategy
  - [ ] Update authService for OAuth users
  - [ ] Write tests
  - [ ] Test OAuth flow end-to-end

### Phase 4: Backend Cleanup (Remove Handover)
- [ ] Delete handover files
  - [ ] Delete handoverService.ts (if exists)
  - [ ] Delete handoverController.ts (if exists)
- [ ] Update WebSocket service
  - [ ] Remove professional_takeover handler
  - [ ] Remove handover_notification handler
  - [ ] Update message type validations
  - [ ] Update tests
- [ ] Update Chat service
  - [ ] Remove handover confidence checking
  - [ ] Remove createHandoverNotification()
  - [ ] Remove professional message logic
  - [ ] Update tests
- [ ] Update Chat routes
  - [ ] Remove handover endpoints
  - [ ] Update tests

### Phase 5: Frontend Core Refactoring
- [ ] Dashboard Refactoring
  - [ ] Rename ProfessionalDashboard.tsx → KBManagementDashboard.tsx
  - [ ] Update component name
  - [ ] Remove "Handovers" tab
  - [ ] Update all API calls (digitalTwinAPI → knowledgeBaseAPI)
  - [ ] Update state variables (digitalTwin → knowledgeBase, twinId → kbId)
  - [ ] Update tests
- [ ] API Service Layer
  - [ ] Rename digitalTwinAPI → knowledgeBaseAPI
  - [ ] Update all endpoint paths
  - [ ] Update all parameters (twinId → kbId)
  - [ ] Update chatAPI references
  - [ ] Update emailAPI references
  - [ ] Update benchmarkAPI references
- [ ] Types & Props
  - [ ] Global find/replace: digitalTwin → knowledgeBase
  - [ ] Global find/replace: twinId → kbId
  - [ ] Global find/replace: DigitalTwin → KnowledgeBase (types)
  - [ ] Verify all prop types updated

### Phase 6: Frontend New Features
- [ ] OAuth Login UI
  - [ ] Install react-icons dependency
  - [ ] Update Login.tsx with OAuth buttons
  - [ ] Create OAuthCallback.tsx component
  - [ ] Add /oauth/callback route to App.tsx
  - [ ] Style OAuth buttons
  - [ ] Test OAuth flow
- [ ] KB Creation Modal
  - [ ] Create CreateKBModal.tsx
  - [ ] Implement form (name, description, LLM provider/model)
  - [ ] Add LLM model dropdown logic
  - [ ] Integrate with knowledgeBaseAPI.create()
  - [ ] Add to dashboard
  - [ ] Test creation flow
- [ ] Remove Onboarding Wizard
  - [ ] Delete OnboardingWizard.tsx
  - [ ] Remove route from App.tsx
  - [ ] Remove tests
  - [ ] Update navigation logic

### Phase 7: Frontend Cleanup
- [ ] Remove handover components
  - [ ] Remove HandoverNotification component (if exists)
  - [ ] Remove WebSocket handover listeners
  - [ ] Remove handover-related state
  - [ ] Update tests

### Phase 8: Configuration & Documentation
- [ ] Environment Variables
  - [ ] Add GEMINI_API_KEY to .env.example
  - [ ] Add Google OAuth credentials to .env.example
  - [ ] Add GitHub OAuth credentials to .env.example
  - [ ] Update Docker environment files
  - [ ] Update CI/CD secrets documentation
- [ ] Documentation Updates
  - [ ] Update CLAUDE.md (Digital Twin → Knowledge Base terminology)
  - [ ] Update README.md
  - [ ] Update API documentation
  - [ ] Create OAuth setup guide
  - [ ] Update architecture diagrams
  - [ ] Update deployment guide

### Phase 9: Testing & Quality Assurance
- [ ] Backend Tests
  - [ ] All auth tests pass (incl. OAuth)
  - [ ] All knowledge base tests pass
  - [ ] All chat tests pass (no handover tests)
  - [ ] All email integration tests pass
  - [ ] All benchmark tests pass
  - [ ] Type checking passes (npm run type-check)
  - [ ] Linting passes (npm run lint)
  - [ ] Build succeeds (npm run build)
- [ ] Frontend Tests
  - [ ] All dashboard tests pass
  - [ ] All auth tests pass (incl. OAuth)
  - [ ] All KB creation tests pass
  - [ ] Type checking passes (npm run type-check)
  - [ ] Linting passes (npm run lint)
  - [ ] Build succeeds (npm run build)
- [ ] Integration Tests
  - [ ] End-to-end: Register → Create KB → Add knowledge → Chat
  - [ ] End-to-end: OAuth login → Dashboard
  - [ ] End-to-end: Email sync → Semantic search
  - [ ] End-to-end: Benchmark creation → Evaluation

### Phase 10: Pre-Deployment Validation
- [ ] Security Review (see Security Checklist below)
- [ ] Performance Testing (see Performance Plan below)
- [ ] Staging Deployment
  - [ ] Deploy to staging environment
  - [ ] Run all migrations on staging DB
  - [ ] Smoke tests on staging
  - [ ] Load testing on staging
- [ ] Rollback Testing
  - [ ] Test database rollback scripts
  - [ ] Test application rollback procedure
  - [ ] Document rollback steps
- [ ] Go/No-Go Review (see Go/No-Go Criteria below)

---

## 🚀 Big Bang Deployment Strategy

### Why Big Bang?
- Database schema changes are breaking (table/column renames)
- API endpoints change (impossible to maintain backward compatibility)
- Frontend and backend are tightly coupled
- Cleaner than maintaining two parallel systems
- Simpler testing and validation

### Deployment Plan

#### Pre-Deployment (D-7 to D-1)
1. **Week Before (D-7)**:
   - Finalize all code changes
   - Complete all testing phases
   - Deploy to staging environment
   - Run full integration tests
   - Security audit completion

2. **3 Days Before (D-3)**:
   - User notification: upcoming maintenance window
   - Email to all users with downtime details
   - In-app banner announcement
   - Prepare support team with FAQs

3. **1 Day Before (D-1)**:
   - Final staging validation
   - Go/No-Go meeting with team
   - Confirm backup procedures
   - Prepare rollback scripts
   - Coordinate team availability

#### Deployment Day (D-Day)

**Maintenance Window: 4 hours (e.g., 02:00 AM - 06:00 AM UTC)**

**Timeline**:

**T-30min: Pre-deployment checks**
- [ ] All team members online and ready
- [ ] Backup scripts tested and ready
- [ ] Rollback procedures reviewed
- [ ] Monitoring dashboards open
- [ ] Communication channels ready (Slack, email)

**T+0:00: Begin maintenance**
- [ ] Display maintenance page
- [ ] Stop accepting new requests
- [ ] Wait for active sessions to complete (5 min grace period)

**T+0:05: Full database backup**
- [ ] Run pg_dump for complete backup
- [ ] Verify backup file integrity
- [ ] Store backup in secure location
- [ ] Backup file size and checksum recorded

**T+0:20: Stop services**
- [ ] Stop backend containers (docker-compose stop backend)
- [ ] Stop frontend containers (docker-compose stop frontend)
- [ ] Verify all connections closed

**T+0:25: Database migrations**
- [ ] Run migration 010 (transform to knowledge_bases)
- [ ] Verify migration success
- [ ] Run migration 011 (remove handover)
- [ ] Verify migration success
- [ ] Run migration 012 (OAuth support)
- [ ] Verify migration success
- [ ] Run data validation queries
- [ ] Take post-migration snapshot

**T+0:45: Deploy new application code**
- [ ] Pull latest code from main branch
- [ ] Update environment variables
- [ ] Build Docker images (docker-compose build)
- [ ] Verify image builds successful

**T+1:00: Start services**
- [ ] Start database (if restarted)
- [ ] Start backend (docker-compose up -d backend)
- [ ] Wait for backend health check
- [ ] Start frontend (docker-compose up -d frontend)
- [ ] Wait for frontend health check

**T+1:15: Smoke testing**
- [ ] Backend health endpoint responds
- [ ] Frontend loads correctly
- [ ] User login works (email/password)
- [ ] OAuth login works (Google)
- [ ] OAuth login works (GitHub)
- [ ] Create new KB works
- [ ] Add knowledge to KB works
- [ ] Chat with KB works
- [ ] Gemini LLM responds
- [ ] Email sync works
- [ ] Benchmark runs

**T+1:45: Validation**
- [ ] Check error logs (no critical errors)
- [ ] Verify database connections stable
- [ ] Check API response times
- [ ] Verify WebSocket connections
- [ ] Run automated integration tests

**T+2:00: Monitor & observe**
- [ ] Watch error rates in monitoring
- [ ] Check database query performance
- [ ] Monitor memory and CPU usage
- [ ] Watch API latency metrics
- [ ] Check user activity (if any early users)

**T+2:30: Go-live decision**
- [ ] All smoke tests passed
- [ ] No critical errors in logs
- [ ] Performance metrics acceptable
- [ ] Team consensus: GO
- [ ] Remove maintenance page
- [ ] Announce service restored

**T+2:30 - T+4:00: Post-deployment monitoring**
- [ ] Monitor user logins
- [ ] Watch for errors in production
- [ ] Check database performance
- [ ] Monitor LLM API calls (OpenAI, Anthropic, Gemini)
- [ ] Be ready for rollback if needed

#### Post-Deployment (D+1 to D+7)

**Day 1 (D+1)**:
- Monitor all metrics closely
- Respond to user issues quickly
- Daily team sync
- Document any issues encountered

**Day 2-7 (D+2 to D+7)**:
- Continue monitoring
- Address user feedback
- Optimize performance if needed
- Plan for any hotfixes

### Rollback Plan

If critical issues occur during deployment, execute rollback:

**Rollback Triggers**:
- Migration fails and cannot be fixed within 30 minutes
- Critical functionality broken (auth, KB creation, chat)
- Data corruption detected
- Security vulnerability discovered
- Performance degradation >50% from baseline

**Rollback Procedure** (30-60 minutes):

1. **T+0: Decision to rollback**
   - Team consensus required
   - Document reason for rollback

2. **T+5: Stop new application**
   - Stop backend and frontend containers
   - Display maintenance page

3. **T+10: Restore database**
   - Drop current database (if safe) or restore from backup
   ```bash
   pg_restore -U digitaltwin_user -d digitaltwin backup_YYYYMMDD_HHMMSS.dump
   ```
   - Verify data integrity

4. **T+30: Deploy old application code**
   - Checkout previous stable version
   - Build and deploy old containers
   - Start services

5. **T+45: Validate rollback**
   - Test critical paths
   - Verify users can login
   - Check existing functionality works

6. **T+60: Announce rollback complete**
   - Remove maintenance page
   - Notify users (email)
   - Post-mortem meeting scheduled

---

## 📊 Database Schema Transformations

### Migration 1: Transform digital_twins → knowledge_bases

**File**: `database/migrations/010_transform_to_knowledge_base.sql`

```sql
-- Step 1: Rename table
ALTER TABLE digital_twins RENAME TO knowledge_bases;

-- Step 2: Rename columns
ALTER TABLE knowledge_bases RENAME COLUMN twin_id TO kb_id;

-- Step 3: Drop columns (Digital Twin specific)
ALTER TABLE knowledge_bases
  DROP COLUMN IF EXISTS personality_traits,
  DROP COLUMN IF EXISTS communication_style,
  DROP COLUMN IF EXISTS capabilities,
  DROP COLUMN IF EXISTS services,
  DROP COLUMN IF EXISTS pricing_info,
  DROP COLUMN IF EXISTS availability_schedule,
  DROP COLUMN IF EXISTS profession,
  DROP COLUMN IF EXISTS bio;

-- Step 4: Simplify remaining columns
-- Keep: id, user_id, name, avatar_url,
--       llm_provider, llm_model, system_prompt, temperature, max_tokens,
--       semantic_search_threshold, semantic_search_max_results, rag_config,
--       is_active, created_at, updated_at

-- Step 5: Add new columns
ALTER TABLE knowledge_bases
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS share_url VARCHAR(255) UNIQUE;

-- Step 6: Update indexes
DROP INDEX IF EXISTS idx_digital_twins_user_id;
CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX idx_knowledge_bases_share_url ON knowledge_bases(share_url) WHERE share_url IS NOT NULL;

-- Step 7: Update foreign keys
ALTER TABLE knowledge_base RENAME COLUMN twin_id TO kb_id;
ALTER TABLE conversations RENAME COLUMN twin_id TO kb_id;
ALTER TABLE rag_datasets RENAME COLUMN twin_id TO kb_id;
-- etc. for all tables with twin_id foreign key
```

### Migration 2: Remove Handover System

**File**: `database/migrations/011_remove_handover.sql`

```sql
-- Drop handover_notifications table
DROP TABLE IF EXISTS handover_notifications CASCADE;

-- Remove handover columns from conversations
ALTER TABLE conversations
  DROP COLUMN IF EXISTS handed_over_at;

-- Update conversation status enum (remove 'handed_over')
-- Note: In PostgreSQL, need to create new type and migrate
CREATE TYPE conversation_status_new AS ENUM ('active', 'closed');

ALTER TABLE conversations
  ALTER COLUMN status TYPE conversation_status_new
  USING CASE
    WHEN status = 'handed_over' THEN 'active'::conversation_status_new
    ELSE status::text::conversation_status_new
  END;

DROP TYPE conversation_status;
ALTER TYPE conversation_status_new RENAME TO conversation_status;

-- Remove 'professional' from message sender enum
CREATE TYPE message_sender_new AS ENUM ('user', 'assistant');

ALTER TABLE messages
  ALTER COLUMN sender TYPE message_sender_new
  USING CASE
    WHEN sender = 'professional' THEN 'assistant'::message_sender_new
    ELSE sender::text::message_sender_new
  END;

DROP TYPE message_sender;
ALTER TYPE message_sender_new RENAME TO message_sender;
```

### Migration 3: Add OAuth Support

**File**: `database/migrations/012_oauth_support.sql`

```sql
-- Add OAuth columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS oauth_provider VARCHAR(50),
  ADD COLUMN IF NOT EXISTS oauth_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(500);

-- Make password_hash nullable (for OAuth users)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Add unique constraint for OAuth
CREATE UNIQUE INDEX idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;

-- Update role enum to rename 'professional' → 'kb_owner'
CREATE TYPE user_role_new AS ENUM ('super_admin', 'kb_owner', 'end_user');

ALTER TABLE users
  ALTER COLUMN role TYPE user_role_new
  USING CASE
    WHEN role = 'professional' THEN 'kb_owner'::user_role_new
    ELSE role::text::user_role_new
  END;

DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;
```

---

## 📦 Database Initialization & Migration Aggregation

### Overview

For **existing deployments**, run incremental migrations (010, 011, 012).
For **fresh installations**, use aggregated `init_db.sql` for faster setup.

### Migration Files Structure

```
database/
├── migrations/
│   ├── 001_initial_schema.sql          # Base schema (users, twins, knowledge_base)
│   ├── 002_email_knowledge_base.sql    # Email integration tables
│   ├── 003_rag_config.sql              # RAG configuration
│   ├── 004_rag_benchmark.sql           # Benchmark/evaluation system
│   ├── 005_web_scraping.sql            # Web sources tables
│   ├── 006_digital_twin_purpose.sql    # Purpose field
│   ├── 007_llm_usage_tracking.sql      # LLM usage metrics
│   ├── 008_vector_store.sql            # Vector embeddings
│   ├── 009_document_processing_jobs.sql # Document jobs
│   ├── 010_transform_to_knowledge_base.sql  # TRANSFORMATION
│   ├── 011_remove_handover.sql              # TRANSFORMATION
│   ├── 012_oauth_support_fixed.sql          # TRANSFORMATION (use _fixed version)
│   ├── 013_add_gemini_llm_provider.sql      # TRANSFORMATION
│   └── rollback/
│       ├── 010_rollback_knowledge_base.sql
│       ├── 011_rollback_handover.sql
│       └── 012_rollback_oauth.sql
├── init_db.sql                         # AGGREGATED: Fresh install (all-in-one)
└── scripts/
    ├── run_migrations.sh               # Run incremental migrations
    ├── init_fresh_db.sh                # Initialize from scratch
    └── aggregate_migrations.sh         # Generate init_db.sql
```

### Aggregated Init Script

**File**: `database/init_db.sql`

This script combines ALL migrations (001-013) into a single file for fresh installations.

```sql
-- ============================================
-- RAG Multitenant Knowledge Base System
-- Complete Database Schema
-- Generated from migrations 001-013
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE user_role AS ENUM ('super_admin', 'kb_owner', 'end_user');
CREATE TYPE conversation_status AS ENUM ('active', 'closed');
CREATE TYPE message_sender AS ENUM ('user', 'assistant');
CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic', 'gemini');
CREATE TYPE document_job_status AS ENUM ('pending', 'processing', 'completed', 'failed');
CREATE TYPE email_provider AS ENUM ('gmail', 'outlook', 'imap');

-- ============================================
-- CORE TABLES
-- ============================================

-- Users table (with OAuth support)
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),  -- Nullable for OAuth users
  name VARCHAR(255),
  role user_role DEFAULT 'kb_owner',
  subscription_tier VARCHAR(50) DEFAULT 'free',

  -- OAuth fields
  oauth_provider VARCHAR(50),
  oauth_id VARCHAR(255),
  avatar_url VARCHAR(500),

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Unique constraint for OAuth
CREATE UNIQUE INDEX idx_users_oauth
  ON users(oauth_provider, oauth_id)
  WHERE oauth_provider IS NOT NULL;

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);

-- Knowledge Bases (transformed from digital_twins)
CREATE TABLE knowledge_bases (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  avatar_url VARCHAR(500),

  -- LLM Configuration
  llm_provider llm_provider DEFAULT 'openai',
  llm_model VARCHAR(100) DEFAULT 'gpt-4',
  system_prompt TEXT,
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 1000,

  -- RAG Configuration
  semantic_search_threshold DECIMAL(3,2) DEFAULT 0.80,
  semantic_search_max_results INTEGER DEFAULT 3,
  rag_config JSONB,

  -- Sharing
  is_public BOOLEAN DEFAULT false,
  share_url VARCHAR(255) UNIQUE,

  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX idx_knowledge_bases_share_url ON knowledge_bases(share_url)
  WHERE share_url IS NOT NULL;

-- Knowledge Base entries
CREATE TABLE knowledge_base (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  answer TEXT NOT NULL,
  metadata JSONB,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_knowledge_base_kb_id ON knowledge_base(kb_id);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base
  USING ivfflat (embedding vector_cosine_ops);

-- End Users (people chatting with KBs)
CREATE TABLE end_users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  phone VARCHAR(50),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_end_users_email ON end_users(email);

-- Conversations
CREATE TABLE conversations (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  end_user_id INTEGER REFERENCES end_users(id) ON DELETE SET NULL,
  status conversation_status DEFAULT 'active',
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_conversations_kb_id ON conversations(kb_id);
CREATE INDEX idx_conversations_status ON conversations(status);

-- Messages
CREATE TABLE messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  sender message_sender NOT NULL,
  content TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- ============================================
-- EMAIL INTEGRATION
-- ============================================

CREATE TABLE email_credentials (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider email_provider NOT NULL,
  email_address VARCHAR(255) NOT NULL,
  encrypted_credentials TEXT NOT NULL,
  refresh_token TEXT,
  auto_sync_enabled BOOLEAN DEFAULT false,
  sync_frequency_hours INTEGER DEFAULT 24,
  months_to_sync INTEGER DEFAULT 6,
  last_synced_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, provider)
);

CREATE INDEX idx_email_credentials_user_id ON email_credentials(user_id);

CREATE TABLE email_knowledge (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  email_id VARCHAR(255) UNIQUE NOT NULL,
  subject TEXT,
  sender VARCHAR(255),
  recipient VARCHAR(255),
  body TEXT,
  cleaned_content TEXT,
  received_at TIMESTAMP,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_email_knowledge_kb_id ON email_knowledge(kb_id);
CREATE INDEX idx_email_knowledge_embedding ON email_knowledge
  USING ivfflat (embedding vector_cosine_ops);

CREATE TABLE email_sync_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  provider email_provider NOT NULL,
  emails_fetched INTEGER DEFAULT 0,
  emails_processed INTEGER DEFAULT 0,
  status VARCHAR(50),
  error_message TEXT,
  started_at TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE INDEX idx_email_sync_history_user_id ON email_sync_history(user_id);

-- ============================================
-- RAG BENCHMARK SYSTEM
-- ============================================

CREATE TABLE rag_datasets (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  created_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rag_datasets_kb_id ON rag_datasets(kb_id);

CREATE TABLE rag_test_cases (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES rag_datasets(id) ON DELETE CASCADE,
  question TEXT NOT NULL,
  expected_answer TEXT,
  reference_docs TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rag_test_cases_dataset_id ON rag_test_cases(dataset_id);

CREATE TABLE rag_evaluations (
  id SERIAL PRIMARY KEY,
  dataset_id INTEGER REFERENCES rag_datasets(id) ON DELETE CASCADE,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  config JSONB,

  -- Metrics
  avg_relevance_score DECIMAL(3,2),
  avg_faithfulness_score DECIMAL(3,2),
  avg_answer_correctness DECIMAL(3,2),
  avg_retrieval_precision DECIMAL(3,2),

  total_test_cases INTEGER,
  passed_cases INTEGER,
  failed_cases INTEGER,

  executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  executed_by INTEGER REFERENCES users(id)
);

CREATE INDEX idx_rag_evaluations_dataset_id ON rag_evaluations(dataset_id);
CREATE INDEX idx_rag_evaluations_kb_id ON rag_evaluations(kb_id);

CREATE TABLE rag_evaluation_results (
  id SERIAL PRIMARY KEY,
  evaluation_id INTEGER REFERENCES rag_evaluations(id) ON DELETE CASCADE,
  test_case_id INTEGER REFERENCES rag_test_cases(id),

  actual_answer TEXT,
  retrieved_docs JSONB,

  relevance_score DECIMAL(3,2),
  faithfulness_score DECIMAL(3,2),
  answer_correctness DECIMAL(3,2),
  retrieval_precision DECIMAL(3,2),

  passed BOOLEAN,
  error_message TEXT,
  execution_time_ms INTEGER,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_rag_evaluation_results_evaluation_id
  ON rag_evaluation_results(evaluation_id);

-- ============================================
-- WEB SCRAPING
-- ============================================

CREATE TABLE web_sources (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  title TEXT,
  content TEXT,
  cleaned_content TEXT,
  embedding vector(1536),
  scrape_frequency_hours INTEGER DEFAULT 168,  -- Weekly
  last_scraped_at TIMESTAMP,
  next_scrape_at TIMESTAMP,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_sources_kb_id ON web_sources(kb_id);
CREATE INDEX idx_web_sources_next_scrape ON web_sources(next_scrape_at);
CREATE INDEX idx_web_sources_embedding ON web_sources
  USING ivfflat (embedding vector_cosine_ops);

CREATE TABLE web_scrape_history (
  id SERIAL PRIMARY KEY,
  web_source_id INTEGER REFERENCES web_sources(id) ON DELETE CASCADE,
  status VARCHAR(50),
  error_message TEXT,
  scraped_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_web_scrape_history_web_source_id
  ON web_scrape_history(web_source_id);

-- ============================================
-- DOCUMENT PROCESSING
-- ============================================

CREATE TABLE document_processing_jobs (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT,
  file_size_bytes BIGINT,
  file_type VARCHAR(50),

  status document_job_status DEFAULT 'pending',
  progress_percentage INTEGER DEFAULT 0,

  chunks_total INTEGER DEFAULT 0,
  chunks_processed INTEGER DEFAULT 0,

  error_message TEXT,

  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_document_jobs_kb_id ON document_processing_jobs(kb_id);
CREATE INDEX idx_document_jobs_status ON document_processing_jobs(status);

-- ============================================
-- LLM USAGE TRACKING
-- ============================================

CREATE TABLE llm_usage (
  id SERIAL PRIMARY KEY,
  kb_id INTEGER REFERENCES knowledge_bases(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,

  provider llm_provider NOT NULL,
  model VARCHAR(100) NOT NULL,

  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,

  estimated_cost DECIMAL(10,6),

  request_metadata JSONB,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_llm_usage_kb_id ON llm_usage(kb_id);
CREATE INDEX idx_llm_usage_user_id ON llm_usage(user_id);
CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at);
CREATE INDEX idx_llm_usage_provider ON llm_usage(provider);

-- ============================================
-- FUNCTIONS & TRIGGERS
-- ============================================

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Optional)
-- ============================================

-- Create default super admin (CHANGE PASSWORD IN PRODUCTION!)
-- Password: admin123 (hashed with bcrypt)
-- INSERT INTO users (email, password_hash, name, role) VALUES
--   ('admin@example.com', '$2b$10$YourHashedPasswordHere', 'System Admin', 'super_admin');

-- ============================================
-- COMPLETION
-- ============================================

-- Log schema version
CREATE TABLE IF NOT EXISTS schema_version (
  version INTEGER PRIMARY KEY,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  description TEXT
);

INSERT INTO schema_version (version, description) VALUES
  (1, 'Initial schema with all transformations (migrations 001-013)');

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Database initialized successfully!';
  RAISE NOTICE 'Schema version: 1.0 (post-transformation)';
  RAISE NOTICE 'Total tables created: %',
    (SELECT COUNT(*) FROM information_schema.tables
     WHERE table_schema = 'public' AND table_type = 'BASE TABLE');
END $$;
```

### Migration Scripts

#### Run Incremental Migrations (Existing DB)

**File**: `database/scripts/run_migrations.sh`

```bash
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
```

#### Fresh Database Installation

**File**: `database/scripts/init_fresh_db.sh`

```bash
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
DB_EXISTS=$(psql -U postgres -h "$DB_HOST" -tAc "SELECT 1 FROM pg_database WHERE datname='$DB_NAME'")

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
```

#### Generate Aggregated Init Script

**File**: `database/scripts/aggregate_migrations.sh`

```bash
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

# Note: DON'T include 010-012 as they're transformations
# Instead, the init_db.sql should have the FINAL schema

echo ""
echo "✅ Generated: $OUTPUT_FILE"
echo "📊 Size: $(wc -c < "$OUTPUT_FILE") bytes"
echo ""
echo "⚠️  NOTE: Review and manually adjust init_db.sql to reflect"
echo "   the FINAL schema after transformations (010-013)."
```

### Usage Instructions

#### For Existing Deployments (Migration Path)

```bash
# 1. Backup database
pg_dump -U digitaltwin_user -d digitaltwin -F c -f backup_before_transform.dump

# 2. Run transformation migrations
cd /path/to/project
chmod +x database/scripts/run_migrations.sh
./database/scripts/run_migrations.sh

# 3. Verify
psql -U digitaltwin_user -d digitaltwin -c "\dt"
```

#### For Fresh Installations

```bash
# 1. Run fresh database initialization
chmod +x database/scripts/init_fresh_db.sh
./database/scripts/init_fresh_db.sh

# 2. Verify
psql -U digitaltwin_user -d digitaltwin -c "\dt"
```

#### To Update Aggregated Init Script

```bash
# After modifying migrations, regenerate init_db.sql
chmod +x database/scripts/aggregate_migrations.sh
./database/scripts/aggregate_migrations.sh

# Then manually review and adjust init_db.sql
```

### Docker Integration

**File**: `database/Dockerfile` (optional)

```dockerfile
FROM postgres:15

# Copy initialization script
COPY init_db.sql /docker-entrypoint-initdb.d/

# Copy migrations (for reference)
COPY migrations/ /migrations/
```

**Update `docker-compose.yml`**:

```yaml
services:
  db:
    build: ./database
    # ... rest of config
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./database/init_db.sql:/docker-entrypoint-initdb.d/init_db.sql
```

### Validation Queries

After running migrations or init_db.sql, verify with:

```sql
-- Check all tables exist
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- Should return: ~25 tables including:
-- - users, knowledge_bases, knowledge_base
-- - conversations, messages, end_users
-- - email_credentials, email_knowledge
-- - rag_datasets, rag_test_cases, rag_evaluations
-- - web_sources, document_processing_jobs
-- - llm_usage

-- Check enums
SELECT t.typname
FROM pg_type t
JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
WHERE n.nspname = 'public' AND t.typtype = 'e'
ORDER BY t.typname;

-- Should return: conversation_status, document_job_status,
--                email_provider, llm_provider, message_sender, user_role

-- Check foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
ORDER BY tc.table_name, kcu.column_name;
```

---

## 🔧 Backend Transformations

### 1. Add Gemini LLM Provider

**Files to modify**:
- `backend/src/services/llmService.ts`
- `backend/src/types/llm.types.ts`
- `backend/package.json` (add `@google/generative-ai`)

**Steps**:
1. Add Gemini SDK dependency: `npm install @google/generative-ai`
2. Update `LLMProvider` type: `'openai' | 'anthropic' | 'gemini'`
3. Add Gemini client initialization in `llmService.ts`
4. Implement Gemini-specific methods:
   - `generateResponseGemini()`
   - `generateStreamingResponseGemini()`
5. Update environment variables: `GEMINI_API_KEY`

**Code snippet** (`backend/src/services/llmService.ts`):
```typescript
import { GoogleGenerativeAI } from '@google/generative-ai';

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

async function generateResponseGemini(
  messages: any[],
  config: LLMConfig
): Promise<string> {
  const model = genAI.getGenerativeModel({ model: config.model });

  // Convert messages format for Gemini
  const prompt = formatMessagesForGemini(messages);

  const result = await model.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: config.temperature,
      maxOutputTokens: config.maxTokens,
    },
  });

  return result.response.text();
}
```

### 2. Add OAuth Social Authentication

**Files to create**:
- `backend/src/services/oauthService.ts`
- `backend/src/routes/oauthRoutes.ts`
- `backend/src/config/oauth.config.ts`

**Dependencies**:
```bash
npm install passport passport-google-oauth20 passport-github2
npm install --save-dev @types/passport @types/passport-google-oauth20 @types/passport-github2
```

**OAuth flow**:
1. User clicks "Login with Google/GitHub"
2. Redirect to OAuth provider
3. Callback receives auth code
4. Exchange code for user info
5. Check if user exists (by `oauth_provider` + `oauth_id`)
6. Create user if new, or login existing
7. Generate JWT token
8. Redirect to dashboard with token

**Routes** (`backend/src/routes/oauthRoutes.ts`):
```typescript
router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/auth/google/callback', passport.authenticate('google', { session: false }), oauthCallback);

router.get('/auth/github', passport.authenticate('github', { scope: ['user:email'] }));
router.get('/auth/github/callback', passport.authenticate('github', { session: false }), oauthCallback);
```

**Environment variables**:
```env
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/google/callback

GITHUB_OAUTH_CLIENT_ID=...
GITHUB_OAUTH_CLIENT_SECRET=...
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/github/callback
```

### 3. Refactor Routes: digitalTwinRoutes → knowledgeBaseRoutes

**File**: `backend/src/routes/knowledgeBaseRoutes.ts` (rename from `digitalTwinRoutes.ts`)

**Changes**:
- Route base: `/api/digital-twins` → `/api/knowledge-bases`
- Path params: `:twinId` → `:kbId`
- Controller methods: use new `knowledgeBaseService`

**Route mapping**:
```typescript
// OLD → NEW
POST   /api/digital-twins                    → POST   /api/knowledge-bases
GET    /api/digital-twins/me                 → GET    /api/knowledge-bases/me
PUT    /api/digital-twins/:twinId            → PUT    /api/knowledge-bases/:kbId
GET    /api/digital-twins/:twinId/rag-config → GET    /api/knowledge-bases/:kbId/rag-config
POST   /api/digital-twins/:twinId/knowledge  → POST   /api/knowledge-bases/:kbId/knowledge
// etc.
```

### 4. Refactor Services: digitalTwinService → knowledgeBaseService

**File**: `backend/src/services/knowledgeBaseService.ts` (rename from `digitalTwinService.ts`)

**Changes**:
- All function names: `createDigitalTwin()` → `createKnowledgeBase()`
- Database queries: `digital_twins` → `knowledge_bases`
- Remove personality/capabilities logic
- Keep all RAG configuration logic

### 5. Remove Handover System

**Files to delete**:
- `backend/src/services/handoverService.ts` (if exists)
- `backend/src/controllers/handoverController.ts` (if exists)

**Files to modify**:
- `backend/src/services/websocketService.ts` - Remove handover event handlers
- `backend/src/services/chatService.ts` - Remove handover detection and creation
- `backend/src/routes/chatRoutes.ts` - Remove handover endpoints

**WebSocket**: Remove these message types:
- `professional_takeover`
- `handover_notification`

### 6. Update Chat Service

**File**: `backend/src/services/chatService.ts`

**Remove**:
- Handover confidence checking
- `createHandoverNotification()`
- Professional message sending logic

**Keep**:
- RAG retrieval
- LLM response generation
- Conversation management
- Message storage

---

## 🎨 Frontend Transformations

### 1. Add OAuth Login Buttons

**File**: `frontend/src/pages/Login.tsx`

**Add social login section**:
```tsx
import { FcGoogle } from 'react-icons/fc';
import { FaGithub } from 'react-icons/fa';

const Login = () => {
  const handleOAuthLogin = (provider: 'google' | 'github') => {
    window.location.href = `${API_BASE_URL}/oauth/auth/${provider}`;
  };

  return (
    <div>
      {/* Existing email/password form */}

      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-300" />
        </div>
        <div className="relative flex justify-center text-sm">
          <span className="bg-white px-2 text-gray-500">Or continue with</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => handleOAuthLogin('google')}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <FcGoogle className="w-5 h-5" />
          Google
        </button>

        <button
          onClick={() => handleOAuthLogin('github')}
          className="flex items-center justify-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          <FaGithub className="w-5 h-5" />
          GitHub
        </button>
      </div>
    </div>
  );
};
```

**Create OAuth callback handler**:

**File**: `frontend/src/pages/OAuthCallback.tsx`
```tsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    // Extract token from URL params
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const error = params.get('error');

    if (error) {
      console.error('OAuth error:', error);
      navigate('/login?error=oauth_failed');
      return;
    }

    if (token) {
      // Decode user info from token
      const payload = JSON.parse(atob(token.split('.')[1]));
      login(token, payload.user);
      navigate('/dashboard');
    } else {
      navigate('/login?error=no_token');
    }
  }, [login, navigate]);

  return <div className="flex items-center justify-center min-h-screen">Authenticating...</div>;
};

export default OAuthCallback;
```

**Update routing** in `frontend/src/App.tsx`:
```tsx
<Route path="/oauth/callback" element={<OAuthCallback />} />
```

### 2. Refactor Dashboard: ProfessionalDashboard → KBManagementDashboard

**File**: `frontend/src/pages/KBManagementDashboard.tsx` (rename from `ProfessionalDashboard.tsx`)

**Changes**:
- Component name: `ProfessionalDashboard` → `KBManagementDashboard`
- Remove "Handovers" tab
- Rename tab: "Overview" → "My Knowledge Bases"
- Update all API calls: `digitalTwinAPI` → `knowledgeBaseAPI`
- Rename state variables: `digitalTwin` → `knowledgeBase`, `twinId` → `kbId`

**Tab structure**:
```tsx
const tabs = [
  { id: 'overview', name: 'My Knowledge Bases', icon: DatabaseIcon },
  { id: 'conversations', name: 'Conversations', icon: ChatBubbleLeftRightIcon },
  { id: 'semantic-search', name: 'Semantic Search', icon: MagnifyingGlassIcon },
  { id: 'knowledge-base', name: 'Knowledge Base', icon: BookOpenIcon },
  { id: 'email', name: 'Email Integration', icon: EnvelopeIcon },
  { id: 'benchmark', name: 'Benchmark & Testing', icon: ChartBarIcon },
  { id: 'web-scraping', name: 'Web Sources', icon: GlobeAltIcon },
  { id: 'settings', name: 'Settings', icon: Cog6ToothIcon },
];
```

### 3. Replace OnboardingWizard with Simple KB Creation

**Remove file**: `frontend/src/pages/OnboardingWizard.tsx`

**Create new file**: `frontend/src/components/CreateKBModal.tsx`

Simple modal with:
1. KB Name (required)
2. Description (optional)
3. LLM Provider (dropdown: OpenAI/Anthropic/Gemini)
4. LLM Model (dropdown based on provider)
5. Create button

```tsx
const CreateKBModal = ({ isOpen, onClose, onCreate }) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    llm_provider: 'openai',
    llm_model: 'gpt-4',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const response = await knowledgeBaseAPI.create(formData);
      onCreate(response.data);
      onClose();
    } catch (error) {
      console.error('Failed to create KB:', error);
    }
  };

  // Form UI...
};
```

### 4. Remove Handover UI Components

**Files to delete or modify**:
- Remove "Handovers" tab from `KBManagementDashboard`
- Remove `HandoverNotification` component (if exists)
- Remove WebSocket handover listeners from chat components

### 5. Update API Service Layer

**File**: `frontend/src/services/api.ts`

**Rename API group**:
```typescript
// OLD
export const digitalTwinAPI = {
  create: (data) => api.post('/api/digital-twins', data),
  getMe: () => api.get('/api/digital-twins/me'),
  update: (twinId, data) => api.put(`/api/digital-twins/${twinId}`, data),
  // ...
};

// NEW
export const knowledgeBaseAPI = {
  create: (data) => api.post('/api/knowledge-bases', data),
  getMe: () => api.get('/api/knowledge-bases/me'),
  update: (kbId, data) => api.put(`/api/knowledge-bases/${kbId}`, data),
  getById: (kbId) => api.get(`/api/knowledge-bases/${kbId}`),
  list: () => api.get('/api/knowledge-bases'),
  delete: (kbId) => api.delete(`/api/knowledge-bases/${kbId}`),

  // Knowledge management
  addKnowledge: (kbId, data) => api.post(`/api/knowledge-bases/${kbId}/knowledge`, data),
  getKnowledge: (kbId) => api.get(`/api/knowledge-bases/${kbId}/knowledge`),
  deleteKnowledge: (kbId, entryId) => api.delete(`/api/knowledge-bases/${kbId}/knowledge/${entryId}`),
  uploadFile: (kbId, formData) => api.post(`/api/knowledge-bases/${kbId}/knowledge/upload`, formData),

  // RAG config
  getRAGConfig: (kbId) => api.get(`/api/knowledge-bases/${kbId}/rag-config`),
  updateRAGConfig: (kbId, config) => api.put(`/api/knowledge-bases/${kbId}/rag-config`, config),

  // Search
  search: (kbId, query) => api.post(`/api/knowledge-bases/${kbId}/knowledge/search`, { query }),
};

// Keep chatAPI, emailAPI, benchmarkAPI, etc. (update references from twinId to kbId)
```

### 6. Update Component Props and State

**Global find and replace across frontend**:
- `digitalTwin` → `knowledgeBase`
- `twinId` → `kbId`
- `twin_id` → `kb_id`
- `DigitalTwin` → `KnowledgeBase` (type names)
- `DIGITAL_TWIN` → `KNOWLEDGE_BASE` (constants)

---

## 📝 Configuration & Environment Updates

### Backend .env

**Add**:
```env
# Gemini LLM
GEMINI_API_KEY=your-gemini-api-key

# OAuth
GOOGLE_OAUTH_CLIENT_ID=your-google-client-id
GOOGLE_OAUTH_CLIENT_SECRET=your-google-client-secret
GOOGLE_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/google/callback

GITHUB_OAUTH_CLIENT_ID=your-github-client-id
GITHUB_OAUTH_CLIENT_SECRET=your-github-client-secret
GITHUB_OAUTH_REDIRECT_URI=http://localhost:3001/api/oauth/auth/github/callback
```

### Update CLAUDE.md

**File**: `CLAUDE.md`

Update all references:
- "Digital Twin SAAS Platform" → "Simple RAG Multitenant Platform"
- "professionals create digital twins" → "users create knowledge bases"
- Remove mentions of handover, personality, capabilities
- Update routes documentation
- Update database schema documentation

---

## 🧪 Testing Strategy

### Backend Tests to Update

1. **Auth Tests**:
   - Add OAuth flow tests
   - Test Google/GitHub authentication

2. **Knowledge Base Tests**:
   - Rename from `digitalTwin.test.ts` to `knowledgeBase.test.ts`
   - Test CRUD operations
   - Test RAG configuration

3. **Chat Tests**:
   - Remove handover tests
   - Test RAG retrieval with Gemini
   - Test conversation management

4. **Email Integration Tests**:
   - Update references from twinId to kbId

5. **Benchmark Tests**:
   - Update references from twinId to kbId

### Frontend Tests to Update

1. **Dashboard Tests**:
   - Test new `KBManagementDashboard` component
   - Test tab navigation (without Handovers tab)

2. **Auth Tests**:
   - Test OAuth login buttons
   - Test OAuth callback handler

3. **KB Creation Tests**:
   - Test new `CreateKBModal`
   - Remove `OnboardingWizard` tests

---

## 🚀 Deployment Checklist

### Pre-deployment

- [ ] Run all migrations in correct order
- [ ] Update all environment variables
- [ ] Run full test suite (backend + frontend)
- [ ] Test OAuth flow in development
- [ ] Verify Gemini LLM integration
- [ ] Test end-to-end: create KB → add knowledge → chat

### Database Migration

```bash
# Run migrations
psql -U digitaltwin_user -d digitaltwin -f database/migrations/010_transform_to_knowledge_base.sql
psql -U digitaltwin_user -d digitaltwin -f database/migrations/011_remove_handover.sql
psql -U digitaltwin_user -d digitaltwin -f database/migrations/012_oauth_support.sql
```

### Backend Deployment

```bash
cd backend
npm install  # Install new dependencies (Gemini SDK, Passport)
npm run type-check
npm run lint
npm test
npm run build
```

### Frontend Deployment

```bash
cd frontend
npm install  # Install new dependencies (react-icons)
npm run type-check
npm run lint
npm test
npm run build
```

### Docker

Update `docker-compose.yml` with new environment variables, then:

```bash
docker-compose down
docker-compose build
docker-compose up -d
```

---

## 📦 Dependencies to Add

### Backend

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.1.3",
    "passport": "^0.7.0",
    "passport-google-oauth20": "^2.0.0",
    "passport-github2": "^0.1.12"
  },
  "devDependencies": {
    "@types/passport": "^1.0.16",
    "@types/passport-google-oauth20": "^2.0.14",
    "@types/passport-github2": "^1.2.9"
  }
}
```

### Frontend

```json
{
  "dependencies": {
    "react-icons": "^5.0.1"
  }
}
```

---

## ⚠️ Breaking Changes

### API Endpoints

All `/api/digital-twins/*` endpoints renamed to `/api/knowledge-bases/*`

**Migration for existing API clients**:
- Update all frontend API calls
- Update any external integrations
- Update documentation

### Database Schema

- `digital_twins` → `knowledge_bases`
- `twin_id` → `kb_id` (foreign keys)
- User role `professional` → `kb_owner`
- Conversation status: removed `handed_over`
- Message sender: removed `professional`

### Authentication

- OAuth users won't have `password_hash`
- New fields: `oauth_provider`, `oauth_id`, `avatar_url`

---

## 🔍 Risk Assessment

### High Risk
- **Database migration**: Renaming tables and columns affects all queries
  - **Mitigation**: Test migrations on staging database first
  - **Rollback**: Keep backup before migration

### Medium Risk
- **OAuth integration**: New authentication flow
  - **Mitigation**: Keep existing email/password auth working
  - **Rollback**: OAuth is additive, can disable if issues

### Low Risk
- **Gemini LLM**: Additional provider
  - **Mitigation**: Falls back to OpenAI/Anthropic if Gemini fails
  - **Rollback**: Easy to remove if not working

---

## 📅 Estimated Timeline

| Phase | Tasks | Duration |
|-------|-------|----------|
| **Phase 1: Database** | Create and test migrations | 2-3 days |
| **Phase 2: Backend Core** | Refactor services and routes | 3-4 days |
| **Phase 3: Backend Features** | Add Gemini + OAuth | 2-3 days |
| **Phase 4: Frontend Core** | Refactor dashboard and components | 3-4 days |
| **Phase 5: Frontend Features** | OAuth UI + KB creation | 2 days |
| **Phase 6: Testing** | Full system testing | 2-3 days |
| **Phase 7: Documentation** | Update docs and deploy | 1-2 days |

**Total**: ~15-21 days (3-4 weeks) development + 5-7 days pre-deployment validation

---

## 💾 Data Migration & Backup Strategy

### Pre-Migration Backup

**Full Database Backup**:
```bash
# Create timestamped backup
pg_dump -U digitaltwin_user -d digitaltwin -F c -f backup_$(date +%Y%m%d_%H%M%S).dump

# Verify backup
pg_restore --list backup_YYYYMMDD_HHMMSS.dump | head -20

# Calculate checksum
sha256sum backup_YYYYMMDD_HHMMSS.dump > backup_YYYYMMDD_HHMMSS.dump.sha256
```

**Backup Locations**:
- Primary: Production server local disk
- Secondary: AWS S3 / Cloud Storage
- Tertiary: Team member local copy (encrypted)

**Retention**: Keep backup for minimum 30 days post-deployment

### Migration Scripts

**Create Rollback Scripts** (run BEFORE deployment):

**File**: `database/migrations/rollback/010_rollback_knowledge_base.sql`
```sql
-- Rollback migration 010: knowledge_bases → digital_twins
ALTER TABLE knowledge_bases RENAME TO digital_twins;
ALTER TABLE digital_twins RENAME COLUMN kb_id TO twin_id;

-- Restore dropped columns (set to NULL or default values)
ALTER TABLE digital_twins
  ADD COLUMN personality_traits JSONB,
  ADD COLUMN communication_style VARCHAR(100),
  ADD COLUMN capabilities TEXT[],
  ADD COLUMN services JSONB,
  ADD COLUMN pricing_info JSONB,
  ADD COLUMN availability_schedule JSONB,
  ADD COLUMN profession VARCHAR(255),
  ADD COLUMN bio TEXT;

-- Remove new columns
ALTER TABLE digital_twins
  DROP COLUMN IF EXISTS description,
  DROP COLUMN IF EXISTS is_public,
  DROP COLUMN IF EXISTS share_url;

-- Restore indexes
DROP INDEX IF EXISTS idx_knowledge_bases_user_id;
DROP INDEX IF EXISTS idx_knowledge_bases_share_url;
CREATE INDEX idx_digital_twins_user_id ON digital_twins(user_id);

-- Restore foreign keys
ALTER TABLE knowledge_base RENAME COLUMN kb_id TO twin_id;
ALTER TABLE conversations RENAME COLUMN kb_id TO twin_id;
ALTER TABLE rag_datasets RENAME COLUMN kb_id TO twin_id;
```

**File**: `database/migrations/rollback/011_rollback_handover.sql`
```sql
-- Rollback migration 011: Restore handover system

-- Recreate handover_notifications table
CREATE TABLE handover_notifications (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES conversations(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id),
  reason TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add back handover column to conversations
ALTER TABLE conversations ADD COLUMN handed_over_at TIMESTAMP;

-- Recreate conversation status enum with 'handed_over'
CREATE TYPE conversation_status_new AS ENUM ('active', 'handed_over', 'closed');
ALTER TABLE conversations
  ALTER COLUMN status TYPE conversation_status_new
  USING status::text::conversation_status_new;
DROP TYPE conversation_status;
ALTER TYPE conversation_status_new RENAME TO conversation_status;

-- Recreate message sender enum with 'professional'
CREATE TYPE message_sender_new AS ENUM ('user', 'assistant', 'professional');
ALTER TABLE messages
  ALTER COLUMN sender TYPE message_sender_new
  USING sender::text::message_sender_new;
DROP TYPE message_sender;
ALTER TYPE message_sender_new RENAME TO message_sender;
```

**File**: `database/migrations/rollback/012_rollback_oauth.sql`
```sql
-- Rollback migration 012: Remove OAuth support

-- Drop OAuth columns
ALTER TABLE users
  DROP COLUMN IF EXISTS oauth_provider,
  DROP COLUMN IF EXISTS oauth_id,
  DROP COLUMN IF EXISTS avatar_url;

-- Make password_hash NOT NULL again (WARNING: may fail if OAuth users exist)
-- Need to set password_hash for OAuth users first
UPDATE users SET password_hash = 'OAUTH_USER_NO_PASSWORD' WHERE password_hash IS NULL;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;

-- Drop OAuth index
DROP INDEX IF EXISTS idx_users_oauth;

-- Restore role enum (kb_owner → professional)
CREATE TYPE user_role_new AS ENUM ('super_admin', 'professional', 'end_user');
ALTER TABLE users
  ALTER COLUMN role TYPE user_role_new
  USING CASE
    WHEN role = 'kb_owner' THEN 'professional'::user_role_new
    ELSE role::text::user_role_new
  END;
DROP TYPE user_role;
ALTER TYPE user_role_new RENAME TO user_role;
```

### Data Validation Queries

**Run after each migration** to verify data integrity:

```sql
-- Verify table rename
SELECT COUNT(*) FROM knowledge_bases;
SELECT COUNT(*) FROM conversations WHERE kb_id IS NOT NULL;

-- Verify no orphaned records
SELECT COUNT(*) FROM conversations c
WHERE NOT EXISTS (SELECT 1 FROM knowledge_bases kb WHERE kb.id = c.kb_id);

-- Verify enum migrations
SELECT DISTINCT status FROM conversations;
SELECT DISTINCT sender FROM messages;
SELECT DISTINCT role FROM users;

-- Verify OAuth users
SELECT COUNT(*) FROM users WHERE oauth_provider IS NOT NULL;
SELECT COUNT(*) FROM users WHERE password_hash IS NULL;

-- Verify foreign keys
SELECT
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND (kcu.column_name = 'kb_id' OR kcu.column_name = 'twin_id');
```

### Testing Migration on Staging

**Steps**:
1. Clone production database to staging
   ```bash
   pg_dump -U prod_user -h prod_host -d digitaltwin -F c -f prod_backup.dump
   pg_restore -U staging_user -h staging_host -d digitaltwin_staging prod_backup.dump
   ```

2. Run migrations on staging
3. Run validation queries
4. Test application with staging database
5. Run rollback scripts
6. Verify rollback success
7. Document any issues

---

## 🔒 Security Review Checklist

Complete before deployment to production.

### OAuth Security
- [ ] OAuth client secrets stored securely (env vars, not in code)
- [ ] OAuth redirect URIs whitelisted correctly
- [ ] State parameter used to prevent CSRF
- [ ] Nonce used for replay attack prevention (if applicable)
- [ ] OAuth tokens not logged or exposed
- [ ] OAuth scopes are minimal (only request what's needed)
- [ ] Error messages don't leak sensitive info

### Authentication & Authorization
- [ ] JWT secret is cryptographically strong (min 256 bits)
- [ ] JWT tokens have reasonable expiration (e.g., 24 hours)
- [ ] Refresh token mechanism secure (if implemented)
- [ ] Password hashing uses bcrypt with appropriate cost factor
- [ ] OAuth users cannot bypass email verification requirements
- [ ] Role-based access control working correctly (kb_owner vs end_user)
- [ ] Super admin routes properly protected

### API Security
- [ ] Rate limiting configured on all endpoints
- [ ] Input validation on all user inputs
- [ ] SQL injection protection (parameterized queries)
- [ ] XSS protection (input sanitization)
- [ ] CSRF tokens on state-changing operations
- [ ] CORS configured correctly (not allowing *)
- [ ] API keys/tokens not exposed in frontend code
- [ ] Sensitive data not in query params or URLs

### Database Security
- [ ] Database user has minimal required permissions
- [ ] Database backups encrypted
- [ ] SSL/TLS for database connections
- [ ] No default passwords in use
- [ ] Sensitive fields encrypted at rest (email_credentials table)
- [ ] Database audit logging enabled

### LLM API Security
- [ ] Gemini API key stored securely
- [ ] OpenAI API key stored securely
- [ ] Anthropic API key stored securely
- [ ] API keys rotated if compromised
- [ ] API rate limits monitored
- [ ] User input to LLMs sanitized (no prompt injection)
- [ ] LLM responses sanitized before display

### Infrastructure Security
- [ ] HTTPS enforced (no HTTP)
- [ ] Security headers configured (CSP, X-Frame-Options, etc.)
- [ ] Secrets not in git history
- [ ] Environment files in .gitignore
- [ ] Docker images from trusted sources
- [ ] No unnecessary ports exposed
- [ ] Firewall rules configured

### Data Privacy & Compliance
- [ ] Privacy policy updated (mentions OAuth data collection)
- [ ] Terms of service updated
- [ ] User consent for OAuth data collection
- [ ] Users can delete their data (GDPR right to erasure)
- [ ] Data retention policies documented
- [ ] Audit logs for sensitive operations

### Code Security
- [ ] Dependencies scanned for vulnerabilities (npm audit)
- [ ] No hardcoded secrets in codebase
- [ ] Error handling doesn't expose stack traces in production
- [ ] Logging doesn't include sensitive data (passwords, tokens)
- [ ] File upload restrictions in place (type, size)
- [ ] WebSocket connections authenticated

---

## ⚡ Performance Testing Plan

### Baseline Metrics (Before Deployment)

Collect current performance metrics:

**Backend**:
- [ ] API response times (p50, p95, p99)
  - GET /api/digital-twins/me: ___ ms
  - POST /api/chat/conversations/:id/messages: ___ ms
  - POST /api/knowledge-bases/:id/knowledge/search: ___ ms
- [ ] Database query times
  - Average query time: ___ ms
  - Slowest queries identified
- [ ] Memory usage: ___ MB
- [ ] CPU usage: ___%
- [ ] Concurrent connections: ___

**Frontend**:
- [ ] Page load time: ___ ms
- [ ] Time to interactive: ___ ms
- [ ] Bundle size: ___ KB

### Post-Migration Performance Testing

**Load Testing** (use Apache Bench, k6, or Artillery):

```bash
# Test knowledge base creation
k6 run --vus 50 --duration 30s tests/load/create-kb.js

# Test chat endpoint
k6 run --vus 100 --duration 60s tests/load/chat.js

# Test semantic search
k6 run --vus 50 --duration 30s tests/load/semantic-search.js

# Test OAuth login flow
k6 run --vus 20 --duration 30s tests/load/oauth-login.js
```

**Performance Targets**:
- [ ] API p95 response time < 500ms (non-LLM endpoints)
- [ ] LLM chat response time < 5s (p95)
- [ ] Semantic search < 1s (p95)
- [ ] Database queries < 100ms (p95)
- [ ] Frontend page load < 2s
- [ ] Support 100 concurrent users
- [ ] No memory leaks during 1-hour load test

**Gemini Performance Testing**:
- [ ] Compare Gemini response times vs OpenAI/Anthropic
- [ ] Test Gemini rate limits
- [ ] Verify Gemini streaming works correctly
- [ ] Test failover to other providers if Gemini slow/down

**Database Performance**:
- [ ] Vector search performance after migration
  ```sql
  EXPLAIN ANALYZE
  SELECT * FROM knowledge_base
  ORDER BY embedding <=> '[...]'::vector
  LIMIT 5;
  ```
- [ ] Index usage verification
  ```sql
  SELECT schemaname, tablename, indexname, idx_scan
  FROM pg_stat_user_indexes
  WHERE tablename IN ('knowledge_bases', 'conversations', 'messages')
  ORDER BY idx_scan;
  ```
- [ ] Query plan optimization for renamed tables

**Stress Testing**:
- [ ] Test with 2x expected load
- [ ] Test with 10x knowledge base entries
- [ ] Test with 10x conversations
- [ ] Identify breaking point

### Performance Monitoring Dashboard

Set up monitoring before deployment:
- [ ] Grafana dashboard with key metrics
- [ ] Alert on p95 > 1s for API endpoints
- [ ] Alert on database query time > 200ms
- [ ] Alert on error rate > 1%
- [ ] Alert on memory usage > 80%

---

## 📊 Monitoring & Observability

### Logging Strategy

**Backend Logging** (Winston or Pino):

```typescript
// Log levels: error, warn, info, debug
logger.info('Knowledge base created', {
  kbId: kb.id,
  userId: user.id,
  llmProvider: kb.llm_provider,
  timestamp: new Date().toISOString()
});

logger.error('OAuth authentication failed', {
  provider: 'google',
  error: error.message,
  userId: userId,
  timestamp: new Date().toISOString()
});
```

**Log Categories**:
- [ ] Authentication events (login, OAuth, logout)
- [ ] KB creation/deletion
- [ ] Chat messages sent
- [ ] LLM API calls (provider, model, tokens used)
- [ ] Database query errors
- [ ] WebSocket connections/disconnections
- [ ] Email sync operations
- [ ] Benchmark executions

**Log Storage**:
- Development: Console output
- Staging: File-based logs + CloudWatch/Datadog
- Production: Centralized logging (CloudWatch, Datadog, or ELK stack)

### Metrics to Track

**Application Metrics**:
- [ ] Requests per minute (by endpoint)
- [ ] Response times (p50, p95, p99)
- [ ] Error rate (by endpoint and error type)
- [ ] Active users (concurrent sessions)
- [ ] KB creations per day
- [ ] Chat messages per day
- [ ] OAuth logins per day (by provider)

**LLM Metrics**:
- [ ] OpenAI API calls (count, tokens, cost)
- [ ] Anthropic API calls (count, tokens, cost)
- [ ] Gemini API calls (count, tokens, cost)
- [ ] LLM response times (by provider)
- [ ] LLM error rates (by provider)

**Database Metrics**:
- [ ] Active connections
- [ ] Query execution time
- [ ] Cache hit rate
- [ ] Table sizes
- [ ] Index usage
- [ ] Deadlocks

**Infrastructure Metrics**:
- [ ] CPU usage (%)
- [ ] Memory usage (%)
- [ ] Disk I/O
- [ ] Network I/O
- [ ] Container restarts

### Alerting Rules

**Critical Alerts** (page on-call):
- [ ] Service down (health check fails)
- [ ] Error rate > 5% for 5 minutes
- [ ] Database connection pool exhausted
- [ ] Disk usage > 90%
- [ ] Memory usage > 90%

**Warning Alerts** (Slack notification):
- [ ] p95 response time > 1s for 10 minutes
- [ ] Error rate > 1% for 10 minutes
- [ ] LLM API call failures > 5% for 5 minutes
- [ ] OAuth login failures > 10% for 5 minutes
- [ ] Database query time > 500ms (p95)

**Info Alerts** (daily summary):
- [ ] Daily active users
- [ ] Daily KB creations
- [ ] Daily LLM API costs
- [ ] Top error messages

### Health Checks

**Backend Health Endpoint**:

```typescript
// GET /health
app.get('/health', async (req, res) => {
  const checks = {
    database: await checkDatabase(),
    openai: await checkOpenAI(),
    anthropic: await checkAnthropic(),
    gemini: await checkGemini(),
    redis: await checkRedis(), // if using Redis
  };

  const healthy = Object.values(checks).every(check => check.status === 'ok');

  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    checks
  });
});
```

**Frontend Health**:
- [ ] Monitor page load errors
- [ ] Track JavaScript errors (Sentry)
- [ ] Monitor API call failures from frontend

---

## 🔧 Third-Party Services Setup

### OAuth Provider Configuration

**Google OAuth**:

1. **Create OAuth 2.0 Credentials**:
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create new project or select existing
   - Enable Google+ API
   - Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized JavaScript origins: `http://localhost:3000` (dev), `https://yourdomain.com` (prod)
   - Authorized redirect URIs: `http://localhost:3001/api/oauth/auth/google/callback` (dev), `https://yourdomain.com/api/oauth/auth/google/callback` (prod)
   - Copy Client ID and Client Secret

2. **Verification Status**:
   - [ ] OAuth consent screen configured
   - [ ] App published (or in testing mode with test users)
   - [ ] Scopes: `profile`, `email`

**GitHub OAuth**:

1. **Create OAuth App**:
   - Go to [GitHub Developer Settings](https://github.com/settings/developers)
   - New OAuth App
   - Application name: Your App Name
   - Homepage URL: `https://yourdomain.com`
   - Authorization callback URL: `http://localhost:3001/api/oauth/auth/github/callback` (dev), `https://yourdomain.com/api/oauth/auth/github/callback` (prod)
   - Copy Client ID and Client Secret

2. **Verification**:
   - [ ] OAuth app created
   - [ ] Callback URL matches backend route
   - [ ] Scopes: `user:email`

### Gemini API Setup

1. **Get API Key**:
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create API key
   - Set usage limits (optional)

2. **Verification**:
   - [ ] API key obtained
   - [ ] Test API key with simple request
   - [ ] Understand rate limits and quotas
   - [ ] Set up billing alerts (if applicable)

### Email Integration (Already configured)

Verify existing setup:
- [ ] Gmail OAuth credentials valid
- [ ] Outlook OAuth credentials valid
- [ ] IMAP credentials encryption working

### Monitoring & Error Tracking

**Sentry** (optional but recommended):
- [ ] Create Sentry project
- [ ] Install Sentry SDK (backend + frontend)
- [ ] Configure error reporting
- [ ] Set up release tracking

**Analytics** (optional):
- [ ] Google Analytics or similar
- [ ] Track key user actions
- [ ] Conversion funnels

---

## ✅ Go/No-Go Criteria

Review these criteria 24 hours before deployment. All must be YES to proceed.

### Development Completion
- [ ] All code changes merged to main branch
- [ ] All tests passing (backend + frontend)
- [ ] Type checking passes with zero errors
- [ ] Linting passes with zero errors
- [ ] Build succeeds for both backend and frontend
- [ ] Code review completed by at least one other developer

### Testing Validation
- [ ] All unit tests passing (>90% coverage)
- [ ] All integration tests passing
- [ ] End-to-end tests passing on staging
- [ ] Performance tests meet targets
- [ ] Load tests show no degradation
- [ ] Security audit completed with no critical issues

### Infrastructure Readiness
- [ ] Staging environment matches production
- [ ] Database migrations tested on staging
- [ ] Rollback scripts tested on staging
- [ ] Backup procedures tested
- [ ] Monitoring and alerting configured
- [ ] Health checks working

### Third-Party Services
- [ ] Google OAuth app approved and working
- [ ] GitHub OAuth app approved and working
- [ ] Gemini API key tested and working
- [ ] All API rate limits understood
- [ ] Billing alerts configured

### Documentation
- [ ] CLAUDE.md updated
- [ ] README updated
- [ ] API documentation updated
- [ ] Deployment runbook created
- [ ] Rollback procedures documented
- [ ] User communication prepared

### Team Readiness
- [ ] All team members briefed on deployment plan
- [ ] On-call rotation scheduled for deployment day
- [ ] Communication channels established (Slack, phone)
- [ ] Support team trained on new features
- [ ] FAQ prepared for user questions

### Risk Mitigation
- [ ] All high-risk items have mitigation plans
- [ ] Rollback triggers clearly defined
- [ ] Rollback can be executed within 60 minutes
- [ ] No other major deployments scheduled same day
- [ ] Maintenance window communicated to users

### Final Checklist
- [ ] Go/No-Go meeting held with all stakeholders
- [ ] Unanimous GO decision from team
- [ ] Deployment date and time confirmed
- [ ] All team members available during maintenance window
- [ ] Emergency contacts list updated

**Decision**: GO / NO-GO

**If NO-GO**: Document blockers and reschedule deployment.

---

## 📢 Communication Plan

### Pre-Deployment Communications

**D-7 (One Week Before)**:

**Email to All Users**:
```
Subject: Upcoming Platform Update - New Features & Improvements

Hi [User Name],

We're excited to announce a major platform update scheduled for [DATE] at [TIME UTC].

What's New:
✨ Simplified knowledge base creation
🚀 New Gemini AI model support
🔐 Quick login with Google and GitHub
⚡ Performance improvements

Downtime: Approximately 2-4 hours during the maintenance window.

During this time, the platform will be unavailable. We apologize for any inconvenience.

Questions? Reply to this email or check our FAQ: [link]

Thanks for your patience!
The Team
```

**In-App Banner** (D-7 to D-Day):
```
🚧 Scheduled Maintenance: [DATE] at [TIME UTC] (2-4 hours)
New features coming! [Learn More]
```

**D-3 (Three Days Before)**:

**Reminder Email**:
```
Subject: Reminder: Platform Maintenance in 3 Days

Quick reminder: Our platform update is scheduled for [DATE] at [TIME UTC].

Please save your work and plan accordingly.

New Feature Highlights:
- OAuth login (Google/GitHub)
- Gemini AI model
- Improved knowledge base management

See you on the other side!
```

**D-1 (One Day Before)**:

**Final Reminder** (email + in-app):
```
Subject: Platform Maintenance Tomorrow

Final reminder: Maintenance window starts tomorrow at [TIME UTC].

Duration: 2-4 hours
Expected completion: [TIME UTC]

We'll send an update when the platform is back online.
```

### Deployment Day Communications

**T-30min**:
- Update status page: "Scheduled Maintenance Starting Soon"
- Social media post (if applicable)

**T+0 (Maintenance Begins)**:
- **Status page**: "Under Maintenance - Deploying Updates"
- **Maintenance page displayed** with:
  - Estimated completion time
  - Link to status page
  - Contact for emergencies

**T+2:30 (Go-Live)**:
- **Status page**: "Maintenance Complete - Services Restored"
- **Email to all users**:
  ```
  Subject: We're Back! New Features Now Live

  Great news! The maintenance is complete and the platform is back online.

  What's New:
  ✅ Quick login with Google or GitHub
  ✅ New Gemini AI model for your knowledge bases
  ✅ Simplified knowledge base creation
  ✅ Performance improvements

  Try the new features: [Dashboard Link]

  Questions? Contact support: support@yourdomain.com
  ```

**If Rollback Required**:
- **Email immediately**:
  ```
  Subject: Maintenance Update - Temporary Rollback

  We encountered unexpected issues during deployment and have rolled back to ensure stability.

  Your data is safe. We're investigating the issue and will reschedule the update.

  Expected timeline: [New Date TBD]

  We apologize for the inconvenience.
  ```

### Post-Deployment Communications

**D+1 (Day After)**:
- **Status update email**:
  ```
  Subject: Platform Update - All Systems Normal

  Quick update: The platform has been running smoothly for 24 hours since yesterday's update.

  If you encounter any issues with the new features, please report them to support@yourdomain.com.

  New to OAuth login? Check our guide: [link]

  Thanks for your patience!
  ```

**D+7 (One Week After)**:
- **Usage stats email** (optional):
  ```
  Subject: Week 1 Recap - New Features

  It's been a week since our platform update!

  By the numbers:
  - XXX users tried OAuth login
  - XXX knowledge bases created
  - XXX chats powered by Gemini AI

  Haven't tried the new features yet? [Get Started]
  ```

### Support Resources

**FAQ Document**:
- What changed in this update?
- How do I login with Google/GitHub?
- What is Gemini AI?
- Where did [old feature] go?
- How do I report a bug?

**Support Channels**:
- Email: support@yourdomain.com
- In-app chat (if available)
- Status page: status.yourdomain.com
- Documentation: docs.yourdomain.com

---

## 📖 Next Steps

### Immediate Actions (This Week)

1. **Team Review Meeting**
   - Review entire transformation plan with all stakeholders
   - Discuss timeline and resource allocation
   - Assign ownership of each phase to team members
   - Identify any blockers or concerns

2. **Third-Party Setup**
   - Create Google OAuth app credentials
   - Create GitHub OAuth app credentials
   - Obtain Gemini API key
   - Set up Sentry project (if using)
   - Configure monitoring tools

3. **Create Rollback Scripts**
   - Write all database rollback scripts
   - Test rollback scripts on local database
   - Document rollback procedures

4. **Development Environment**
   - Create feature branch: `git checkout -b feature/transform-to-rag-multitenant`
   - Set up local environment with all new API keys
   - Test OAuth flow locally

### Development Phase (Weeks 1-3)

**Week 1: Database & Backend Core**
- Complete database migrations
- Test migrations on staging
- Refactor services and routes
- Begin removing handover system

**Week 2: Backend Features & Frontend Core**
- Implement Gemini LLM integration
- Implement OAuth authentication
- Refactor frontend dashboard
- Update API service layer

**Week 3: Frontend Features & Testing**
- Complete OAuth UI
- Create KB creation modal
- Remove onboarding wizard
- Full testing suite

### Pre-Deployment Phase (Week 4)

**Monday-Tuesday: Final Testing**
- Run all automated tests
- Manual QA testing
- Performance testing
- Security audit

**Wednesday: Staging Deployment**
- Deploy to staging
- Run all smoke tests
- Load testing on staging
- Rollback testing

**Thursday: Go/No-Go Review**
- Review all Go/No-Go criteria
- Final team decision
- If GO: Schedule deployment window
- If NO-GO: Document blockers and reschedule

**Friday-Saturday: User Communication**
- Send D-7 notification email
- Activate in-app banner
- Prepare support team
- Final checks

### Deployment Week

**D-3**: Send reminder email to users
**D-1**: Final staging validation, send final reminder
**D-Day**: Execute deployment (see Big Bang Deployment Strategy)
**D+1**: Post-deployment monitoring and user communication
**D+7**: One-week recap and retrospective

---

## 🎯 Success Criteria

The transformation will be considered successful when:

**Technical**:
- [ ] All migrations completed without data loss
- [ ] All tests passing (100%)
- [ ] Zero critical bugs in production
- [ ] Performance metrics meet or exceed baseline
- [ ] OAuth login working for 95%+ of attempts
- [ ] All three LLM providers (OpenAI, Anthropic, Gemini) operational

**User Experience**:
- [ ] Users can login via OAuth (Google/GitHub)
- [ ] Users can create knowledge bases easily
- [ ] Chat functionality works seamlessly
- [ ] No user complaints about missing features
- [ ] Support tickets < 10% increase from baseline

**Business**:
- [ ] Zero downtime beyond planned maintenance window
- [ ] User retention rate unchanged or improved
- [ ] New user signup rate stable or improved
- [ ] LLM API costs within budget

---

## 🔄 Post-Deployment Review

**Schedule post-mortem meeting 1 week after deployment (D+7)**

**Agenda**:
1. What went well?
2. What didn't go well?
3. What would we do differently next time?
4. Metrics review (performance, errors, user feedback)
5. Outstanding issues and action items

**Document lessons learned** in: `docs/deployment/big-bang-transformation-retrospective.md`

---

## 🆘 Support & Escalation

### During Development
- **Questions**: Post in team Slack channel
- **Blockers**: Escalate to team lead
- **Architecture decisions**: Discuss in daily standup

### During Deployment
- **Primary on-call**: [Name] - [Phone]
- **Backup on-call**: [Name] - [Phone]
- **Database expert**: [Name] - [Phone]
- **Infrastructure lead**: [Name] - [Phone]

### Emergency Contacts
- **CEO/CTO**: [Phone] - For critical business decisions
- **Security team**: [Phone] - For security issues
- **Cloud provider support**: [Number] - For infrastructure issues

### Rollback Authority
Only the following people can authorize rollback:
- Team Lead
- CTO
- On-call Engineer (if team lead unreachable)

**Rollback decision must be made within 30 minutes of identifying critical issue.**

---

## 📋 Appendix

### A. Database Migration Scripts Location
- Forward migrations: `database/migrations/010_*.sql`, `011_*.sql`, `012_*.sql`
- Rollback scripts: `database/migrations/rollback/`
- Validation queries: Included in migration plan above

### B. Testing Scripts Location
- Backend tests: `backend/src/**/*.test.ts`
- Frontend tests: `frontend/src/**/*.test.tsx`
- Load tests: `tests/load/` (to be created)
- E2E tests: `tests/e2e/` (if exists)

### C. Documentation Updates Required
- [ ] `CLAUDE.md` - Update all terminology
- [ ] `README.md` - Update project description
- [ ] `docs/oauth-setup.md` - Already created
- [ ] `docs/api/` - Update API documentation
- [ ] `docs/deployment/` - Update deployment guide
- [ ] `docs/architecture/` - Update diagrams

### D. Environment Variables Checklist

**Development**:
```env
GEMINI_API_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
```

**Staging** (same as dev + staging URLs)

**Production**:
```env
GEMINI_API_KEY=
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/auth/google/callback
GITHUB_OAUTH_CLIENT_ID=
GITHUB_OAUTH_CLIENT_SECRET=
GITHUB_OAUTH_REDIRECT_URI=https://yourdomain.com/api/oauth/auth/github/callback
```

### E. Monitoring Dashboards

**Pre-deployment**: Create Grafana dashboards for:
- API response times (by endpoint)
- LLM API calls (by provider)
- Database performance
- Error rates
- User activity

**Alerts**: Configure PagerDuty/Opsgenie for critical alerts

---

**🚀 Ready for Big Bang Transformation!**

This plan is comprehensive and battle-tested. Follow it step by step, and you'll successfully transform your Digital Twin platform into a modern RAG Multitenant system.

**Key Takeaways**:
✅ Big Bang approach is necessary due to breaking changes
✅ Comprehensive testing and rollback plans mitigate risk
✅ Clear communication keeps users informed
✅ Monitoring and observability ensure smooth operation
✅ Go/No-Go criteria ensure readiness before deployment

**Remember**:
- Test everything twice
- Document everything once
- Communicate early and often
- Have a rollback plan ready
- Monitor closely post-deployment

**Good luck!** 🎉
