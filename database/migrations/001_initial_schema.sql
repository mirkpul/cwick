-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgvector extension for vector embeddings
CREATE EXTENSION IF NOT EXISTS vector;

-- User roles enum
CREATE TYPE user_role AS ENUM ('super_admin', 'professional', 'end_user');

-- Subscription tiers enum
CREATE TYPE subscription_tier AS ENUM ('free', 'basic', 'pro', 'enterprise');

-- LLM providers enum
CREATE TYPE llm_provider AS ENUM ('openai', 'anthropic', 'ollama', 'custom');

-- Conversation status enum
CREATE TYPE conversation_status AS ENUM ('active', 'handed_over', 'closed');

-- Message sender type enum
CREATE TYPE message_sender AS ENUM ('user', 'twin', 'professional');

-- Users table (professionals and admins)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role user_role NOT NULL DEFAULT 'professional',
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

-- Digital Twins table
CREATE TABLE digital_twins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    profession VARCHAR(255) NOT NULL,
    bio TEXT,
    avatar_url VARCHAR(500),

    -- AI Configuration
    llm_provider llm_provider NOT NULL DEFAULT 'openai',
    llm_model VARCHAR(100),
    system_prompt TEXT,
    temperature DECIMAL(3,2) DEFAULT 0.7,
    max_tokens INTEGER DEFAULT 1000,

    -- Personality & Tone
    personality_traits JSONB,
    communication_style TEXT,

    -- Capabilities
    capabilities JSONB, -- {q_and_a: true, scheduling: true, consultation: true}

    -- Business Info
    services JSONB, -- Array of services offered
    pricing_info JSONB,
    availability_schedule JSONB,

    -- Settings
    handover_threshold DECIMAL(3,2) DEFAULT 0.5, -- Confidence threshold for handover
    auto_responses_enabled BOOLEAN DEFAULT true,

    -- Semantic search configuration
    semantic_search_threshold DECIMAL(3,2) DEFAULT 0.80
        CHECK (semantic_search_threshold >= 0 AND semantic_search_threshold <= 1),
    semantic_search_max_results INTEGER DEFAULT 3
        CHECK (semantic_search_max_results > 0 AND semantic_search_max_results <= 10),

    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id)
);

-- Knowledge Base table
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(50), -- 'faq', 'document', 'manual_entry', 'url'
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

-- End Users table (people who chat with digital twins)
CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255),
    name VARCHAR(255),
    phone VARCHAR(50),
    metadata JSONB, -- Additional contact info
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Conversations table
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
    end_user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,
    status conversation_status DEFAULT 'active',
    handed_over_at TIMESTAMP,
    closed_at TIMESTAMP,
    summary TEXT,
    metadata JSONB, -- Session info, source channel, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender message_sender NOT NULL,
    content TEXT NOT NULL,
    metadata JSONB, -- LLM response metadata, confidence scores, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Handover Notifications table
CREATE TABLE handover_notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason TEXT,
    is_read BOOLEAN DEFAULT false,
    is_accepted BOOLEAN DEFAULT false,
    accepted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Analytics Events table
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twin_id UUID REFERENCES digital_twins(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- 'message_sent', 'handover_triggered', 'conversation_started', etc.
    event_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_digital_twins_user_id ON digital_twins(user_id);
CREATE INDEX idx_knowledge_base_twin_id ON knowledge_base(twin_id);
CREATE INDEX idx_conversations_twin_id ON conversations(twin_id);
CREATE INDEX idx_conversations_status ON conversations(status);
CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_handover_notifications_user_id ON handover_notifications(user_id);
CREATE INDEX idx_handover_notifications_is_read ON handover_notifications(is_read);
CREATE INDEX idx_analytics_events_twin_id ON analytics_events(twin_id);
CREATE INDEX idx_analytics_events_created_at ON analytics_events(created_at);

-- Indexes for file upload and semantic search
CREATE INDEX idx_knowledge_base_parent_entry ON knowledge_base(parent_entry_id);
CREATE INDEX idx_knowledge_base_chunks ON knowledge_base(twin_id, parent_entry_id, chunk_index);
CREATE INDEX idx_knowledge_base_embedding ON knowledge_base USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_digital_twins_semantic_config ON digital_twins(semantic_search_threshold, semantic_search_max_results)
    WHERE semantic_search_threshold IS NOT NULL;

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_digital_twins_updated_at BEFORE UPDATE ON digital_twins
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_end_users_updated_at BEFORE UPDATE ON end_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
