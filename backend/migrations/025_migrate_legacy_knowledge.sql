-- Replace unsourced legacy seed rows with a reviewed, officially sourced catalog.
-- Facility and dining hours are intentionally excluded; the structured hours system owns them.
BEGIN;

ALTER TABLE approved_knowledge
  ADD COLUMN IF NOT EXISTS source_url TEXT,
  ADD COLUMN IF NOT EXISTS source_title TEXT;

ALTER TABLE approved_knowledge
  DROP CONSTRAINT IF EXISTS approved_knowledge_source_url_check;
ALTER TABLE approved_knowledge
  ADD CONSTRAINT approved_knowledge_source_url_check
    CHECK (source_url IS NULL OR source_url ~ '^https://');

UPDATE approved_knowledge
SET status = 'replaced'
WHERE source_post_id IS NULL
  AND source_url IS NULL
  AND status <> 'replaced';

WITH reviewed(content, source_title, source_url, review_category) AS (
  VALUES
    ('Warhawk ID Services issues ULM identification cards and replaces lost, stolen, or damaged cards.', 'ULM Student Identification Cards', 'https://www.ulm.edu/warhawkcard/id-card-info.html', 'yearly'),
    ('The ULM Student Success Center provides professional academic advising, academic support, and referrals to campus resources.', 'ULM Student Success Center', 'https://www.ulm.edu/studentsuccess/', 'yearly'),
    ('ULM Tutoring Services offers free tutoring to ULM students in supported courses including biology, chemistry, mathematics, and physics.', 'ULM Tutoring Services', 'https://www.ulm.edu/studentsuccess/tutoring.html', 'term'),
    ('The ULM Library gives students access to books, research databases, electronic resources, study rooms, and computer labs.', 'ULM Library Services for Students', 'https://www.ulm.edu/library/students.html', 'yearly'),
    ('A ULM student ID serves as the student''s library card for borrowing eligible library materials.', 'ULM Library Services for Students', 'https://www.ulm.edu/library/students.html', 'yearly'),
    ('Schulze Dining Hall is a ULM campus dining location; current menus and service information are published by ULM Dining.', 'ULM Dining — Schulze Dining Hall', 'https://ulm.mydininghub.com/en/location/schulze#219949', 'term'),
    ('The ULM Activity Center provides recreation, fitness, and wellness programs and facilities.', 'ULM Recreational Services', 'https://cba.ulm.edu/recserv/', 'yearly'),
    ('The ULM Police Department provides campus law-enforcement and emergency response services.', 'ULM Police Department', 'https://www.ulm.edu/police/', 'yearly'),
    ('ULM Police offers security escorts on campus when an officer is available; students can request one by calling University Police.', 'ULM Police Security Escort', 'https://www.ulm.edu/police/security-escort.html', 'yearly'),
    ('The ULM Office of Financial Aid provides information and assistance with scholarships, grants, loans, and work-study.', 'ULM Financial Aid', 'https://www.ulm.edu/financialaid/', 'yearly'),
    ('The ULM Registrar is the official record keeper and handles registration, enrollment records, grades, and transcripts.', 'ULM Registrar', 'https://www.ulm.edu/registrar/', 'yearly'),
    ('ULM Career Development helps students with career planning, resumes, interviews, internships, job searches, and career fairs.', 'ULM Career Development', 'https://www.ulm.edu/careerdevelopment/careerservices/planning.html', 'yearly'),
    ('ULM students can use Handshake to search for jobs and internships, schedule career appointments, and find career events.', 'ULM Handshake', 'https://www.ulm.edu/careerdevelopment/careerservices/handshake.html', 'yearly'),
    ('Students looking for ULM on-campus work-study jobs should contact the Office of Financial Aid; other jobs and internships are available through Handshake.', 'ULM Career Planning Resources', 'https://www.ulm.edu/careerdevelopment/careerservices/planning.html', 'yearly'),
    ('Bayou Pointe Event Center is a ULM venue for meetings, lectures, workshops, conferences, banquets, and social functions.', 'ULM Bayou Pointe Event Center', 'https://www.ulm.edu/bayoupointe/', 'yearly'),
    ('Fant-Ewing Coliseum is ULM''s basketball and volleyball venue.', 'ULM Athletics Quick Facts', 'https://ulmwarhawks.com/sports/2025/6/26/205437928.aspx', 'stable'),
    ('Canvas is ULM''s learning management system, where students access course modules, assignments, grades, discussions, and announcements.', 'ULM Canvas Student Resources', 'https://www.ulm.edu/it/canvas/students.html', 'yearly'),
    ('Students access Banner through myULM to register for classes and view financial aid, fee bills, holds, student records, and course availability.', 'ULM Student Systems', 'https://www.ulm.edu/admissions/systems.html', 'yearly'),
    ('The ULM campus is located along Bayou DeSiard in Monroe, Louisiana.', 'ULM Campus Map', 'https://www.ulm.edu/maps/', 'stable'),
    ('ULM athletic teams are called the Warhawks, and the mascot is Ace the Warhawk.', 'ULM Athletics Quick Facts', 'https://ulmwarhawks.com/sports/2025/6/26/205437928.aspx', 'stable'),
    ('ULM competes in NCAA Division I athletics as a member of the Sun Belt Conference.', 'ULM Athletics Quick Facts', 'https://ulmwarhawks.com/sports/2025/6/26/205437928.aspx', 'yearly'),
    ('The ULM Counseling Center provides confidential counseling and mental-health support to eligible students.', 'ULM Counseling Center', 'https://www.ulm.edu/counselingcenter/', 'yearly'),
    ('ULM Information Technology provides help with university technology and campus systems through the IT Help Desk.', 'ULM Information Technology Help Desk', 'https://www.ulm.edu/it/hardware.html', 'yearly'),
    ('University Suites is suite-style ULM housing with private bedrooms and shared bathroom, vanity, and common areas within each unit.', 'ULM University Suites', 'https://www.ulm.edu/reslife/bldg_university_suites.html', 'yearly'),
    ('ULM publishes its academic calendar and semester important dates online, including class dates, holidays, exams, and registration deadlines.', 'ULM Academic Calendar', 'https://www.ulm.edu/academicaffairs/academiccalendar.html', 'term')
)
INSERT INTO approved_knowledge
  (source_post_id, source_url, source_title, cleaned_content, raw_content, embedding,
   status, review_category, last_verified_at, review_due_at)
SELECT NULL, r.source_url, r.source_title, r.content, r.content, NULL,
       'active', r.review_category, NOW(),
       CASE r.review_category
         WHEN 'term' THEN NOW() + INTERVAL '4 months'
         WHEN 'yearly' THEN NOW() + INTERVAL '1 year'
         ELSE NULL
       END
FROM reviewed r
WHERE NOT EXISTS (
  SELECT 1 FROM approved_knowledge k
  WHERE k.source_post_id IS NULL AND k.raw_content = r.content
);

UPDATE approved_knowledge k
SET source_url = r.source_url,
    source_title = r.source_title,
    status = 'active',
    review_category = r.review_category,
    last_verified_at = NOW(),
    review_due_at = CASE r.review_category
      WHEN 'term' THEN NOW() + INTERVAL '4 months'
      WHEN 'yearly' THEN NOW() + INTERVAL '1 year'
      ELSE NULL
    END
FROM (VALUES
  ('The ULM campus is located along Bayou DeSiard in Monroe, Louisiana.', 'ULM Campus Map', 'https://www.ulm.edu/maps/', 'stable')
) AS r(content, source_title, source_url, review_category)
WHERE k.source_post_id IS NULL AND k.raw_content = r.content;

CREATE INDEX IF NOT EXISTS approved_knowledge_source_url_idx
  ON approved_knowledge (source_url)
  WHERE source_url IS NOT NULL;

COMMIT;
