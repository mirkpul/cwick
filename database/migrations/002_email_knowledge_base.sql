-- Email provider enum
CREATE TYPE email_provider AS ENUM ('gmail', 'outlook', 'imap');

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
    sync_frequency_hours INTEGER DEFAULT 24, -- Default daily sync
    last_sync_at TIMESTAMP,
    last_sync_status VARCHAR(50), -- 'success', 'failed', 'in_progress'
    last_sync_error TEXT,

    -- Import scope
    months_to_import INTEGER DEFAULT 6, -- How many months back to import
    max_emails_limit INTEGER, -- Based on subscription tier
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
    email_id VARCHAR(255) NOT NULL, -- Unique ID from email provider (Message-ID or IMAP UID)
    thread_id VARCHAR(255), -- Thread/conversation ID

    -- Email metadata
    subject VARCHAR(1000) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    sender_name VARCHAR(255),
    recipients JSONB, -- Array of {email, name} objects
    cc_recipients JSONB,
    sent_at TIMESTAMP NOT NULL,

    -- Email content
    body_text TEXT NOT NULL, -- Plain text version of email body
    body_html TEXT, -- Original HTML (optional, for reference)

    -- Thread context
    is_reply BOOLEAN DEFAULT false,
    in_reply_to VARCHAR(255), -- Reference to parent email_id

    -- Attachments
    has_attachments BOOLEAN DEFAULT false,
    attachment_count INTEGER DEFAULT 0,
    attachments_metadata JSONB, -- Array of {filename, size, type, processed}

    -- Email categorization
    labels JSONB, -- Gmail labels or IMAP folders
    is_important BOOLEAN DEFAULT false,
    is_starred BOOLEAN DEFAULT false,

    -- Vector embedding for semantic search
    embedding vector(1536), -- OpenAI text-embedding-3-small dimensions

    -- Privacy & Security
    has_sensitive_data BOOLEAN DEFAULT false,
    redacted_fields JSONB, -- Track what was redacted: {credit_cards: 2, ssn: 1}

    -- Search weight configuration
    search_weight DECIMAL(3,2) DEFAULT 1.0
        CHECK (search_weight >= 0 AND search_weight <= 2.0),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    -- Ensure we don't import the same email twice
    UNIQUE(credential_id, email_id)
);

-- Email sync history table (for tracking and debugging)
CREATE TABLE email_sync_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    credential_id UUID NOT NULL REFERENCES email_credentials(id) ON DELETE CASCADE,
    sync_type VARCHAR(50) NOT NULL, -- 'initial', 'incremental', 'manual'
    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    status VARCHAR(50) NOT NULL, -- 'in_progress', 'completed', 'failed', 'partial'
    emails_processed INTEGER DEFAULT 0,
    emails_added INTEGER DEFAULT 0,
    emails_skipped INTEGER DEFAULT 0,
    emails_failed INTEGER DEFAULT 0,
    error_message TEXT,
    error_details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_email_credentials_user_id ON email_credentials(user_id);
CREATE INDEX idx_email_credentials_provider ON email_credentials(provider);
CREATE INDEX idx_email_credentials_auto_sync ON email_credentials(auto_sync_enabled, last_sync_at)
    WHERE auto_sync_enabled = true;

CREATE INDEX idx_email_knowledge_user_id ON email_knowledge(user_id);
CREATE INDEX idx_email_knowledge_credential_id ON email_knowledge(credential_id);
CREATE INDEX idx_email_knowledge_sent_at ON email_knowledge(sent_at DESC);
CREATE INDEX idx_email_knowledge_sender ON email_knowledge(sender_email);
CREATE INDEX idx_email_knowledge_thread_id ON email_knowledge(thread_id);
CREATE INDEX idx_email_knowledge_has_attachments ON email_knowledge(has_attachments)
    WHERE has_attachments = true;

-- Vector similarity search index (IVFFlat for approximate nearest neighbor)
CREATE INDEX idx_email_knowledge_embedding ON email_knowledge
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Composite index for common queries
CREATE INDEX idx_email_knowledge_user_sent ON email_knowledge(user_id, sent_at DESC);

CREATE INDEX idx_email_sync_history_credential ON email_sync_history(credential_id, started_at DESC);
CREATE INDEX idx_email_sync_history_status ON email_sync_history(status, started_at DESC);

-- Add triggers for updated_at
CREATE TRIGGER update_email_credentials_updated_at BEFORE UPDATE ON email_credentials
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_knowledge_updated_at BEFORE UPDATE ON email_knowledge
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to get email count for a user's credential
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

-- Trigger to automatically update email count
CREATE TRIGGER update_credential_email_count
    AFTER INSERT OR DELETE ON email_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION update_email_count();

-- Function to check email limit before insert
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

-- Trigger to enforce email limits
CREATE TRIGGER enforce_email_limit
    BEFORE INSERT ON email_knowledge
    FOR EACH ROW
    EXECUTE FUNCTION check_email_limit();
