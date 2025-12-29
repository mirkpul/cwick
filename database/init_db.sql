-- ============================================
-- RAG Knowledge Base System
-- Complete Database Schema (Final State)
-- Consolidated from migrations 001-013
-- ============================================

-- ============================================
-- EXTENSIONS
-- ============================================

-- UUID support
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Vector embeddings for semantic search
CREATE EXTENSION IF NOT EXISTS vector;

-- Full-text search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- ENUM TYPES
-- ============================================

-- User roles (after transformation: professional → kb_owner)
CREATE TYPE user_role AS ENUM ('super_admin', 'kb_owner', 'end_user');

-- Subscription tiers
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');

-- LLM providers (includes gemini from migration 013)
CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic', 'gemini', 'ollama', 'custom');

-- Conversation status (after removal of 'handed_over')
CREATE TYPE conversation_status AS ENUM ('active', 'closed');

-- Message sender (after removal of 'professional' and renaming 'twin' to 'assistant')
CREATE TYPE message_sender AS ENUM ('user', 'assistant');

-- Email provider types
CREATE TYPE email_provider AS ENUM ('gmail', 'outlook', 'imap');

-- ============================================
-- CORE TABLES
-- ============================================

-- Users table (KB owners, end users, admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255), -- Nullable for OAuth users
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'kb_owner',

    -- OAuth support (migration 012)
    oauth_provider VARCHAR(50),
    oauth_id VARCHAR(255),
    avatar_url VARCHAR(500),

    -- Account status
    is_active BOOLEAN DEFAULT true,
    email_verified BOOLEAN DEFAULT false,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier subscription_tier NOT NULL DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    monthly_message_limit INTEGER,
    messages_used_this_month INTEGER DEFAULT 0,
    current_period_start TIMESTAMP,
    current_period_end TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Knowledge Bases table (renamed from digital_twins in migration 010)
CREATE TABLE knowledge_bases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    avatar_url VARCHAR(500),

    -- Purpose configuration (migration 006)
    purpose TEXT,
    purpose_config JSONB DEFAULT '{}'::jsonb,

    -- AI Configuration
    llm_provider llm_provider NOT NULL DEFAULT 'openai',
    llm_model VARCHAR(100),
    system_prompt TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,

    -- RAG Configuration (migration 003)
    rag_config JSONB DEFAULT '{}',

    -- Semantic search configuration
    semantic_search_threshold DECIMAL(3,2) DEFAULT 0.80
        CHECK (semantic_search_threshold >= 0 AND semantic_search_threshold <= 1),
    semantic_search_max_results INTEGER DEFAULT 3
        CHECK (semantic_search_max_results > 0 AND semantic_search_max_results <= 10),

    -- Settings
    auto_responses_enabled BOOLEAN DEFAULT true,

    -- Sharing (migration 010)
    is_public BOOLEAN DEFAULT false,
    share_url VARCHAR(255) UNIQUE,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Knowledge Base entries (FAQ, documents, etc.)
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50), -- 'faq', 'document', 'manual_entry', 'url', 'web_scrape'
    source_url VARCHAR(500),
    metadata JSONB,
    embedding vector(1536), -- For semantic search (OpenAI embeddings)

    -- File upload support fields
    file_name VARCHAR(255),
    file_size INTEGER,
    file_type VARCHAR(100),
    chunk_index INTEGER DEFAULT 0,
    total_chunks INTEGER DEFAULT 1,
    parent_entry_id UUID REFERENCES knowledge_base(id) ON DELETE CASCADE,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- End Users table (people who chat with knowledge bases)
CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    name VARCHAR(255),
    phone VARCHAR(50),
    metadata JSONB, -- Additional contact info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table (no handover fields after migration 011)
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    end_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    status conversation_status DEFAULT 'active',
    closed_at TIMESTAMP,
    summary TEXT,
    metadata JSONB, -- Session info, source channel, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table (sender is now 'user' or 'assistant' only)
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender message_sender NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB, -- LLM response metadata, confidence scores, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Events table
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- 'message_sent', 'conversation_started', etc.
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- EMAIL KNOWLEDGE BASE TABLES (Migration 002)
-- ============================================

-- Email credentials table
CREATE TABLE email_credentials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider email_provider NOT NULL,
    email_address VARCHAR(255) NOT NULL,

    -- OAuth tokens (encrypted)
    encrypted_access_token TEXT,
    encrypted_refresh_token TEXT,
    token_expires_at TIMESTAMP,

    -- IMAP credentials (encrypted)
    imap_host VARCHAR(255),
    imap_port INTEGER,
    encrypted_imap_password TEXT,

    -- Sync configuration
    auto_sync_enabled BOOLEAN DEFAULT false,
    sync_frequency_hours INTEGER DEFAULT 24,
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50), -- 'success', 'failed', 'in_progress'
    last_sync_error TEXT,

    -- Import scope
    months_to_import INTEGER DEFAULT 6,
    max_emails_limit INTEGER,
    current_email_count INTEGER DEFAULT 0,

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(user_id, email_address)
);

-- Email knowledge table
CREATE TABLE email_knowledge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id UUID NOT NULL REFERENCES email_credentials(id) ON DELETE CASCADE,

    -- Email identifiers
    email_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),

    -- Email metadata
    subject VARCHAR(1000) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    recipients JSONB,
    cc_recipients JSONB,
    sent_at TIMESTAMP NOT NULL,

    -- Email content
    body_text TEXT NOT NULL,
    body_html TEXT,

    -- Thread context
    is_reply BOOLEAN DEFAULT false,
    in_reply_to VARCHAR(255),

    -- Attachments
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    attachments_metadata JSONB,

    -- Email categorization
    labels JSONB,
    is_important BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,

    -- Vector embedding for semantic search
    embedding vector(1536),

    -- Privacy & Security
    has_sensitive_data BOOLEAN DEFAULT false,
    redacted_fields JSONB,

    -- Search weight configuration
    search_weight DECIMAL(3,2) DEFAULT 1.0
        CHECK (search_weight >= 0 AND search_weight <= 2.0),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(credential_id, email_id)
);

-- Email sync history table
CREATE TABLE email_sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id UUID NOT NULL REFERENCES email_credentials(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL,
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    emails_processed INTEGER DEFAULT 0,
    emails_added INTEGER DEFAULT 0,
    emails_skipped INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- RAG BENCHMARK TABLES (Migration 004)
-- ============================================

-- Benchmark datasets
CREATE TABLE benchmark_datasets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    dataset_type VARCHAR(50) NOT NULL DEFAULT 'golden',
    is_active BOOLEAN DEFAULT true,
    total_questions INTEGER DEFAULT 0,
    generation_config JSONB,
    tags JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Benchmark questions
CREATE TABLE benchmark_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dataset_id UUID NOT NULL REFERENCES benchmark_datasets(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    expected_answer TEXT,
    expected_context_ids UUID[],
    question_type VARCHAR(50) DEFAULT 'simple',
    difficulty VARCHAR(20) DEFAULT 'medium',
    source_type VARCHAR(50),
    source_kb_id UUID REFERENCES knowledge_base(id) ON DELETE SET NULL,
    tags JSONB,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Benchmark runs
CREATE TABLE benchmark_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    dataset_id UUID REFERENCES benchmark_datasets(id) ON DELETE SET NULL,
    name VARCHAR(255),
    description TEXT,
    run_type VARCHAR(50) DEFAULT 'full',
    rag_config JSONB NOT NULL,
    comparison_run_id UUID REFERENCES benchmark_runs(id),
    status VARCHAR(50) DEFAULT 'pending',
    progress INTEGER DEFAULT 0,
    started_at TIMESTAMP,
    completed_at TIMESTAMP,
    error_message TEXT,
    aggregate_metrics JSONB,
    total_llm_tokens INTEGER DEFAULT 0,
    total_embedding_tokens INTEGER DEFAULT 0,
    estimated_cost_usd DECIMAL(10, 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Benchmark results
CREATE TABLE benchmark_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    run_id UUID NOT NULL REFERENCES benchmark_runs(id) ON DELETE CASCADE,
    question_id UUID NOT NULL REFERENCES benchmark_questions(id) ON DELETE CASCADE,
    input_question TEXT NOT NULL,
    enhanced_query TEXT,
    retrieved_context_ids UUID[],
    retrieved_context JSONB,
    generated_answer TEXT,
    llm_provider VARCHAR(50),
    llm_model VARCHAR(100),
    query_enhancement_ms INTEGER,
    vector_search_ms INTEGER,
    bm25_search_ms INTEGER,
    fusion_ms INTEGER,
    reranking_ms INTEGER,
    generation_ms INTEGER,
    total_latency_ms INTEGER,
    prompt_tokens INTEGER,
    completion_tokens INTEGER,
    embedding_tokens INTEGER,
    metrics JSONB,
    human_rating INTEGER CHECK (human_rating >= 1 AND human_rating <= 5),
    human_feedback TEXT,
    evaluated_by UUID REFERENCES users(id),
    evaluated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- A/B test configurations
CREATE TABLE benchmark_ab_tests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    config_a JSONB NOT NULL,
    config_b JSONB NOT NULL,
    config_a_name VARCHAR(100) DEFAULT 'Control',
    config_b_name VARCHAR(100) DEFAULT 'Variant',
    run_a_id UUID REFERENCES benchmark_runs(id) ON DELETE SET NULL,
    run_b_id UUID REFERENCES benchmark_runs(id) ON DELETE SET NULL,
    dataset_id UUID REFERENCES benchmark_datasets(id) ON DELETE SET NULL,
    status VARCHAR(50) DEFAULT 'pending',
    winner VARCHAR(10),
    statistical_significance DECIMAL(5, 4),
    comparison_results JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================
-- WEB SCRAPING TABLES (Migration 005)
-- ============================================

-- Web sources configuration
CREATE TABLE web_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    base_url TEXT NOT NULL,
    scrape_strategy VARCHAR(50) DEFAULT 'single_page'
        CHECK (scrape_strategy IN ('single_page', 'crawl')),
    crawl_depth INTEGER DEFAULT 1 CHECK (crawl_depth >= 1 AND crawl_depth <= 5),
    max_pages INTEGER DEFAULT 20 CHECK (max_pages >= 1 AND max_pages <= 500),
    auto_refresh_enabled BOOLEAN DEFAULT false,
    schedule_frequency_hours INTEGER DEFAULT 24
        CHECK (schedule_frequency_hours >= 1 AND schedule_frequency_hours <= 168),
    include_paths TEXT[] DEFAULT ARRAY[]::TEXT[],
    exclude_paths TEXT[] DEFAULT ARRAY[]::TEXT[],
    config JSONB DEFAULT '{}'::jsonb,
    last_run_at TIMESTAMP,
    next_run_at TIMESTAMP,
    last_status VARCHAR(50) DEFAULT 'idle',
    last_error TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Web scrape run history
CREATE TABLE web_scrape_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    source_id UUID NOT NULL REFERENCES web_sources(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL,
    trigger_type VARCHAR(50) DEFAULT 'manual',
    pages_processed INTEGER DEFAULT 0,
    entries_added INTEGER DEFAULT 0,
    error TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- LLM USAGE TRACKING (Migration 007)
-- ============================================

CREATE TABLE llm_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    kb_id UUID REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL CHECK (provider IN ('openai', 'anthropic')),
    model VARCHAR(100) NOT NULL,
    operation VARCHAR(50) NOT NULL CHECK (operation IN ('chat', 'embedding', 'vision', 'streaming')),
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd DECIMAL(10, 6) NOT NULL DEFAULT 0.00,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- VECTOR STORE (Migration 008)
-- ============================================

CREATE TABLE vector_store (
    id UUID PRIMARY KEY,
    namespace TEXT NOT NULL DEFAULT 'default',
    vector VECTOR(1536) NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- DOCUMENT PROCESSING (Migration 009)
-- ============================================

CREATE TABLE document_processing_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    kb_id UUID NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP
);

-- ============================================
-- INDEXES
-- ============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE UNIQUE INDEX idx_users_oauth ON users(oauth_provider, oauth_id)
    WHERE oauth_provider IS NOT NULL AND oauth_id IS NOT NULL;
CREATE INDEX idx_users_avatar_url ON users(avatar_url) WHERE avatar_url IS NOT NULL;

-- Subscriptions
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);

-- Knowledge Bases
CREATE INDEX idx_knowledge_bases_user_id ON knowledge_bases(user_id);
CREATE INDEX idx_knowledge_bases_is_public ON knowledge_bases(is_public) WHERE is_public = true;
CREATE INDEX idx_knowledge_bases_share_url ON knowledge_bases(share_url) WHERE share_url IS NOT NULL;
CREATE INDEX idx_knowledge_bases_semantic_config ON knowledge_bases(semantic_search_threshold, semantic_search_max_results)
    WHERE semantic_search_threshold IS NOT NULL;
CREATE INDEX idx_knowledge_bases_rag_config ON knowledge_bases USING gin (rag_config);
CREATE INDEX idx_knowledge_bases_purpose_config ON knowledge_bases USING gin (purpose_config);

-- Knowledge Base entries
CREATE INDEX idx_knowledge_base_kb_id ON knowledge_base(kb_id);
CREATE INDEX idx_knowledge_base_parent_entry ON knowledge_base(parent_entry_id);
CREATE INDEX idx_knowledge_base_chunks ON knowledge_base(kb_id, parent_entry_id, chunk_index);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);

-- Conversations and Messages
CREATE INDEX idx_conversations_kb_id ON conversations(kb_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);

-- Analytics
CREATE INDEX idx_analytics_events_kb_id ON analytics_events(kb_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Email Credentials
CREATE INDEX idx_email_credentials_user_id ON email_credentials(user_id);
CREATE INDEX idx_email_credentials_provider ON email_credentials(provider);
CREATE INDEX idx_email_credentials_auto_sync ON email_credentials(auto_sync_enabled, last_sync_at)
    WHERE auto_sync_enabled = true;

-- Email Knowledge
CREATE INDEX idx_email_knowledge_user_id ON email_knowledge(user_id);
CREATE INDEX idx_email_knowledge_credential_id ON email_knowledge(credential_id);
CREATE INDEX idx_email_knowledge_sent_at ON email_knowledge(sent_at DESC);
CREATE INDEX idx_email_knowledge_sender ON email_knowledge(sender_email);
CREATE INDEX idx_email_knowledge_thread_id ON email_knowledge(thread_id);
CREATE INDEX idx_email_knowledge_has_attachments ON email_knowledge(has_attachments)
    WHERE has_attachments = true;
CREATE INDEX idx_email_knowledge_embedding ON email_knowledge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
CREATE INDEX idx_email_knowledge_user_sent ON email_knowledge(user_id, sent_at DESC);

-- Email Sync History
CREATE INDEX idx_email_sync_history_credential ON email_sync_history(credential_id, started_at DESC);
CREATE INDEX idx_email_sync_history_status ON email_sync_history(status, started_at DESC);

-- Benchmark Tables
CREATE INDEX idx_benchmark_datasets_kb ON benchmark_datasets(kb_id);
CREATE INDEX idx_benchmark_datasets_active ON benchmark_datasets(is_active);
CREATE INDEX idx_benchmark_questions_dataset ON benchmark_questions(dataset_id);
CREATE INDEX idx_benchmark_questions_active ON benchmark_questions(is_active);
CREATE INDEX idx_benchmark_runs_kb ON benchmark_runs(kb_id);
CREATE INDEX idx_benchmark_runs_status ON benchmark_runs(status);
CREATE INDEX idx_benchmark_runs_dataset ON benchmark_runs(dataset_id);
CREATE INDEX idx_benchmark_results_run ON benchmark_results(run_id);
CREATE INDEX idx_benchmark_results_question ON benchmark_results(question_id);
CREATE INDEX idx_benchmark_ab_tests_kb ON benchmark_ab_tests(kb_id);
CREATE INDEX idx_benchmark_ab_tests_status ON benchmark_ab_tests(status);

-- Web Scraping
CREATE INDEX idx_web_sources_kb_id ON web_sources(kb_id);
CREATE INDEX idx_web_sources_next_run ON web_sources(auto_refresh_enabled, next_run_at)
    WHERE auto_refresh_enabled = true;
CREATE INDEX idx_web_scrape_runs_source ON web_scrape_runs(source_id, started_at DESC);

-- LLM Usage Tracking
CREATE INDEX idx_llm_usage_user_id ON llm_usage(user_id);
CREATE INDEX idx_llm_usage_kb_id ON llm_usage(kb_id);
CREATE INDEX idx_llm_usage_provider ON llm_usage(provider);
CREATE INDEX idx_llm_usage_created_at ON llm_usage(created_at);
CREATE INDEX idx_llm_usage_cost ON llm_usage(cost_usd);

-- Vector Store
CREATE INDEX idx_vector_store_namespace ON vector_store(namespace);
CREATE INDEX idx_vector_store_updated_at ON vector_store(updated_at);

-- Document Processing Jobs
CREATE INDEX idx_doc_jobs_kb_id ON document_processing_jobs(kb_id);
CREATE INDEX idx_doc_jobs_status ON document_processing_jobs(status);

-- ============================================
-- TRIGGERS AND FUNCTIONS
-- ============================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON knowledge_bases
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_end_users_updated_at BEFORE UPDATE ON end_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_credentials_updated_at BEFORE UPDATE ON email_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_knowledge_updated_at BEFORE UPDATE ON email_knowledge
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_datasets_updated_at BEFORE UPDATE ON benchmark_datasets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_questions_updated_at BEFORE UPDATE ON benchmark_questions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_benchmark_runs_updated_at BEFORE UPDATE ON benchmark_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_sources_updated_at BEFORE UPDATE ON web_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_scrape_runs_updated_at BEFORE UPDATE ON web_scrape_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vector_store_updated_at BEFORE UPDATE ON vector_store
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_document_processing_jobs_updated_at BEFORE UPDATE ON document_processing_jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Email count management functions
CREATE OR REPLACE FUNCTION update_email_count()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        UPDATE email_credentials
        SET current_email_count = current_email_count + 1
        WHERE id = NEW.credential_id;
        RETURN NEW;
    ELSIF (TG_OP = 'DELETE') THEN
        UPDATE email_credentials
        SET current_email_count = GREATEST(current_email_count - 1, 0)
        WHERE id = OLD.credential_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_credential_email_count
    AFTER INSERT OR DELETE ON email_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION update_email_count();

-- Email limit enforcement
CREATE OR REPLACE FUNCTION check_email_limit()
RETURNS TRIGGER AS $$
DECLARE
    current_count INTEGER;
    max_limit INTEGER;
BEGIN
    SELECT current_email_count, max_emails_limit
    INTO current_count, max_limit
    FROM email_credentials
    WHERE id = NEW.credential_id;

    IF max_limit IS NOT NULL AND current_count >= max_limit THEN
        RAISE EXCEPTION 'Email limit reached for this credential. Current: %, Limit: %',
            current_count, max_limit;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enforce_email_limit
    BEFORE INSERT ON email_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION check_email_limit();

-- ============================================
-- VIEWS
-- ============================================

-- LLM cost analytics view
CREATE OR REPLACE VIEW llm_cost_analytics AS
SELECT
    DATE_TRUNC('day', created_at) AS date,
    provider,
    model,
    operation,
    COUNT(*) AS request_count,
    SUM(prompt_tokens) AS total_prompt_tokens,
    SUM(completion_tokens) AS total_completion_tokens,
    SUM(total_tokens) AS total_tokens,
    SUM(cost_usd) AS total_cost_usd,
    AVG(cost_usd) AS avg_cost_per_request
FROM llm_usage
GROUP BY DATE_TRUNC('day', created_at), provider, model, operation
ORDER BY date DESC, total_cost_usd DESC;

-- LLM user costs view
CREATE OR REPLACE VIEW llm_user_costs AS
SELECT
    u.id AS user_id,
    u.email,
    kb.id AS kb_id,
    kb.name AS kb_name,
    DATE_TRUNC('month', lu.created_at) AS month,
    lu.provider,
    COUNT(*) AS request_count,
    SUM(lu.total_tokens) AS total_tokens,
    SUM(lu.cost_usd) AS total_cost_usd
FROM llm_usage lu
LEFT JOIN users u ON lu.user_id = u.id
LEFT JOIN knowledge_bases kb ON lu.kb_id = kb.id
GROUP BY u.id, u.email, kb.id, kb.name, DATE_TRUNC('month', lu.created_at), lu.provider
ORDER BY month DESC, total_cost_usd DESC;

-- ============================================
-- COMMENTS (Documentation)
-- ============================================

-- Enum types
COMMENT ON TYPE user_role IS 'User role: super_admin (platform admin), kb_owner (creates KBs), end_user (chats with KBs)';
COMMENT ON TYPE llm_provider IS 'Supported LLM providers: openai (GPT models), anthropic (Claude), gemini (Google AI), ollama (local), custom';
COMMENT ON TYPE conversation_status IS 'Conversation status: active (ongoing) or closed (ended)';
COMMENT ON TYPE message_sender IS 'Message sender: user (end-user) or assistant (AI/RAG)';

-- Tables
COMMENT ON TABLE users IS 'Users table: must have either (email + password_hash) OR (oauth_provider + oauth_id)';
COMMENT ON TABLE knowledge_bases IS 'Knowledge Bases created by users for RAG-powered chat';
COMMENT ON TABLE conversations IS 'Chat conversations between end-users and Knowledge Base AI assistants (no human handover)';
COMMENT ON TABLE llm_usage IS 'Tracks all LLM API calls for cost monitoring and analytics';

-- Columns
COMMENT ON COLUMN users.oauth_provider IS 'OAuth provider name (google, github, etc.) or NULL for email/password auth';
COMMENT ON COLUMN users.oauth_id IS 'Unique user ID from OAuth provider';
COMMENT ON COLUMN users.avatar_url IS 'User avatar URL (from OAuth or custom upload)';
COMMENT ON COLUMN users.password_hash IS 'Bcrypt password hash - NULL for OAuth users';
COMMENT ON COLUMN knowledge_bases.description IS 'User-provided description of the Knowledge Base purpose and content';
COMMENT ON COLUMN knowledge_bases.is_public IS 'Whether this KB is publicly accessible via share_url';
COMMENT ON COLUMN knowledge_bases.share_url IS 'Unique URL slug for public access (e.g., /chat/my-kb-slug)';
COMMENT ON COLUMN knowledge_bases.name IS 'Knowledge Base display name';
COMMENT ON COLUMN knowledge_bases.rag_config IS 'Advanced RAG configuration: hybrid search, reranking, ensemble balancing, etc.';
COMMENT ON COLUMN conversations.status IS 'Current conversation status (active or closed)';
COMMENT ON COLUMN messages.sender IS 'Who sent this message (user or assistant)';
COMMENT ON COLUMN llm_usage.cost_usd IS 'Estimated cost in USD based on provider pricing';

-- Views
COMMENT ON VIEW llm_cost_analytics IS 'Daily cost analytics aggregated by provider, model, and operation';
COMMENT ON VIEW llm_user_costs IS 'Monthly cost analytics per user and knowledge base';
