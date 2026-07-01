CREATE TABLE communities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$' AND char_length(slug) BETWEEN 1 AND 60),
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description text NOT NULL DEFAULT '' CHECK (char_length(description) <= 240),
  member_count integer NOT NULL DEFAULT 0 CHECK (member_count >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX communities_member_count_idx ON communities (member_count DESC, id DESC);

CREATE TABLE community_members (
  community_id uuid NOT NULL REFERENCES communities(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (community_id, account_id)
);

CREATE INDEX community_members_account_idx ON community_members (account_id, joined_at DESC);

INSERT INTO communities (slug, name, description, member_count) VALUES
  ('carpentry-talk', 'Carpentry Talk', 'Trim, framing, punch-out', 124000),
  ('electrical-talk', 'Electrical Talk', 'Code, service, rough-in', 98000),
  ('jacksonville-trades', 'Jacksonville Trades', 'Local work and referrals', 8700),
  ('side-work', 'Side Work', 'Short-term help needed', 5200),
  ('cabinetry-talk', 'Cabinetry Talk', 'Installs, layout, scribing', 6100),
  ('tile-talk', 'Tile Talk', 'Layout, thinset, lippage', 5300),
  ('plumbing-talk', 'Plumbing Talk', 'Rough-in, service, code', 7600),
  ('remodelers', 'Remodelers', 'Whole-home coordination', 4400);
