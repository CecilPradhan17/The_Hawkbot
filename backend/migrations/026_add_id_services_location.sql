BEGIN;

UPDATE approved_knowledge
SET cleaned_content = 'Warhawk ID Services issues ULM identification cards and replaces lost, stolen, or damaged cards at University Commons II, Room 153, 4031 Northeast Drive.',
    raw_content = 'Warhawk ID Services issues ULM identification cards and replaces lost, stolen, or damaged cards at University Commons II, Room 153, 4031 Northeast Drive.',
    embedding = NULL,
    last_verified_at = NOW(),
    review_due_at = NOW() + INTERVAL '1 year'
WHERE source_post_id IS NULL
  AND source_url = 'https://www.ulm.edu/warhawkcard/id-card-info.html'
  AND raw_content = 'Warhawk ID Services issues ULM identification cards and replaces lost, stolen, or damaged cards.';

COMMIT;
