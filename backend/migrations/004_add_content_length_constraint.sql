-- UP (apply the change)
ALTER TABLE posts 
ADD CONSTRAINT content_length_check 
CHECK (char_length(content) <= 500 AND char_length(content) > 0);

-- DOWN (remove the constraint)
-- ALTER TABLE posts 
-- DROP CONSTRAINT IF EXISTS content_length_check;