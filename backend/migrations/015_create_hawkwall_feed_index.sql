CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_posts_hawkwall_feed
ON posts (created_at DESC, id DESC)
WHERE status = 'pending' AND type <> 'answer';
