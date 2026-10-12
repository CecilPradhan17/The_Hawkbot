ALTER TABLE knowledge_admin_actions
  DROP CONSTRAINT knowledge_admin_actions_action_check;

ALTER TABLE knowledge_admin_actions
  DROP CONSTRAINT knowledge_admin_actions_check;

ALTER TABLE knowledge_admin_actions
  ADD CONSTRAINT knowledge_admin_actions_action_check
  CHECK (action IN ('created', 'corrected', 'archived'));

ALTER TABLE knowledge_admin_actions
  ADD CONSTRAINT knowledge_admin_actions_replacement_check
  CHECK (
    (action = 'created' AND replacement_knowledge_id IS NULL)
    OR (action = 'corrected' AND replacement_knowledge_id IS NOT NULL)
    OR (action = 'archived' AND replacement_knowledge_id IS NULL)
  );
