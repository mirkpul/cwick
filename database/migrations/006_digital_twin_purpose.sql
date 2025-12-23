-- Add purpose and purpose_config to digital_twins
ALTER TABLE digital_twins
    ADD COLUMN IF NOT EXISTS purpose TEXT,
    ADD COLUMN IF NOT EXISTS purpose_config JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_digital_twins_purpose_config
    ON digital_twins
    USING gin (purpose_config);
