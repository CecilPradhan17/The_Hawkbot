CREATE TABLE IF NOT EXISTS official_resources (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  url TEXT NOT NULL CHECK (url ~ '^https://'),
  response_text TEXT NOT NULL,
  requires_login BOOLEAN NOT NULL DEFAULT FALSE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  priority INTEGER NOT NULL DEFAULT 0,
  last_verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS official_resource_aliases (
  id BIGSERIAL PRIMARY KEY,
  resource_id BIGINT NOT NULL REFERENCES official_resources(id) ON DELETE CASCADE,
  normalized_alias TEXT NOT NULL CHECK (normalized_alias = LOWER(TRIM(normalized_alias))),
  UNIQUE (resource_id, normalized_alias)
);

CREATE INDEX IF NOT EXISTS idx_official_resources_active_priority
  ON official_resources (active, priority DESC);
CREATE INDEX IF NOT EXISTS idx_official_resource_aliases_alias
  ON official_resource_aliases (normalized_alias);

INSERT INTO official_resources
  (slug, name, description, url, response_text, requires_login, priority, last_verified_at)
VALUES
  ('dining-menu', 'ULM Dining menu', 'Current menus for Schulze Dining Hall.', 'https://ulm.mydininghub.com/en/location/schulze', 'You can check the current Schulze Dining Hall menu on ULM Dining''s official website.', FALSE, 100, NOW()),
  ('employee-directory', 'ULM employee directory', 'Faculty and staff profiles, departments, email addresses, phone numbers, and offices.', 'https://ulmapps.ulm.edu/search/index.php?tab=1', 'You can search for ULM faculty and staff contact information in the official employee directory.', FALSE, 90, NOW()),
  ('academic-calendar', 'ULM academic calendar', 'Official term dates, university holidays, breaks, and academic deadlines.', 'https://www.ulm.edu/academicaffairs/academiccalendar.html', 'You can find current and upcoming term dates on ULM''s official academic calendar.', FALSE, 85, NOW()),
  ('registrar', 'ULM Registrar', 'Registration, enrollment records, transcripts, diplomas, graduation, and FERPA.', 'https://www.ulm.edu/registrar/', 'The ULM Registrar''s official website has registration, transcript, graduation, enrollment-record, and FERPA resources.', FALSE, 80, NOW()),
  ('financial-aid', 'ULM Financial Aid', 'FAFSA, aid eligibility, awards, forms, deadlines, and financial-aid contacts.', 'https://www.ulm.edu/financialaid/', 'You can find FAFSA, financial-aid eligibility, forms, deadlines, and contact information on ULM Financial Aid''s official website.', FALSE, 80, NOW()),
  ('campus-map', 'ULM campus map', 'Campus buildings, locations, and an interactive university map.', 'https://www.ulm.edu/map/index.html', 'You can find campus buildings and locations on ULM''s official campus map.', FALSE, 75, NOW()),
  ('housing', 'ULM Residential Life', 'Residence halls, campus housing options, housing maps, and Residential Life contacts.', 'https://www.ulm.edu/reslife/', 'You can find residence halls, housing options, and Residential Life contacts on ULM''s official housing website.', FALSE, 70, NOW()),
  ('library', 'ULM Library', 'Library search, databases, research guides, collections, and library services.', 'https://www.ulm.edu/library/', 'You can search library resources and find research help on the official ULM Library website.', FALSE, 70, NOW()),
  ('counseling-center', 'ULM Counseling Center', 'Student counseling, appointments, crisis contacts, and mental-health resources.', 'https://www.ulm.edu/counselingcenter/', 'You can find appointments, counseling resources, and crisis contacts on the official ULM Counseling Center website.', FALSE, 70, NOW())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  response_text = EXCLUDED.response_text,
  requires_login = EXCLUDED.requires_login,
  priority = EXCLUDED.priority,
  last_verified_at = EXCLUDED.last_verified_at,
  updated_at = NOW();

INSERT INTO official_resource_aliases (resource_id, normalized_alias)
SELECT resource.id, alias.normalized_alias
FROM (VALUES
  ('dining-menu', 'dining menu'), ('dining-menu', 'schulze menu'), ('dining-menu', 'cafeteria menu'), ('dining-menu', 'food at schulze'),
  ('employee-directory', 'employee directory'), ('employee-directory', 'faculty directory'), ('employee-directory', 'staff directory'), ('employee-directory', 'professor contact'), ('employee-directory', 'professor email'), ('employee-directory', 'faculty contact'),
  ('academic-calendar', 'academic calendar'), ('academic-calendar', 'school calendar'), ('academic-calendar', 'semester calendar'), ('academic-calendar', 'term dates'), ('academic-calendar', 'university holidays'),
  ('registrar', 'registrar'), ('registrar', 'transcript'), ('registrar', 'diploma'), ('registrar', 'graduation application'), ('registrar', 'enrollment verification'), ('registrar', 'ferpa'),
  ('financial-aid', 'financial aid'), ('financial-aid', 'finaid'), ('financial-aid', 'fafsa'), ('financial-aid', 'student aid'), ('financial-aid', 'sap appeal'),
  ('campus-map', 'campus map'), ('campus-map', 'ulm map'), ('campus-map', 'building map'),
  ('housing', 'housing'), ('housing', 'residential life'), ('housing', 'residence hall'), ('housing', 'dorm'), ('housing', 'dorms'),
  ('library', 'library website'), ('library', 'library database'), ('library', 'research database'), ('library', 'research guide'), ('library', 'libguide'),
  ('counseling-center', 'counseling center'), ('counseling-center', 'student counseling'), ('counseling-center', 'mental health resources'), ('counseling-center', 'mental health help'), ('counseling-center', 'counselor appointment')
) AS alias(slug, normalized_alias)
JOIN official_resources resource ON resource.slug = alias.slug
ON CONFLICT (resource_id, normalized_alias) DO NOTHING;
