-- EduTrack CRM PostgreSQL schema.
-- Safe to run repeatedly: all objects use IF NOT EXISTS / CREATE OR REPLACE style.
-- The Express API persists records into these relational tables and reads them back
-- as a state document for the React client.

CREATE TABLE IF NOT EXISTS institutes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  dashboard JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('Admin', 'Trainer', 'Read-Only')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT,
  password_algorithm TEXT NOT NULL DEFAULT 'bcrypt',
  password_iterations INTEGER NOT NULL DEFAULT 12,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_lower_email_idx ON users (LOWER(email));

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  dashboard JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS batches (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  trainer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  course TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  schedule TEXT,
  status TEXT NOT NULL CHECK (status IN ('Upcoming', 'Active', 'Completed', 'On Hold')),
  capacity INTEGER,
  student_count INTEGER NOT NULL DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS batches_institute_idx ON batches (institute_id, status);

CREATE TABLE IF NOT EXISTS students (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
  student_id TEXT,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  course TEXT,
  admission_date DATE,
  status TEXT,
  payment_status TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS students_batch_idx ON students (institute_id, batch_id);
CREATE INDEX IF NOT EXISTS students_email_idx ON students (LOWER(email));

CREATE TABLE IF NOT EXISTS attendance (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
  attendance_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Present', 'Absent', 'Late', 'Excused')),
  recorded_by TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT attendance_unique_day UNIQUE (student_id, batch_id, attendance_date)
);
CREATE INDEX IF NOT EXISTS attendance_date_idx ON attendance (institute_id, attendance_date);

CREATE TABLE IF NOT EXISTS assessments (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assessment_type TEXT,
  assessment_date DATE NOT NULL,
  max_marks NUMERIC NOT NULL,
  passing_marks NUMERIC NOT NULL,
  status TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS assessments_batch_idx ON assessments (institute_id, batch_id, assessment_date);

CREATE TABLE IF NOT EXISTS assessment_results (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  assessment_id TEXT NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
  marks NUMERIC NOT NULL,
  max_marks NUMERIC NOT NULL,
  percentage INTEGER NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('Pass', 'Fail')),
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT assessment_result_unique UNIQUE (assessment_id, student_id)
);
CREATE INDEX IF NOT EXISTS assessment_results_student_idx ON assessment_results (institute_id, student_id);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  assignee TEXT,
  category TEXT,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL,
  due_date DATE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS tasks_due_idx ON tasks (institute_id, due_date, status);

CREATE TABLE IF NOT EXISTS trainer_tasks (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  trainer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT,
  course TEXT,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  deadline DATE,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS trainer_tasks_trainer_idx ON trainer_tasks (institute_id, trainer_id, deadline);

CREATE TABLE IF NOT EXISTS student_groups (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  batch_id TEXT REFERENCES batches(id) ON DELETE CASCADE,
  trainer_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  leader_id TEXT,
  name TEXT NOT NULL,
  project TEXT,
  status TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL REFERENCES student_groups(id) ON DELETE CASCADE,
  student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (group_id, student_id)
);
CREATE INDEX IF NOT EXISTS group_members_student_idx ON group_members (student_id);

CREATE TABLE IF NOT EXISTS syllabi (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  course TEXT NOT NULL,
  description TEXT,
  status TEXT,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS syllabus_batch_assignments (
  syllabus_id TEXT NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  batch_id TEXT NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  PRIMARY KEY (syllabus_id, batch_id)
);

CREATE TABLE IF NOT EXISTS syllabus_modules (
  id TEXT PRIMARY KEY,
  syllabus_id TEXT NOT NULL REFERENCES syllabi(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  target_hours INTEGER,
  position INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syllabus_modules_syllabus_idx ON syllabus_modules (syllabus_id, position);

CREATE TABLE IF NOT EXISTS syllabus_topics (
  id TEXT PRIMARY KEY,
  module_id TEXT NOT NULL REFERENCES syllabus_modules(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  completion_date DATE,
  position INTEGER NOT NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS syllabus_topics_module_idx ON syllabus_topics (module_id, position);

CREATE TABLE IF NOT EXISTS report_snapshots (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  generated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  report_type TEXT NOT NULL,
  filters JSONB NOT NULL DEFAULT '{}'::jsonb,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS report_snapshots_type_idx ON report_snapshots (institute_id, report_type, created_at);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  institute_id TEXT NOT NULL REFERENCES institutes(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs (institute_id, created_at DESC);
