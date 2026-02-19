ALTER TABLE posts ADD COLUMN reply_count INTEGER NOT NULL DEFAULT 0;

UPDATE posts p
SET reply_count = (
  SELECT COUNT(*) FROM posts a
  WHERE a.parent_id = p.id AND a.type = 'answer'
);