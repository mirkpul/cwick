-- Migration 007: LLM Usage Tracking
-- Tracks LLM API usage for cost monitoring and analytics

CREATE TABLE IF NOT EXISTS llm_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    twin_id UUID REFERENCES digital_twins(id) ON DELETE CASCADE,
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_llm_usage_user_id ON llm_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_twin_id ON llm_usage (twin_id);
CREATE INDEX IF NOT EXISTS idx_llm_usage_provider ON llm_usage (provider);
CREATE INDEX IF NOT EXISTS idx_llm_usage_created_at ON llm_usage (created_at);
CREATE INDEX IF NOT EXISTS idx_llm_usage_cost ON llm_usage (cost_usd);

-- Create a view for cost analytics
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

-- Create a view for user/twin cost tracking
CREATE OR REPLACE VIEW llm_user_costs AS
SELECT
    u.id AS user_id,
    u.email,
    dt.id AS twin_id,
    dt.name AS twin_name,
    DATE_TRUNC('month', lu.created_at) AS month,
    lu.provider,
    COUNT(*) AS request_count,
    SUM(lu.total_tokens) AS total_tokens,
    SUM(lu.cost_usd) AS total_cost_usd
FROM llm_usage lu
LEFT JOIN users u ON lu.user_id = u.id
LEFT JOIN digital_twins dt ON lu.twin_id = dt.id
GROUP BY u.id, u.email, dt.id, dt.name, DATE_TRUNC('month', lu.created_at), lu.provider
ORDER BY month DESC, total_cost_usd DESC;

COMMENT ON TABLE llm_usage IS 'Tracks all LLM API calls for cost monitoring and analytics';
COMMENT ON COLUMN llm_usage.cost_usd IS 'Estimated cost in USD based on provider pricing';
COMMENT ON VIEW llm_cost_analytics IS 'Daily cost analytics aggregated by provider, model, and operation';
COMMENT ON VIEW llm_user_costs IS 'Monthly cost analytics per user and digital twin';
