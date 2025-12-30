--
-- PostgreSQL database dump
--

\restrict rLXjIujWsUtJxPCqPGsEL2lFk4AfYbwa6IGnY31Mb7Rer7qjzHwMe4MdU2nAWgu

-- Dumped from database version 16.11 (Debian 16.11-1.pgdg12+1)
-- Dumped by pg_dump version 16.11 (Debian 16.11-1.pgdg12+1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: vector; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;


--
-- Name: EXTENSION vector; Type: COMMENT; Schema: -; Owner: 
--

COMMENT ON EXTENSION vector IS 'vector data type and ivfflat and hnsw access methods';


--
-- Name: conversation_status; Type: TYPE; Schema: public; Owner: digitaltwin_user
--

CREATE TYPE public.conversation_status AS ENUM (
    'active',
    'closed'
);


ALTER TYPE public.conversation_status OWNER TO digitaltwin_user;

--
-- Name: TYPE conversation_status; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TYPE public.conversation_status IS 'Conversation status: active (ongoing) or closed (ended)';


--
-- Name: email_provider; Type: TYPE; Schema: public; Owner: digitaltwin_user
--

CREATE TYPE public.email_provider AS ENUM (
    'gmail',
    'outlook',
    'imap'
);


ALTER TYPE public.email_provider OWNER TO digitaltwin_user;

--
-- Name: llm_provider; Type: TYPE; Schema: public; Owner: digitaltwin_user
--

CREATE TYPE public.llm_provider AS ENUM (
    'openai',
    'anthropic',
    'gemini',
    'ollama',
    'custom'
);


ALTER TYPE public.llm_provider OWNER TO digitaltwin_user;

--
-- Name: TYPE llm_provider; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TYPE public.llm_provider IS 'Supported LLM providers: openai (GPT models), anthropic (Claude), gemini (Google AI), ollama (local), custom';


--
-- Name: message_sender; Type: TYPE; Schema: public; Owner: digitaltwin_user
--

CREATE TYPE public.message_sender AS ENUM (
    'user',
    'assistant'
);


ALTER TYPE public.message_sender OWNER TO digitaltwin_user;

--
-- Name: TYPE message_sender; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TYPE public.message_sender IS 'Message sender: user (end-user) or assistant (AI/RAG)';


--
-- Name: subscription_tier; Type: TYPE; Schema: public; Owner: digitaltwin_user
--

CREATE TYPE public.subscription_tier AS ENUM (
    'free',
    'basic',
    'pro',
    'enterprise'
);


ALTER TYPE public.subscription_tier OWNER TO digitaltwin_user;

--
-- Name: user_role; Type: TYPE; Schema: public; Owner: digitaltwin_user
--

CREATE TYPE public.user_role AS ENUM (
    'super_admin',
    'kb_owner',
    'end_user'
);


ALTER TYPE public.user_role OWNER TO digitaltwin_user;

--
-- Name: TYPE user_role; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TYPE public.user_role IS 'User role: super_admin (platform admin), kb_owner (creates KBs), end_user (chats with KBs)';


--
-- Name: check_email_limit(); Type: FUNCTION; Schema: public; Owner: digitaltwin_user
--

CREATE FUNCTION public.check_email_limit() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.check_email_limit() OWNER TO digitaltwin_user;

--
-- Name: update_email_count(); Type: FUNCTION; Schema: public; Owner: digitaltwin_user
--

CREATE FUNCTION public.update_email_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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
$$;


ALTER FUNCTION public.update_email_count() OWNER TO digitaltwin_user;

--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: digitaltwin_user
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$;


ALTER FUNCTION public.update_updated_at_column() OWNER TO digitaltwin_user;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: analytics_events; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.analytics_events (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid,
    event_type character varying(100) NOT NULL,
    event_data jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.analytics_events OWNER TO digitaltwin_user;

--
-- Name: benchmark_ab_tests; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.benchmark_ab_tests (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    config_a jsonb NOT NULL,
    config_b jsonb NOT NULL,
    config_a_name character varying(100) DEFAULT 'Control'::character varying,
    config_b_name character varying(100) DEFAULT 'Variant'::character varying,
    run_a_id uuid,
    run_b_id uuid,
    dataset_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    winner character varying(10),
    statistical_significance numeric(5,4),
    comparison_results jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


ALTER TABLE public.benchmark_ab_tests OWNER TO digitaltwin_user;

--
-- Name: benchmark_datasets; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.benchmark_datasets (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    dataset_type character varying(50) DEFAULT 'golden'::character varying NOT NULL,
    is_active boolean DEFAULT true,
    total_questions integer DEFAULT 0,
    generation_config jsonb,
    tags jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.benchmark_datasets OWNER TO digitaltwin_user;

--
-- Name: benchmark_questions; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.benchmark_questions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    dataset_id uuid NOT NULL,
    question text NOT NULL,
    expected_answer text,
    expected_context_ids uuid[],
    question_type character varying(50) DEFAULT 'simple'::character varying,
    difficulty character varying(20) DEFAULT 'medium'::character varying,
    source_type character varying(50),
    source_kb_id uuid,
    tags jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.benchmark_questions OWNER TO digitaltwin_user;

--
-- Name: benchmark_results; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.benchmark_results (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    run_id uuid NOT NULL,
    question_id uuid NOT NULL,
    input_question text NOT NULL,
    enhanced_query text,
    retrieved_context_ids uuid[],
    retrieved_context jsonb,
    generated_answer text,
    llm_provider character varying(50),
    llm_model character varying(100),
    query_enhancement_ms integer,
    vector_search_ms integer,
    bm25_search_ms integer,
    fusion_ms integer,
    reranking_ms integer,
    generation_ms integer,
    total_latency_ms integer,
    prompt_tokens integer,
    completion_tokens integer,
    embedding_tokens integer,
    metrics jsonb,
    human_rating integer,
    human_feedback text,
    evaluated_by uuid,
    evaluated_at timestamp without time zone,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT benchmark_results_human_rating_check CHECK (((human_rating >= 1) AND (human_rating <= 5)))
);


ALTER TABLE public.benchmark_results OWNER TO digitaltwin_user;

--
-- Name: benchmark_runs; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.benchmark_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid NOT NULL,
    dataset_id uuid,
    name character varying(255),
    description text,
    run_type character varying(50) DEFAULT 'full'::character varying,
    rag_config jsonb NOT NULL,
    comparison_run_id uuid,
    status character varying(50) DEFAULT 'pending'::character varying,
    progress integer DEFAULT 0,
    started_at timestamp without time zone,
    completed_at timestamp without time zone,
    error_message text,
    aggregate_metrics jsonb,
    total_llm_tokens integer DEFAULT 0,
    total_embedding_tokens integer DEFAULT 0,
    estimated_cost_usd numeric(10,6),
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.benchmark_runs OWNER TO digitaltwin_user;

--
-- Name: conversations; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.conversations (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid NOT NULL,
    end_user_id uuid NOT NULL,
    status public.conversation_status DEFAULT 'active'::public.conversation_status,
    closed_at timestamp without time zone,
    summary text,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.conversations OWNER TO digitaltwin_user;

--
-- Name: TABLE conversations; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TABLE public.conversations IS 'Chat conversations between end-users and Knowledge Base AI assistants (no human handover)';


--
-- Name: COLUMN conversations.status; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.conversations.status IS 'Current conversation status (active or closed)';


--
-- Name: document_processing_jobs; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.document_processing_jobs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid NOT NULL,
    file_name text NOT NULL,
    status character varying(50) DEFAULT 'pending'::character varying NOT NULL,
    result jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone
);


ALTER TABLE public.document_processing_jobs OWNER TO digitaltwin_user;

--
-- Name: email_credentials; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.email_credentials (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    provider public.email_provider NOT NULL,
    email_address character varying(255) NOT NULL,
    encrypted_access_token text,
    encrypted_refresh_token text,
    token_expires_at timestamp without time zone,
    imap_host character varying(255),
    imap_port integer,
    encrypted_imap_password text,
    auto_sync_enabled boolean DEFAULT false,
    sync_frequency_hours integer DEFAULT 24,
    last_sync_at timestamp without time zone,
    last_sync_status character varying(50),
    last_sync_error text,
    months_to_import integer DEFAULT 6,
    max_emails_limit integer,
    current_email_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_credentials OWNER TO digitaltwin_user;

--
-- Name: email_knowledge; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.email_knowledge (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    credential_id uuid NOT NULL,
    email_id character varying(255) NOT NULL,
    thread_id character varying(255),
    subject character varying(1000) NOT NULL,
    sender_email character varying(255) NOT NULL,
    sender_name character varying(255),
    recipients jsonb,
    cc_recipients jsonb,
    sent_at timestamp without time zone NOT NULL,
    body_text text NOT NULL,
    body_html text,
    is_reply boolean DEFAULT false,
    in_reply_to character varying(255),
    has_attachments boolean DEFAULT false,
    attachment_count integer DEFAULT 0,
    attachments_metadata jsonb,
    labels jsonb,
    is_important boolean DEFAULT false,
    is_starred boolean DEFAULT false,
    embedding public.vector(1536),
    has_sensitive_data boolean DEFAULT false,
    redacted_fields jsonb,
    search_weight numeric(3,2) DEFAULT 1.0,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT email_knowledge_search_weight_check CHECK (((search_weight >= (0)::numeric) AND (search_weight <= 2.0)))
);


ALTER TABLE public.email_knowledge OWNER TO digitaltwin_user;

--
-- Name: email_sync_history; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.email_sync_history (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    credential_id uuid NOT NULL,
    sync_type character varying(50) NOT NULL,
    started_at timestamp without time zone NOT NULL,
    completed_at timestamp without time zone,
    status character varying(50) NOT NULL,
    emails_processed integer DEFAULT 0,
    emails_added integer DEFAULT 0,
    emails_skipped integer DEFAULT 0,
    emails_failed integer DEFAULT 0,
    error_message text,
    error_details jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.email_sync_history OWNER TO digitaltwin_user;

--
-- Name: end_users; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.end_users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255),
    name character varying(255),
    phone character varying(50),
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.end_users OWNER TO digitaltwin_user;

--
-- Name: knowledge_base; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.knowledge_base (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid NOT NULL,
    title character varying(255) NOT NULL,
    content text NOT NULL,
    content_type character varying(50),
    source_url character varying(500),
    metadata jsonb,
    embedding public.vector(1536),
    file_name character varying(255),
    file_size integer,
    file_type character varying(100),
    chunk_index integer DEFAULT 0,
    total_chunks integer DEFAULT 1,
    parent_entry_id uuid,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.knowledge_base OWNER TO digitaltwin_user;

--
-- Name: knowledge_bases; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.knowledge_bases (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    description text,
    avatar_url character varying(500),
    purpose text,
    purpose_config jsonb DEFAULT '{}'::jsonb,
    llm_provider public.llm_provider DEFAULT 'openai'::public.llm_provider NOT NULL,
    llm_model character varying(100),
    system_prompt text,
    temperature numeric(3,2) DEFAULT 0.7,
    max_tokens integer DEFAULT 1000,
    rag_config jsonb DEFAULT '{}'::jsonb,
    semantic_search_threshold numeric(3,2) DEFAULT 0.80,
    semantic_search_max_results integer DEFAULT 3,
    auto_responses_enabled boolean DEFAULT true,
    is_public boolean DEFAULT false,
    share_url character varying(255),
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT knowledge_bases_semantic_search_max_results_check CHECK (((semantic_search_max_results > 0) AND (semantic_search_max_results <= 10))),
    CONSTRAINT knowledge_bases_semantic_search_threshold_check CHECK (((semantic_search_threshold >= (0)::numeric) AND (semantic_search_threshold <= (1)::numeric)))
);


ALTER TABLE public.knowledge_bases OWNER TO digitaltwin_user;

--
-- Name: TABLE knowledge_bases; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TABLE public.knowledge_bases IS 'Knowledge Bases created by users for RAG-powered chat';


--
-- Name: COLUMN knowledge_bases.name; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.knowledge_bases.name IS 'Knowledge Base display name';


--
-- Name: COLUMN knowledge_bases.description; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.knowledge_bases.description IS 'User-provided description of the Knowledge Base purpose and content';


--
-- Name: COLUMN knowledge_bases.rag_config; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.knowledge_bases.rag_config IS 'Advanced RAG configuration: hybrid search, reranking, ensemble balancing, etc.';


--
-- Name: COLUMN knowledge_bases.is_public; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.knowledge_bases.is_public IS 'Whether this KB is publicly accessible via share_url';


--
-- Name: COLUMN knowledge_bases.share_url; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.knowledge_bases.share_url IS 'Unique URL slug for public access (e.g., /chat/my-kb-slug)';


--
-- Name: llm_usage; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.llm_usage (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid,
    kb_id uuid,
    provider character varying(50) NOT NULL,
    model character varying(100) NOT NULL,
    operation character varying(50) NOT NULL,
    prompt_tokens integer DEFAULT 0 NOT NULL,
    completion_tokens integer DEFAULT 0,
    total_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(10,6) DEFAULT 0.00 NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT llm_usage_operation_check CHECK (((operation)::text = ANY ((ARRAY['chat'::character varying, 'embedding'::character varying, 'vision'::character varying, 'streaming'::character varying])::text[]))),
    CONSTRAINT llm_usage_provider_check CHECK (((provider)::text = ANY ((ARRAY['openai'::character varying, 'anthropic'::character varying])::text[])))
);


ALTER TABLE public.llm_usage OWNER TO digitaltwin_user;

--
-- Name: TABLE llm_usage; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TABLE public.llm_usage IS 'Tracks all LLM API calls for cost monitoring and analytics';


--
-- Name: COLUMN llm_usage.cost_usd; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.llm_usage.cost_usd IS 'Estimated cost in USD based on provider pricing';


--
-- Name: llm_cost_analytics; Type: VIEW; Schema: public; Owner: digitaltwin_user
--

CREATE VIEW public.llm_cost_analytics AS
 SELECT date_trunc('day'::text, created_at) AS date,
    provider,
    model,
    operation,
    count(*) AS request_count,
    sum(prompt_tokens) AS total_prompt_tokens,
    sum(completion_tokens) AS total_completion_tokens,
    sum(total_tokens) AS total_tokens,
    sum(cost_usd) AS total_cost_usd,
    avg(cost_usd) AS avg_cost_per_request
   FROM public.llm_usage
  GROUP BY (date_trunc('day'::text, created_at)), provider, model, operation
  ORDER BY (date_trunc('day'::text, created_at)) DESC, (sum(cost_usd)) DESC;


ALTER VIEW public.llm_cost_analytics OWNER TO digitaltwin_user;

--
-- Name: VIEW llm_cost_analytics; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON VIEW public.llm_cost_analytics IS 'Daily cost analytics aggregated by provider, model, and operation';


--
-- Name: users; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.users (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255),
    full_name character varying(255) NOT NULL,
    role public.user_role DEFAULT 'kb_owner'::public.user_role NOT NULL,
    oauth_provider character varying(50),
    oauth_id character varying(255),
    avatar_url character varying(500),
    is_active boolean DEFAULT true,
    email_verified boolean DEFAULT false,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.users OWNER TO digitaltwin_user;

--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON TABLE public.users IS 'Users table: must have either (email + password_hash) OR (oauth_provider + oauth_id)';


--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.users.password_hash IS 'Bcrypt password hash - NULL for OAuth users';


--
-- Name: COLUMN users.oauth_provider; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.users.oauth_provider IS 'OAuth provider name (google, github, etc.) or NULL for email/password auth';


--
-- Name: COLUMN users.oauth_id; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.users.oauth_id IS 'Unique user ID from OAuth provider';


--
-- Name: COLUMN users.avatar_url; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.users.avatar_url IS 'User avatar URL (from OAuth or custom upload)';


--
-- Name: llm_user_costs; Type: VIEW; Schema: public; Owner: digitaltwin_user
--

CREATE VIEW public.llm_user_costs AS
 SELECT u.id AS user_id,
    u.email,
    kb.id AS kb_id,
    kb.name AS kb_name,
    date_trunc('month'::text, lu.created_at) AS month,
    lu.provider,
    count(*) AS request_count,
    sum(lu.total_tokens) AS total_tokens,
    sum(lu.cost_usd) AS total_cost_usd
   FROM ((public.llm_usage lu
     LEFT JOIN public.users u ON ((lu.user_id = u.id)))
     LEFT JOIN public.knowledge_bases kb ON ((lu.kb_id = kb.id)))
  GROUP BY u.id, u.email, kb.id, kb.name, (date_trunc('month'::text, lu.created_at)), lu.provider
  ORDER BY (date_trunc('month'::text, lu.created_at)) DESC, (sum(lu.cost_usd)) DESC;


ALTER VIEW public.llm_user_costs OWNER TO digitaltwin_user;

--
-- Name: VIEW llm_user_costs; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON VIEW public.llm_user_costs IS 'Monthly cost analytics per user and knowledge base';


--
-- Name: messages; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.messages (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    conversation_id uuid NOT NULL,
    sender public.message_sender NOT NULL,
    content text NOT NULL,
    metadata jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.messages OWNER TO digitaltwin_user;

--
-- Name: COLUMN messages.sender; Type: COMMENT; Schema: public; Owner: digitaltwin_user
--

COMMENT ON COLUMN public.messages.sender IS 'Who sent this message (user or assistant)';


--
-- Name: subscriptions; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.subscriptions (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    tier public.subscription_tier DEFAULT 'free'::public.subscription_tier NOT NULL,
    stripe_customer_id character varying(255),
    stripe_subscription_id character varying(255),
    monthly_message_limit integer,
    messages_used_this_month integer DEFAULT 0,
    current_period_start timestamp without time zone,
    current_period_end timestamp without time zone,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.subscriptions OWNER TO digitaltwin_user;

--
-- Name: vector_store; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.vector_store (
    id uuid NOT NULL,
    namespace text DEFAULT 'default'::text NOT NULL,
    vector public.vector(1536) NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.vector_store OWNER TO digitaltwin_user;

--
-- Name: web_scrape_runs; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.web_scrape_runs (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    source_id uuid NOT NULL,
    started_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamp without time zone,
    status character varying(50) NOT NULL,
    trigger_type character varying(50) DEFAULT 'manual'::character varying,
    pages_processed integer DEFAULT 0,
    entries_added integer DEFAULT 0,
    error text,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP
);


ALTER TABLE public.web_scrape_runs OWNER TO digitaltwin_user;

--
-- Name: web_sources; Type: TABLE; Schema: public; Owner: digitaltwin_user
--

CREATE TABLE public.web_sources (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    kb_id uuid NOT NULL,
    name character varying(255) NOT NULL,
    base_url text NOT NULL,
    scrape_strategy character varying(50) DEFAULT 'single_page'::character varying,
    crawl_depth integer DEFAULT 1,
    max_pages integer DEFAULT 20,
    auto_refresh_enabled boolean DEFAULT false,
    schedule_frequency_hours integer DEFAULT 24,
    include_paths text[] DEFAULT ARRAY[]::text[],
    exclude_paths text[] DEFAULT ARRAY[]::text[],
    config jsonb DEFAULT '{}'::jsonb,
    last_run_at timestamp without time zone,
    next_run_at timestamp without time zone,
    last_status character varying(50) DEFAULT 'idle'::character varying,
    last_error text,
    is_active boolean DEFAULT true,
    created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT web_sources_crawl_depth_check CHECK (((crawl_depth >= 1) AND (crawl_depth <= 5))),
    CONSTRAINT web_sources_max_pages_check CHECK (((max_pages >= 1) AND (max_pages <= 500))),
    CONSTRAINT web_sources_schedule_frequency_hours_check CHECK (((schedule_frequency_hours >= 1) AND (schedule_frequency_hours <= 168))),
    CONSTRAINT web_sources_scrape_strategy_check CHECK (((scrape_strategy)::text = ANY ((ARRAY['single_page'::character varying, 'crawl'::character varying])::text[])))
);


ALTER TABLE public.web_sources OWNER TO digitaltwin_user;

--
-- Data for Name: analytics_events; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.analytics_events (id, kb_id, event_type, event_data, created_at) FROM stdin;
00cc2d46-24fe-44f4-aee1-c8723ffe6b53	6091a50f-0ed0-479c-a002-2be37108952a	conversation_started	{"conversation_id": "d0d96381-6ff6-4ff0-89ca-1c3992332e24"}	2025-12-30 16:35:36.789283
578b9760-a076-47ac-8655-5250128d1d4c	6091a50f-0ed0-479c-a002-2be37108952a	conversation_started	{"conversation_id": "592e113d-7d1c-45d3-b453-31257da7e398"}	2025-12-30 16:36:45.517947
\.


--
-- Data for Name: benchmark_ab_tests; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.benchmark_ab_tests (id, kb_id, name, description, config_a, config_b, config_a_name, config_b_name, run_a_id, run_b_id, dataset_id, status, winner, statistical_significance, comparison_results, created_at, completed_at) FROM stdin;
\.


--
-- Data for Name: benchmark_datasets; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.benchmark_datasets (id, kb_id, name, description, dataset_type, is_active, total_questions, generation_config, tags, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: benchmark_questions; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.benchmark_questions (id, dataset_id, question, expected_answer, expected_context_ids, question_type, difficulty, source_type, source_kb_id, tags, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: benchmark_results; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.benchmark_results (id, run_id, question_id, input_question, enhanced_query, retrieved_context_ids, retrieved_context, generated_answer, llm_provider, llm_model, query_enhancement_ms, vector_search_ms, bm25_search_ms, fusion_ms, reranking_ms, generation_ms, total_latency_ms, prompt_tokens, completion_tokens, embedding_tokens, metrics, human_rating, human_feedback, evaluated_by, evaluated_at, created_at) FROM stdin;
\.


--
-- Data for Name: benchmark_runs; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.benchmark_runs (id, kb_id, dataset_id, name, description, run_type, rag_config, comparison_run_id, status, progress, started_at, completed_at, error_message, aggregate_metrics, total_llm_tokens, total_embedding_tokens, estimated_cost_usd, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: conversations; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.conversations (id, kb_id, end_user_id, status, closed_at, summary, metadata, created_at, updated_at) FROM stdin;
d0d96381-6ff6-4ff0-89ca-1c3992332e24	6091a50f-0ed0-479c-a002-2be37108952a	116b8bf6-5704-46bd-90b0-bc6ee6bd356a	active	\N	\N	{}	2025-12-30 16:35:36.785487	2025-12-30 16:35:36.785487
592e113d-7d1c-45d3-b453-31257da7e398	6091a50f-0ed0-479c-a002-2be37108952a	9948d6b3-5d1c-45e1-8c8b-99c1827152e9	active	\N	\N	{}	2025-12-30 16:36:45.514251	2025-12-30 16:36:45.514251
\.


--
-- Data for Name: document_processing_jobs; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.document_processing_jobs (id, kb_id, file_name, status, result, created_at, updated_at, completed_at) FROM stdin;
\.


--
-- Data for Name: email_credentials; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.email_credentials (id, user_id, provider, email_address, encrypted_access_token, encrypted_refresh_token, token_expires_at, imap_host, imap_port, encrypted_imap_password, auto_sync_enabled, sync_frequency_hours, last_sync_at, last_sync_status, last_sync_error, months_to_import, max_emails_limit, current_email_count, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_knowledge; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.email_knowledge (id, user_id, credential_id, email_id, thread_id, subject, sender_email, sender_name, recipients, cc_recipients, sent_at, body_text, body_html, is_reply, in_reply_to, has_attachments, attachment_count, attachments_metadata, labels, is_important, is_starred, embedding, has_sensitive_data, redacted_fields, search_weight, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: email_sync_history; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.email_sync_history (id, credential_id, sync_type, started_at, completed_at, status, emails_processed, emails_added, emails_skipped, emails_failed, error_message, error_details, created_at) FROM stdin;
\.


--
-- Data for Name: end_users; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.end_users (id, email, name, phone, metadata, created_at, updated_at) FROM stdin;
116b8bf6-5704-46bd-90b0-bc6ee6bd356a	\N	Anonymous	\N	{}	2025-12-30 16:35:36.776961	2025-12-30 16:35:36.776961
9948d6b3-5d1c-45e1-8c8b-99c1827152e9	\N	Anonymous	\N	{}	2025-12-30 16:36:45.506356	2025-12-30 16:36:45.506356
\.


--
-- Data for Name: knowledge_base; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.knowledge_base (id, kb_id, title, content, content_type, source_url, metadata, embedding, file_name, file_size, file_type, chunk_index, total_chunks, parent_entry_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: knowledge_bases; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.knowledge_bases (id, user_id, name, description, avatar_url, purpose, purpose_config, llm_provider, llm_model, system_prompt, temperature, max_tokens, rag_config, semantic_search_threshold, semantic_search_max_results, auto_responses_enabled, is_public, share_url, is_active, created_at, updated_at) FROM stdin;
6091a50f-0ed0-479c-a002-2be37108952a	bc73f569-6f79-432d-9a40-72e725a2adf0	sdfadsf	\N	\N	\N	{}	openai	gpt-5-mini	You are sdfadsf, adsfdsf. \n\nCommunication Style: \n\nProvide helpful and accurate responses based on the knowledge base.	0.70	1000	{}	0.80	3	t	f	\N	t	2025-12-30 16:16:15.979654	2025-12-30 16:16:15.979654
\.


--
-- Data for Name: llm_usage; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.llm_usage (id, user_id, kb_id, provider, model, operation, prompt_tokens, completion_tokens, total_tokens, cost_usd, metadata, created_at) FROM stdin;
\.


--
-- Data for Name: messages; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.messages (id, conversation_id, sender, content, metadata, created_at) FROM stdin;
5ffe0192-4f83-4360-b403-b8b45595a7ea	d0d96381-6ff6-4ff0-89ca-1c3992332e24	user	ciao	\N	2025-12-30 16:35:38.832606
7d250499-9481-475f-bdf8-7943cab283e7	592e113d-7d1c-45d3-b453-31257da7e398	user	ciao	\N	2025-12-30 16:36:47.42265
\.


--
-- Data for Name: subscriptions; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.subscriptions (id, user_id, tier, stripe_customer_id, stripe_subscription_id, monthly_message_limit, messages_used_this_month, current_period_start, current_period_end, is_active, created_at, updated_at) FROM stdin;
3b788ae7-d464-4987-b193-bda0d96afd65	bc73f569-6f79-432d-9a40-72e725a2adf0	free	\N	\N	100	0	2025-12-30 16:14:44.418813	2026-01-29 16:14:44.418813	t	2025-12-30 16:14:44.418813	2025-12-30 16:14:44.418813
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.users (id, email, password_hash, full_name, role, oauth_provider, oauth_id, avatar_url, is_active, email_verified, created_at, updated_at) FROM stdin;
bc73f569-6f79-432d-9a40-72e725a2adf0	mirkopuliafito@gmail.com	$2b$10$FsiEdVh1aJI4c76vNYK.X.MUSoUWqK3syuvrm1Gs9LNci5qJsPWJy	Mirko	kb_owner	\N	\N	\N	t	f	2025-12-30 16:14:44.412561	2025-12-30 16:14:44.412561
\.


--
-- Data for Name: vector_store; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.vector_store (id, namespace, vector, metadata, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: web_scrape_runs; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.web_scrape_runs (id, source_id, started_at, completed_at, status, trigger_type, pages_processed, entries_added, error, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: web_sources; Type: TABLE DATA; Schema: public; Owner: digitaltwin_user
--

COPY public.web_sources (id, kb_id, name, base_url, scrape_strategy, crawl_depth, max_pages, auto_refresh_enabled, schedule_frequency_hours, include_paths, exclude_paths, config, last_run_at, next_run_at, last_status, last_error, is_active, created_at, updated_at) FROM stdin;
\.


--
-- Name: analytics_events analytics_events_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_pkey PRIMARY KEY (id);


--
-- Name: benchmark_ab_tests benchmark_ab_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_ab_tests
    ADD CONSTRAINT benchmark_ab_tests_pkey PRIMARY KEY (id);


--
-- Name: benchmark_datasets benchmark_datasets_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_datasets
    ADD CONSTRAINT benchmark_datasets_pkey PRIMARY KEY (id);


--
-- Name: benchmark_questions benchmark_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_questions
    ADD CONSTRAINT benchmark_questions_pkey PRIMARY KEY (id);


--
-- Name: benchmark_results benchmark_results_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_results
    ADD CONSTRAINT benchmark_results_pkey PRIMARY KEY (id);


--
-- Name: benchmark_runs benchmark_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_runs
    ADD CONSTRAINT benchmark_runs_pkey PRIMARY KEY (id);


--
-- Name: conversations conversations_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_pkey PRIMARY KEY (id);


--
-- Name: document_processing_jobs document_processing_jobs_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.document_processing_jobs
    ADD CONSTRAINT document_processing_jobs_pkey PRIMARY KEY (id);


--
-- Name: email_credentials email_credentials_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_credentials
    ADD CONSTRAINT email_credentials_pkey PRIMARY KEY (id);


--
-- Name: email_credentials email_credentials_user_id_email_address_key; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_credentials
    ADD CONSTRAINT email_credentials_user_id_email_address_key UNIQUE (user_id, email_address);


--
-- Name: email_knowledge email_knowledge_credential_id_email_id_key; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_knowledge
    ADD CONSTRAINT email_knowledge_credential_id_email_id_key UNIQUE (credential_id, email_id);


--
-- Name: email_knowledge email_knowledge_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_knowledge
    ADD CONSTRAINT email_knowledge_pkey PRIMARY KEY (id);


--
-- Name: email_sync_history email_sync_history_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_sync_history
    ADD CONSTRAINT email_sync_history_pkey PRIMARY KEY (id);


--
-- Name: end_users end_users_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.end_users
    ADD CONSTRAINT end_users_pkey PRIMARY KEY (id);


--
-- Name: knowledge_base knowledge_base_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_pkey PRIMARY KEY (id);


--
-- Name: knowledge_bases knowledge_bases_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_pkey PRIMARY KEY (id);


--
-- Name: knowledge_bases knowledge_bases_share_url_key; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_share_url_key UNIQUE (share_url);


--
-- Name: knowledge_bases knowledge_bases_user_id_key; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_user_id_key UNIQUE (user_id);


--
-- Name: llm_usage llm_usage_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_pkey PRIMARY KEY (id);


--
-- Name: messages messages_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_pkey PRIMARY KEY (id);


--
-- Name: subscriptions subscriptions_user_id_key; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: vector_store vector_store_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.vector_store
    ADD CONSTRAINT vector_store_pkey PRIMARY KEY (id);


--
-- Name: web_scrape_runs web_scrape_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.web_scrape_runs
    ADD CONSTRAINT web_scrape_runs_pkey PRIMARY KEY (id);


--
-- Name: web_sources web_sources_pkey; Type: CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.web_sources
    ADD CONSTRAINT web_sources_pkey PRIMARY KEY (id);


--
-- Name: idx_analytics_events_created_at; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_analytics_events_created_at ON public.analytics_events USING btree (created_at);


--
-- Name: idx_analytics_events_kb_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_analytics_events_kb_id ON public.analytics_events USING btree (kb_id);


--
-- Name: idx_benchmark_ab_tests_kb; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_ab_tests_kb ON public.benchmark_ab_tests USING btree (kb_id);


--
-- Name: idx_benchmark_ab_tests_status; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_ab_tests_status ON public.benchmark_ab_tests USING btree (status);


--
-- Name: idx_benchmark_datasets_active; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_datasets_active ON public.benchmark_datasets USING btree (is_active);


--
-- Name: idx_benchmark_datasets_kb; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_datasets_kb ON public.benchmark_datasets USING btree (kb_id);


--
-- Name: idx_benchmark_questions_active; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_questions_active ON public.benchmark_questions USING btree (is_active);


--
-- Name: idx_benchmark_questions_dataset; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_questions_dataset ON public.benchmark_questions USING btree (dataset_id);


--
-- Name: idx_benchmark_results_question; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_results_question ON public.benchmark_results USING btree (question_id);


--
-- Name: idx_benchmark_results_run; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_results_run ON public.benchmark_results USING btree (run_id);


--
-- Name: idx_benchmark_runs_dataset; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_runs_dataset ON public.benchmark_runs USING btree (dataset_id);


--
-- Name: idx_benchmark_runs_kb; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_runs_kb ON public.benchmark_runs USING btree (kb_id);


--
-- Name: idx_benchmark_runs_status; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_benchmark_runs_status ON public.benchmark_runs USING btree (status);


--
-- Name: idx_conversations_kb_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_conversations_kb_id ON public.conversations USING btree (kb_id);


--
-- Name: idx_conversations_status; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_conversations_status ON public.conversations USING btree (status);


--
-- Name: idx_doc_jobs_kb_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_doc_jobs_kb_id ON public.document_processing_jobs USING btree (kb_id);


--
-- Name: idx_doc_jobs_status; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_doc_jobs_status ON public.document_processing_jobs USING btree (status);


--
-- Name: idx_email_credentials_auto_sync; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_credentials_auto_sync ON public.email_credentials USING btree (auto_sync_enabled, last_sync_at) WHERE (auto_sync_enabled = true);


--
-- Name: idx_email_credentials_provider; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_credentials_provider ON public.email_credentials USING btree (provider);


--
-- Name: idx_email_credentials_user_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_credentials_user_id ON public.email_credentials USING btree (user_id);


--
-- Name: idx_email_knowledge_credential_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_credential_id ON public.email_knowledge USING btree (credential_id);


--
-- Name: idx_email_knowledge_embedding; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_embedding ON public.email_knowledge USING ivfflat (embedding public.vector_cosine_ops) WITH (lists='100');


--
-- Name: idx_email_knowledge_has_attachments; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_has_attachments ON public.email_knowledge USING btree (has_attachments) WHERE (has_attachments = true);


--
-- Name: idx_email_knowledge_sender; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_sender ON public.email_knowledge USING btree (sender_email);


--
-- Name: idx_email_knowledge_sent_at; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_sent_at ON public.email_knowledge USING btree (sent_at DESC);


--
-- Name: idx_email_knowledge_thread_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_thread_id ON public.email_knowledge USING btree (thread_id);


--
-- Name: idx_email_knowledge_user_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_user_id ON public.email_knowledge USING btree (user_id);


--
-- Name: idx_email_knowledge_user_sent; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_knowledge_user_sent ON public.email_knowledge USING btree (user_id, sent_at DESC);


--
-- Name: idx_email_sync_history_credential; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_sync_history_credential ON public.email_sync_history USING btree (credential_id, started_at DESC);


--
-- Name: idx_email_sync_history_status; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_email_sync_history_status ON public.email_sync_history USING btree (status, started_at DESC);


--
-- Name: idx_knowledge_base_chunks; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_base_chunks ON public.knowledge_base USING btree (kb_id, parent_entry_id, chunk_index);


--
-- Name: idx_knowledge_base_embedding; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_base_embedding ON public.knowledge_base USING ivfflat (embedding public.vector_cosine_ops);


--
-- Name: idx_knowledge_base_kb_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_base_kb_id ON public.knowledge_base USING btree (kb_id);


--
-- Name: idx_knowledge_base_parent_entry; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_base_parent_entry ON public.knowledge_base USING btree (parent_entry_id);


--
-- Name: idx_knowledge_bases_is_public; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_bases_is_public ON public.knowledge_bases USING btree (is_public) WHERE (is_public = true);


--
-- Name: idx_knowledge_bases_purpose_config; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_bases_purpose_config ON public.knowledge_bases USING gin (purpose_config);


--
-- Name: idx_knowledge_bases_rag_config; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_bases_rag_config ON public.knowledge_bases USING gin (rag_config);


--
-- Name: idx_knowledge_bases_semantic_config; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_bases_semantic_config ON public.knowledge_bases USING btree (semantic_search_threshold, semantic_search_max_results) WHERE (semantic_search_threshold IS NOT NULL);


--
-- Name: idx_knowledge_bases_share_url; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_bases_share_url ON public.knowledge_bases USING btree (share_url) WHERE (share_url IS NOT NULL);


--
-- Name: idx_knowledge_bases_user_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_knowledge_bases_user_id ON public.knowledge_bases USING btree (user_id);


--
-- Name: idx_llm_usage_cost; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_llm_usage_cost ON public.llm_usage USING btree (cost_usd);


--
-- Name: idx_llm_usage_created_at; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_llm_usage_created_at ON public.llm_usage USING btree (created_at);


--
-- Name: idx_llm_usage_kb_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_llm_usage_kb_id ON public.llm_usage USING btree (kb_id);


--
-- Name: idx_llm_usage_provider; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_llm_usage_provider ON public.llm_usage USING btree (provider);


--
-- Name: idx_llm_usage_user_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_llm_usage_user_id ON public.llm_usage USING btree (user_id);


--
-- Name: idx_messages_conversation_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_messages_conversation_id ON public.messages USING btree (conversation_id);


--
-- Name: idx_messages_created_at; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_messages_created_at ON public.messages USING btree (created_at);


--
-- Name: idx_subscriptions_user_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);


--
-- Name: idx_users_avatar_url; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_users_avatar_url ON public.users USING btree (avatar_url) WHERE (avatar_url IS NOT NULL);


--
-- Name: idx_users_email; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_users_email ON public.users USING btree (email);


--
-- Name: idx_users_oauth; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE UNIQUE INDEX idx_users_oauth ON public.users USING btree (oauth_provider, oauth_id) WHERE ((oauth_provider IS NOT NULL) AND (oauth_id IS NOT NULL));


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_vector_store_namespace; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_vector_store_namespace ON public.vector_store USING btree (namespace);


--
-- Name: idx_vector_store_updated_at; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_vector_store_updated_at ON public.vector_store USING btree (updated_at);


--
-- Name: idx_web_scrape_runs_source; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_web_scrape_runs_source ON public.web_scrape_runs USING btree (source_id, started_at DESC);


--
-- Name: idx_web_sources_kb_id; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_web_sources_kb_id ON public.web_sources USING btree (kb_id);


--
-- Name: idx_web_sources_next_run; Type: INDEX; Schema: public; Owner: digitaltwin_user
--

CREATE INDEX idx_web_sources_next_run ON public.web_sources USING btree (auto_refresh_enabled, next_run_at) WHERE (auto_refresh_enabled = true);


--
-- Name: email_knowledge enforce_email_limit; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER enforce_email_limit BEFORE INSERT ON public.email_knowledge FOR EACH ROW EXECUTE FUNCTION public.check_email_limit();


--
-- Name: benchmark_datasets update_benchmark_datasets_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_benchmark_datasets_updated_at BEFORE UPDATE ON public.benchmark_datasets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: benchmark_questions update_benchmark_questions_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_benchmark_questions_updated_at BEFORE UPDATE ON public.benchmark_questions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: benchmark_runs update_benchmark_runs_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_benchmark_runs_updated_at BEFORE UPDATE ON public.benchmark_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: conversations update_conversations_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_knowledge update_credential_email_count; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_credential_email_count AFTER INSERT OR DELETE ON public.email_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_email_count();


--
-- Name: document_processing_jobs update_document_processing_jobs_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_document_processing_jobs_updated_at BEFORE UPDATE ON public.document_processing_jobs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_credentials update_email_credentials_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_email_credentials_updated_at BEFORE UPDATE ON public.email_credentials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: email_knowledge update_email_knowledge_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_email_knowledge_updated_at BEFORE UPDATE ON public.email_knowledge FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: end_users update_end_users_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_end_users_updated_at BEFORE UPDATE ON public.end_users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_base update_knowledge_base_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON public.knowledge_base FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: knowledge_bases update_knowledge_bases_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_knowledge_bases_updated_at BEFORE UPDATE ON public.knowledge_bases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: subscriptions update_subscriptions_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: vector_store update_vector_store_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_vector_store_updated_at BEFORE UPDATE ON public.vector_store FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: web_scrape_runs update_web_scrape_runs_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_web_scrape_runs_updated_at BEFORE UPDATE ON public.web_scrape_runs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: web_sources update_web_sources_updated_at; Type: TRIGGER; Schema: public; Owner: digitaltwin_user
--

CREATE TRIGGER update_web_sources_updated_at BEFORE UPDATE ON public.web_sources FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: analytics_events analytics_events_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.analytics_events
    ADD CONSTRAINT analytics_events_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: benchmark_ab_tests benchmark_ab_tests_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_ab_tests
    ADD CONSTRAINT benchmark_ab_tests_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.benchmark_datasets(id) ON DELETE SET NULL;


--
-- Name: benchmark_ab_tests benchmark_ab_tests_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_ab_tests
    ADD CONSTRAINT benchmark_ab_tests_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: benchmark_ab_tests benchmark_ab_tests_run_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_ab_tests
    ADD CONSTRAINT benchmark_ab_tests_run_a_id_fkey FOREIGN KEY (run_a_id) REFERENCES public.benchmark_runs(id) ON DELETE SET NULL;


--
-- Name: benchmark_ab_tests benchmark_ab_tests_run_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_ab_tests
    ADD CONSTRAINT benchmark_ab_tests_run_b_id_fkey FOREIGN KEY (run_b_id) REFERENCES public.benchmark_runs(id) ON DELETE SET NULL;


--
-- Name: benchmark_datasets benchmark_datasets_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_datasets
    ADD CONSTRAINT benchmark_datasets_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: benchmark_questions benchmark_questions_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_questions
    ADD CONSTRAINT benchmark_questions_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.benchmark_datasets(id) ON DELETE CASCADE;


--
-- Name: benchmark_questions benchmark_questions_source_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_questions
    ADD CONSTRAINT benchmark_questions_source_kb_id_fkey FOREIGN KEY (source_kb_id) REFERENCES public.knowledge_base(id) ON DELETE SET NULL;


--
-- Name: benchmark_results benchmark_results_evaluated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_results
    ADD CONSTRAINT benchmark_results_evaluated_by_fkey FOREIGN KEY (evaluated_by) REFERENCES public.users(id);


--
-- Name: benchmark_results benchmark_results_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_results
    ADD CONSTRAINT benchmark_results_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.benchmark_questions(id) ON DELETE CASCADE;


--
-- Name: benchmark_results benchmark_results_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_results
    ADD CONSTRAINT benchmark_results_run_id_fkey FOREIGN KEY (run_id) REFERENCES public.benchmark_runs(id) ON DELETE CASCADE;


--
-- Name: benchmark_runs benchmark_runs_comparison_run_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_runs
    ADD CONSTRAINT benchmark_runs_comparison_run_id_fkey FOREIGN KEY (comparison_run_id) REFERENCES public.benchmark_runs(id);


--
-- Name: benchmark_runs benchmark_runs_dataset_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_runs
    ADD CONSTRAINT benchmark_runs_dataset_id_fkey FOREIGN KEY (dataset_id) REFERENCES public.benchmark_datasets(id) ON DELETE SET NULL;


--
-- Name: benchmark_runs benchmark_runs_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.benchmark_runs
    ADD CONSTRAINT benchmark_runs_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_end_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_end_user_id_fkey FOREIGN KEY (end_user_id) REFERENCES public.end_users(id) ON DELETE CASCADE;


--
-- Name: conversations conversations_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.conversations
    ADD CONSTRAINT conversations_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: document_processing_jobs document_processing_jobs_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.document_processing_jobs
    ADD CONSTRAINT document_processing_jobs_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: email_credentials email_credentials_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_credentials
    ADD CONSTRAINT email_credentials_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_knowledge email_knowledge_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_knowledge
    ADD CONSTRAINT email_knowledge_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.email_credentials(id) ON DELETE CASCADE;


--
-- Name: email_knowledge email_knowledge_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_knowledge
    ADD CONSTRAINT email_knowledge_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: email_sync_history email_sync_history_credential_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.email_sync_history
    ADD CONSTRAINT email_sync_history_credential_id_fkey FOREIGN KEY (credential_id) REFERENCES public.email_credentials(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: knowledge_base knowledge_base_parent_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.knowledge_base
    ADD CONSTRAINT knowledge_base_parent_entry_id_fkey FOREIGN KEY (parent_entry_id) REFERENCES public.knowledge_base(id) ON DELETE CASCADE;


--
-- Name: knowledge_bases knowledge_bases_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.knowledge_bases
    ADD CONSTRAINT knowledge_bases_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: llm_usage llm_usage_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- Name: llm_usage llm_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.llm_usage
    ADD CONSTRAINT llm_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: messages messages_conversation_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.messages
    ADD CONSTRAINT messages_conversation_id_fkey FOREIGN KEY (conversation_id) REFERENCES public.conversations(id) ON DELETE CASCADE;


--
-- Name: subscriptions subscriptions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.subscriptions
    ADD CONSTRAINT subscriptions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: web_scrape_runs web_scrape_runs_source_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.web_scrape_runs
    ADD CONSTRAINT web_scrape_runs_source_id_fkey FOREIGN KEY (source_id) REFERENCES public.web_sources(id) ON DELETE CASCADE;


--
-- Name: web_sources web_sources_kb_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: digitaltwin_user
--

ALTER TABLE ONLY public.web_sources
    ADD CONSTRAINT web_sources_kb_id_fkey FOREIGN KEY (kb_id) REFERENCES public.knowledge_bases(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict rLXjIujWsUtJxPCqPGsEL2lFk4AfYbwa6IGnY31Mb7Rer7qjzHwMe4MdU2nAWgu

