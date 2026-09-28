ALTER TABLE posts
  DROP CONSTRAINT IF EXISTS content_length_check;

ALTER TABLE posts
  ADD CONSTRAINT content_length_check
  CHECK (
    char_length(content) > 0
    AND (
      (type = 'verification' AND char_length(content) <= 1000)
      OR (type <> 'verification' AND char_length(content) <= 250)
    )
  );
