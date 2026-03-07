ALTER TABLE posts
ADD CONSTRAINT content_length_check 
CHECK (char_length(content) <= 250 AND char_length(content) > 0);