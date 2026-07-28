CREATE TABLE trade_news_preferences (
  account_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  scope text NOT NULL DEFAULT 'local' CHECK (scope IN ('local', 'all')),
  location text NOT NULL DEFAULT '' CHECK (char_length(location) <= 80),
  category text NOT NULL DEFAULT 'All topics' CHECK (char_length(category) BETWEEN 1 AND 80),
  trade text NOT NULL DEFAULT 'All trades' CHECK (char_length(trade) BETWEEN 1 AND 80),
  followed_trades text[] NOT NULL DEFAULT '{}'::text[],
  followed_topics text[] NOT NULL DEFAULT '{}'::text[],
  version integer NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (cardinality(followed_trades) <= 80),
  CHECK (cardinality(followed_topics) <= 80)
);

CREATE TABLE trade_news_saved_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  canonical_url text NOT NULL CHECK (char_length(canonical_url) BETWEEN 1 AND 2048),
  article_url text NOT NULL CHECK (char_length(article_url) BETWEEN 1 AND 2048),
  headline text NOT NULL CHECK (char_length(headline) <= 400),
  source text NOT NULL CHECK (char_length(source) <= 200),
  published_at timestamptz,
  category text NOT NULL DEFAULT '' CHECK (char_length(category) <= 80),
  trades text[] NOT NULL DEFAULT '{}'::text[],
  topics text[] NOT NULL DEFAULT '{}'::text[],
  thumbnail_url text CHECK (thumbnail_url IS NULL OR char_length(thumbnail_url) <= 2048),
  saved_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, canonical_url),
  CHECK (cardinality(trades) <= 80),
  CHECK (cardinality(topics) <= 80)
);

CREATE INDEX trade_news_saved_articles_account_recent_idx
  ON trade_news_saved_articles (account_id, saved_at DESC, id DESC);

ALTER TABLE shop_talk_posts
  ADD COLUMN article_url text,
  ADD COLUMN article_canonical_url text,
  ADD COLUMN article_source text,
  ADD COLUMN article_published_at timestamptz,
  ADD CONSTRAINT shop_talk_posts_article_fields_check CHECK (
    (
      article_url IS NULL
      AND article_canonical_url IS NULL
      AND article_source IS NULL
      AND article_published_at IS NULL
    )
    OR (
      article_url IS NOT NULL
      AND article_canonical_url IS NOT NULL
      AND article_source IS NOT NULL
      AND char_length(article_url) BETWEEN 1 AND 2048
      AND char_length(article_canonical_url) BETWEEN 1 AND 2048
      AND char_length(article_source) BETWEEN 1 AND 200
    )
  );

CREATE UNIQUE INDEX shop_talk_posts_active_article_discussion_idx
  ON shop_talk_posts (article_canonical_url)
  WHERE article_canonical_url IS NOT NULL
    AND moderation_status <> 'hidden';
