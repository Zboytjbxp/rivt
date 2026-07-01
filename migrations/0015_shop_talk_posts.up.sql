CREATE TABLE shop_talk_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  author_name text NOT NULL CHECK (char_length(author_name) BETWEEN 1 AND 120),
  trade text NOT NULL CHECK (char_length(trade) BETWEEN 1 AND 60),
  flair text CHECK (flair IN ('Question', 'Discussion', 'Code Talk', 'Compliance', 'Tip', 'Humor')),
  post_type text NOT NULL DEFAULT 'general' CHECK (post_type IN ('question', 'sub-request', 'safety', 'general')),
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body text NOT NULL DEFAULT '' CHECK (char_length(body) <= 4000),
  status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Verified Fix', 'Needs a pro answer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX shop_talk_posts_recent_idx
  ON shop_talk_posts (created_at DESC, id DESC);

CREATE INDEX shop_talk_posts_author_idx
  ON shop_talk_posts (author_account_id, created_at DESC, id DESC);

CREATE INDEX shop_talk_posts_trade_idx
  ON shop_talk_posts (trade, created_at DESC, id DESC);
