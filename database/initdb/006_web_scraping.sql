-- Web scraping sources configuration
CREATE TABLE IF NOT EXISTS web_sources (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    twin_id UUID NOT NULL REFERENCES digital_twins(id) ON DELETE CASCADE,
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

-- Scrape run history
CREATE TABLE IF NOT EXISTS web_scrape_runs (
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

-- Indexes
CREATE INDEX IF NOT EXISTS idx_web_sources_twin_id ON web_sources(twin_id);
CREATE INDEX IF NOT EXISTS idx_web_sources_next_run ON web_sources(auto_refresh_enabled, next_run_at)
    WHERE auto_refresh_enabled = true;

CREATE INDEX IF NOT EXISTS idx_web_scrape_runs_source ON web_scrape_runs(source_id, started_at DESC);

-- Triggers
CREATE TRIGGER update_web_sources_updated_at BEFORE UPDATE ON web_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_scrape_runs_updated_at BEFORE UPDATE ON web_scrape_runs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
