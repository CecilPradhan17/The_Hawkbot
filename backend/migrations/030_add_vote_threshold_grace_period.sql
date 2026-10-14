ALTER TABLE posts
  ADD COLUMN threshold_crossed_at TIMESTAMPTZ,
  ADD COLUMN threshold_direction SMALLINT,
  ADD CONSTRAINT posts_threshold_direction_check
    CHECK (threshold_direction IS NULL OR threshold_direction IN (-1, 1)),
  ADD CONSTRAINT posts_threshold_tracking_check
    CHECK (
      (threshold_crossed_at IS NULL AND threshold_direction IS NULL)
      OR (threshold_crossed_at IS NOT NULL AND threshold_direction IS NOT NULL)
    );

CREATE INDEX idx_posts_pending_threshold_deadline
  ON posts (threshold_crossed_at)
  WHERE status = 'pending' AND threshold_crossed_at IS NOT NULL;
