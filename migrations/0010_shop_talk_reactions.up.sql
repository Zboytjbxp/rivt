CREATE TABLE shop_talk_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'answer')),
  target_key text NOT NULL CHECK (
    char_length(target_key) BETWEEN 1 AND 180
    AND target_key ~ '^[A-Za-z0-9:_-]+$'
  ),
  reaction text NOT NULL CHECK (reaction IN ('up', 'down')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (actor_account_id, target_type, target_key)
);

CREATE INDEX shop_talk_reactions_target_idx
  ON shop_talk_reactions (target_type, target_key, reaction, updated_at DESC, id DESC);

CREATE INDEX shop_talk_reactions_actor_idx
  ON shop_talk_reactions (actor_account_id, updated_at DESC, id DESC);

CREATE TABLE shop_talk_reaction_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reaction_id uuid REFERENCES shop_talk_reactions(id) ON DELETE SET NULL,
  actor_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('thread', 'answer')),
  target_key text NOT NULL CHECK (
    char_length(target_key) BETWEEN 1 AND 180
    AND target_key ~ '^[A-Za-z0-9:_-]+$'
  ),
  event_type text NOT NULL CHECK (event_type IN ('set_up', 'set_down', 'cleared')),
  previous_reaction text CHECK (previous_reaction IN ('up', 'down')),
  next_reaction text CHECK (next_reaction IN ('up', 'down')),
  request_id uuid,
  occurred_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shop_talk_reaction_events_actor_idx
  ON shop_talk_reaction_events (actor_account_id, occurred_at DESC, id DESC);

CREATE INDEX shop_talk_reaction_events_target_idx
  ON shop_talk_reaction_events (target_type, target_key, occurred_at DESC, id DESC);

CREATE TRIGGER shop_talk_reaction_events_no_update
  BEFORE UPDATE OR DELETE ON shop_talk_reaction_events
  FOR EACH ROW EXECUTE FUNCTION prevent_audit_event_mutation();
