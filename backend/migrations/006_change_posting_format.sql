ALTER TABLE posts
ADD COLUMN type TEXT,
ADD COLUMN parent_id INTEGER NULL,
ADD COLUMN approved_child_id INTEGER NULL;

ALTER TABLE posts
ADD CONSTRAINT posts_type_check
CHECK (type IN ('post', 'question', 'answer'));

ALTER TABLE posts
ADD CONSTRAINT fk_parent
FOREIGN KEY (parent_id)
REFERENCES posts(id)
ON DELETE CASCADE;

ALTER TABLE posts
ADD CONSTRAINT fk_approved_child
FOREIGN KEY (approved_child_id)
REFERENCES posts(id)
ON DELETE SET NULL;

UPDATE posts
SET type = 'post'
WHERE type IS NULL;

ALTER TABLE posts
ALTER COLUMN type SET NOT NULL;

ALTER TABLE posts
DROP COLUMN sent_to_rag;
