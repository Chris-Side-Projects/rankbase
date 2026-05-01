-- Up Migration
-- Image of the Hour: one curated image per hour that the homepage features.
-- Populated by scripts/generate-hourly.ts running on cron once an hour.

CREATE TABLE IF NOT EXISTS hourly_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  image_id UUID NOT NULL REFERENCES images(id),
  hour_ts TIMESTAMPTZ NOT NULL UNIQUE,  -- truncated to hour
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hourly_images_hour_ts ON hourly_images(hour_ts DESC);
