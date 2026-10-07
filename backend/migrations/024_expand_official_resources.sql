-- Expand Hawkbot's deterministic campus-resource directory with current,
-- backend-owned ULM destinations. Re-running this migration refreshes the
-- descriptions and response copy without creating duplicate resources.

INSERT INTO official_resources
  (slug, name, description, url, response_text, requires_login, priority, last_verified_at)
VALUES
  ('career-development', 'ULM Career Development and Handshake', 'Jobs, internships, career appointments, career events, resumes, interviews, Handshake, and on-campus employment guidance.', 'https://www.ulm.edu/careerdevelopment/careerservices/handshake.html', 'Use ULM Handshake to search and apply for jobs and internships, schedule career appointments, and find career events. For on-campus work-study opportunities, ULM Career Development directs students to the Office of Financial Aid.', TRUE, 95, NOW()),
  ('student-success', 'ULM Student Success Center', 'Academic advising, tutoring, supplemental instruction, peer support, and student-success referrals.', 'https://www.ulm.edu/studentsuccess/', 'The ULM Student Success Center provides academic advising, tutoring, supplemental instruction, and other academic-support resources.', FALSE, 80, NOW()),
  ('tutoring', 'ULM Tutoring Services', 'Free tutoring and tutoring appointments for supported ULM courses.', 'https://www.ulm.edu/studentsuccess/tutoring.html', 'ULM students can find free tutoring options and schedule support through ULM Tutoring Services.', FALSE, 85, NOW()),
  ('it-helpdesk', 'ULM IT Helpdesk', 'Help with passwords, accounts, campus Wi-Fi, university systems, computers, and technology support tickets.', 'https://www.ulm.edu/it/helpdesk/', 'For passwords, accounts, Wi-Fi, or other university technology problems, contact the ULM IT Helpdesk or submit a support ticket on its official page.', FALSE, 85, NOW()),
  ('canvas', 'ULM Canvas Support', 'Canvas login guidance, course access, assignments, grades, and learning-management-system support.', 'https://www.ulm.edu/it/canvas/students.html', 'Access Canvas through myULM and use ULM Canvas Support for help with courses, assignments, grades, and Canvas access.', TRUE, 85, NOW()),
  ('student-systems', 'myULM and Banner', 'myULM portal access and Banner registration, student records, financial aid, fee bills, holds, and course availability.', 'https://www.ulm.edu/admissions/systems.html', 'Use myULM to access campus accounts and services. Banner is the student system for registration, records, financial aid, fee bills, holds, and course availability.', TRUE, 90, NOW()),
  ('health-clinic', 'ULM Hawk Health Clinic', 'On-campus health care, wellness visits, immunizations, minor illness and injury treatment, screenings, and clinic contact information.', 'https://www.ulm.edu/healthclinic/index.html', 'The ULM Hawk Health Clinic provides on-campus health services for students, faculty, and staff; its official page has services, location, hours, and contact information.', FALSE, 85, NOW()),
  ('special-accommodations', 'ULM Student Accessibility Services', 'Documentation guidance and academic accommodations for students with qualifying disabilities.', 'https://www.ulm.edu/studentsuccess/docs.html', 'Students who need disability-related academic accommodations can review ULM Student Accessibility Services documentation guidance and request assistance.', FALSE, 85, NOW()),
  ('parking', 'ULM Campus Parking', 'Parking permits, student parking zones, parking rules, citations, and campus vehicle information.', 'https://www.ulm.edu/parking/', 'You can find parking permits, designated parking zones, rules, and citation information on ULM Campus Parking''s official website.', FALSE, 75, NOW()),
  ('student-life', 'ULM Student Life', 'Student organizations, campus involvement, activities, leadership, recreation, wellness, and student-development resources.', 'https://www.ulm.edu/studentlife/', 'ULM Student Life connects students with organizations, activities, leadership opportunities, recreation, wellness, and other ways to get involved.', FALSE, 75, NOW()),
  ('current-students', 'ULM Current Students resources', 'Central directory for student services, academics, health and safety, campus technology, publications, and frequently used links.', 'https://www.ulm.edu/ulmstudents/', 'The ULM Current Students page is a central directory for commonly used academic, technology, health, safety, and student-service resources.', FALSE, 65, NOW()),
  ('warhawk-id', 'ULM Warhawk ID Services', 'Student identification cards, replacement cards, meal-card access, and Warhawk Express services.', 'https://www.ulm.edu/warhawkcard/id-card-info.html', 'ULM Warhawk ID Services provides student ID information, including how to obtain or replace a Warhawk ID card.', FALSE, 70, NOW())
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  url = EXCLUDED.url,
  response_text = EXCLUDED.response_text,
  requires_login = EXCLUDED.requires_login,
  priority = EXCLUDED.priority,
  active = TRUE,
  last_verified_at = EXCLUDED.last_verified_at,
  updated_at = NOW();

INSERT INTO official_resource_aliases (resource_id, normalized_alias)
SELECT resource.id, alias.normalized_alias
FROM (VALUES
  ('career-development', 'campus jobs'), ('career-development', 'on campus jobs'), ('career-development', 'on-campus jobs'), ('career-development', 'student jobs'), ('career-development', 'student employment'), ('career-development', 'campus employment'), ('career-development', 'work study'), ('career-development', 'work-study'), ('career-development', 'handshake'), ('career-development', 'job search'), ('career-development', 'find a job'), ('career-development', 'internships'), ('career-development', 'career development'), ('career-development', 'career services'), ('career-development', 'career fair'), ('career-development', 'resume help'), ('career-development', 'interview help'),
  ('student-success', 'student success center'), ('student-success', 'academic support'), ('student-success', 'academic advising'), ('student-success', 'student success'), ('student-success', 'supplemental instruction'),
  ('tutoring', 'tutoring'), ('tutoring', 'tutor'), ('tutoring', 'tutoring appointment'), ('tutoring', 'free tutoring'), ('tutoring', 'math tutoring'), ('tutoring', 'science tutoring'),
  ('it-helpdesk', 'it helpdesk'), ('it-helpdesk', 'help desk'), ('it-helpdesk', 'tech support'), ('it-helpdesk', 'technology help'), ('it-helpdesk', 'password reset'), ('it-helpdesk', 'wifi help'), ('it-helpdesk', 'wi-fi help'), ('it-helpdesk', 'support ticket'),
  ('canvas', 'canvas'), ('canvas', 'canvas login'), ('canvas', 'canvas support'), ('canvas', 'canvas help'), ('canvas', 'missing canvas course'),
  ('student-systems', 'myulm'), ('student-systems', 'my ulm'), ('student-systems', 'student portal'), ('student-systems', 'banner'), ('student-systems', 'banner login'), ('student-systems', 'self service banner'), ('student-systems', 'class registration'), ('student-systems', 'register for classes'), ('student-systems', 'fee bill'), ('student-systems', 'student records'),
  ('health-clinic', 'health clinic'), ('health-clinic', 'hawk health clinic'), ('health-clinic', 'student health'), ('health-clinic', 'campus clinic'), ('health-clinic', 'doctor on campus'), ('health-clinic', 'immunizations'), ('health-clinic', 'sick on campus'),
  ('special-accommodations', 'special accommodations'), ('special-accommodations', 'disability services'), ('special-accommodations', 'student accommodations'), ('special-accommodations', 'academic accommodations'), ('special-accommodations', 'testing accommodations'), ('special-accommodations', 'accessibility services'),
  ('parking', 'campus parking'), ('parking', 'parking permit'), ('parking', 'parking pass'), ('parking', 'student parking'), ('parking', 'parking zones'), ('parking', 'parking ticket'), ('parking', 'parking citation'),
  ('student-life', 'student life'), ('student-life', 'student organizations'), ('student-life', 'student clubs'), ('student-life', 'campus clubs'), ('student-life', 'get involved'), ('student-life', 'campus activities'), ('student-life', 'greek life'),
  ('current-students', 'student resources'), ('current-students', 'campus resources'), ('current-students', 'current students'), ('current-students', 'student services'),
  ('warhawk-id', 'warhawk id'), ('warhawk-id', 'student id'), ('warhawk-id', 'id card'), ('warhawk-id', 'replace id'), ('warhawk-id', 'lost id'), ('warhawk-id', 'warhawk card')
) AS alias(slug, normalized_alias)
JOIN official_resources resource ON resource.slug = alias.slug
ON CONFLICT (resource_id, normalized_alias) DO NOTHING;
