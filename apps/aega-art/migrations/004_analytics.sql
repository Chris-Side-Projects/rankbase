-- Up Migration
-- Analytics foundation: extended image metadata, taste-graph nodes/edges,
-- tag co-occurrence, and a generic event log.

-- Extended image metadata for analytics + multi-model description pipeline.
ALTER TABLE images ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS description_models TEXT[] DEFAULT '{}';
ALTER TABLE images ADD COLUMN IF NOT EXISTS aesthetic_score FLOAT;
ALTER TABLE images ADD COLUMN IF NOT EXISTS style_tags TEXT[] DEFAULT '{}';
ALTER TABLE images ADD COLUMN IF NOT EXISTS subject_tags TEXT[] DEFAULT '{}';
ALTER TABLE images ADD COLUMN IF NOT EXISTS mood_tags TEXT[] DEFAULT '{}';

-- Taste profiles: one row per anonymous voter session.
CREATE TABLE IF NOT EXISTS taste_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL UNIQUE,
  vote_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Taste edges: weighted similarity between profile pairs.
CREATE TABLE IF NOT EXISTS taste_edges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_a UUID REFERENCES taste_profiles(id),
  profile_b UUID REFERENCES taste_profiles(id),
  weight FLOAT DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(profile_a, profile_b)
);

-- Tag co-occurrence counts. Each undirected pair stored once with
-- tag_a < tag_b lexicographically (enforced by callers).
CREATE TABLE IF NOT EXISTS tag_cooccurrence (
  tag_a TEXT NOT NULL,
  tag_b TEXT NOT NULL,
  count INT DEFAULT 0,
  PRIMARY KEY (tag_a, tag_b)
);

-- Generic event log. Used for vote / view / generate / skip telemetry.
CREATE TABLE IF NOT EXISTS analytics_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  event_type TEXT NOT NULL,
  image_id UUID REFERENCES images(id),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_session ON analytics_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON analytics_events(created_at DESC);
