import { normalizeState } from '../src/lib/metrics.js';
import { randomUUID } from 'node:crypto';

const DEFAULT_PREFERENCES = {
  theme: 'light', pageSize: 8, dateFormat: 'DD MMM YYYY', defaultPassingMarks: 40,
  showDemoLabel: true, compactTables: false,
};
const DEFAULT_DASHBOARD = {
  cards: ['totalAdmissions', 'activeBatches', 'totalStudents', 'todayAttendance', 'upcomingAssessments', 'pendingTasks'],
  order: ['totalAdmissions', 'activeBatches', 'totalStudents', 'todayAttendance', 'upcomingAssessments', 'pendingTasks'],
};

const TABLES = {
  batches: 'batches',
  students: 'students',
  attendance: 'attendance',
  assessments: 'assessments',
  assessmentResults: 'assessment_results',
  tasks: 'tasks',
  trainerTasks: 'trainer_tasks',
  groups: 'student_groups',
  syllabi: 'syllabi',
};

const json = (value) => JSON.stringify(value || {});
const date = (value) => (value ? String(value).slice(0, 10) : null);
function dbDate(value) {
  if (!value) return null;
  if (typeof value === 'string') return value.slice(0, 10);
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
const number = (value, fallback = null) => (value === '' || value === undefined || value === null || Number.isNaN(Number(value)) ? fallback : Number(value));

function rowRecord(row, overrides = {}) {
  return { ...(row.data || {}), ...overrides };
}

export async function loadState(db, instituteId, userId = null) {
  const instituteResult = await db.query('SELECT * FROM institutes WHERE id = $1', [instituteId]);
  if (!instituteResult.rows.length) throw new Error('Institute record is missing. Run npm run db:init.');
  const institute = instituteResult.rows[0];
  let preferences = { ...DEFAULT_PREFERENCES, ...(institute.preferences || {}) };
  let dashboard = { ...DEFAULT_DASHBOARD, ...(institute.dashboard || {}) };
  if (userId) {
    const prefResult = await db.query('SELECT preferences, dashboard FROM user_preferences WHERE user_id = $1', [userId]);
    if (prefResult.rows.length) {
      preferences = { ...preferences, ...(prefResult.rows[0].preferences || {}) };
      dashboard = { ...dashboard, ...(prefResult.rows[0].dashboard || {}) };
    }
  }

  const [
    users, batches, students, attendance, assessments, assessmentResults,
    tasks, trainerTasks, groups, groupMembers, syllabi, modules, topics, syllabusBatches,
  ] = await Promise.all([
    db.query('SELECT id, name, email, phone, role, active, data, created_at FROM users WHERE institute_id = $1 ORDER BY name', [instituteId]),
    db.query('SELECT * FROM batches WHERE institute_id = $1 ORDER BY start_date DESC NULLS LAST', [instituteId]),
    db.query('SELECT * FROM students WHERE institute_id = $1 ORDER BY admission_date DESC NULLS LAST', [instituteId]),
    db.query('SELECT * FROM attendance WHERE institute_id = $1 ORDER BY attendance_date DESC', [instituteId]),
    db.query('SELECT * FROM assessments WHERE institute_id = $1 ORDER BY assessment_date DESC', [instituteId]),
    db.query('SELECT * FROM assessment_results WHERE institute_id = $1', [instituteId]),
    db.query('SELECT * FROM tasks WHERE institute_id = $1 ORDER BY due_date ASC NULLS LAST', [instituteId]),
    db.query('SELECT * FROM trainer_tasks WHERE institute_id = $1 ORDER BY deadline ASC NULLS LAST', [instituteId]),
    db.query('SELECT * FROM student_groups WHERE institute_id = $1 ORDER BY name', [instituteId]),
    db.query('SELECT gm.group_id, gm.student_id FROM group_members gm JOIN student_groups sg ON sg.id = gm.group_id WHERE sg.institute_id = $1', [instituteId]),
    db.query('SELECT * FROM syllabi WHERE institute_id = $1 ORDER BY course', [instituteId]),
    db.query('SELECT m.* FROM syllabus_modules m JOIN syllabi s ON s.id = m.syllabus_id WHERE s.institute_id = $1 ORDER BY m.position', [instituteId]),
    db.query('SELECT t.* FROM syllabus_topics t JOIN syllabus_modules m ON m.id = t.module_id JOIN syllabi s ON s.id = m.syllabus_id WHERE s.institute_id = $1 ORDER BY t.position', [instituteId]),
    db.query('SELECT sb.* FROM syllabus_batch_assignments sb JOIN syllabi s ON s.id = sb.syllabus_id WHERE s.institute_id = $1', [instituteId]),
  ]);

  const memberMap = new Map();
  groupMembers.rows.forEach((row) => {
    if (!memberMap.has(row.group_id)) memberMap.set(row.group_id, []);
    memberMap.get(row.group_id).push(row.student_id);
  });
  const topicMap = new Map();
  topics.rows.forEach((row) => {
    if (!topicMap.has(row.module_id)) topicMap.set(row.module_id, []);
    topicMap.get(row.module_id).push({
      id: row.id,
      title: row.title,
      completed: Boolean(row.completed),
      completionDate: row.completion_date ? dbDate(row.completion_date) : null,
    });
  });
  const moduleMap = new Map();
  modules.rows.forEach((row) => {
    if (!moduleMap.has(row.syllabus_id)) moduleMap.set(row.syllabus_id, []);
    moduleMap.get(row.syllabus_id).push({
      id: row.id,
      title: row.title,
      targetHours: number(row.target_hours, 8),
      topics: topicMap.get(row.id) || [],
    });
  });
  const syllabusBatchMap = new Map();
  syllabusBatches.rows.forEach((row) => {
    if (!syllabusBatchMap.has(row.syllabus_id)) syllabusBatchMap.set(row.syllabus_id, []);
    syllabusBatchMap.get(row.syllabus_id).push(row.batch_id);
  });

  const state = normalizeState({
    schemaVersion: 1,
    demo: false,
    updatedAt: institute.updated_at,
    users: users.rows.map((row) => rowRecord(row, {
      id: row.id, name: row.name, email: row.email, phone: row.phone || '',
      role: row.role, active: row.active, createdAt: row.created_at,
    })),
    credentials: [],
    batches: batches.rows.map((row) => rowRecord(row, {
      id: row.id, trainerId: row.trainer_id, name: row.name, course: row.course,
      startDate: row.start_date ? dbDate(row.start_date) : null,
      endDate: row.end_date ? dbDate(row.end_date) : null,
      schedule: row.schedule, status: row.status, capacity: row.capacity,
      studentCount: row.student_count, createdAt: row.created_at,
    })),
    students: students.rows.map((row) => rowRecord(row, {
      id: row.id, batchId: row.batch_id, studentId: row.student_id, name: row.name,
      email: row.email, phone: row.phone, course: row.course,
      admissionDate: row.admission_date ? dbDate(row.admission_date) : null,
      status: row.status, paymentStatus: row.payment_status, createdAt: row.created_at,
    })),
    attendance: attendance.rows.map((row) => rowRecord(row, {
      id: row.id, studentId: row.student_id, batchId: row.batch_id,
      date: row.attendance_date ? dbDate(row.attendance_date) : null,
      status: row.status, recordedBy: row.recorded_by, updatedAt: row.updated_at,
    })),
    assessments: assessments.rows.map((row) => rowRecord(row, {
      id: row.id, batchId: row.batch_id, title: row.title, type: row.assessment_type,
      date: row.assessment_date ? dbDate(row.assessment_date) : null,
      maxMarks: number(row.max_marks, 0), passingMarks: number(row.passing_marks, 0),
      status: row.status, createdAt: row.created_at,
    })),
    assessmentResults: assessmentResults.rows.map((row) => rowRecord(row, {
      id: row.id, assessmentId: row.assessment_id, studentId: row.student_id,
      batchId: row.batch_id, marks: number(row.marks, 0), maxMarks: number(row.max_marks, 0),
      percentage: number(row.percentage, 0), result: row.result, updatedAt: row.updated_at,
    })),
    tasks: tasks.rows.map((row) => rowRecord(row, {
      id: row.id, title: row.title, assignee: row.assignee, category: row.category,
      priority: row.priority, status: row.status,
      dueDate: row.due_date ? dbDate(row.due_date) : null,
      createdAt: row.created_at,
    })),
    trainerTasks: trainerTasks.rows.map((row) => rowRecord(row, {
      id: row.id, trainerId: row.trainer_id, batchId: row.batch_id, title: row.title,
      category: row.category, course: row.course, priority: row.priority, status: row.status,
      progress: number(row.progress, 0), deadline: row.deadline ? dbDate(row.deadline) : null,
      createdAt: row.created_at,
    })),
    groups: groups.rows.map((row) => rowRecord(row, {
      id: row.id, batchId: row.batch_id, trainerId: row.trainer_id, leaderId: row.leader_id,
      name: row.name, project: row.project, status: row.status,
      memberIds: memberMap.get(row.id) || [],
      memberCount: (memberMap.get(row.id) || []).length,
      createdAt: row.created_at,
    })),
    syllabi: syllabi.rows.map((row) => rowRecord(row, {
      id: row.id, course: row.course, description: row.description, status: row.status,
      batchIds: syllabusBatchMap.get(row.id) || [],
      modules: moduleMap.get(row.id) || [],
      createdAt: row.created_at,
    })),
    meta: {
      institute: institute.profile || {},
      preferences,
      dashboard,
    },
  });
  state.instituteId = instituteId;
  return state;
}

export async function saveInstituteMeta(db, instituteId, meta = {}) {
  const result = await db.query(
    `UPDATE institutes SET name = COALESCE($2, name), profile = COALESCE($3::jsonb, profile),
      preferences = COALESCE($4::jsonb, preferences), dashboard = COALESCE($5::jsonb, dashboard),
      updated_at = NOW() WHERE id = $1 RETURNING *`,
    [instituteId, meta.institute?.name || null, meta.institute ? json(meta.institute) : null, meta.preferences ? json(meta.preferences) : null, meta.dashboard ? json(meta.dashboard) : null],
  );
  if (!result.rows.length) throw new Error('Institute not found.');
  return result.rows[0];
}

export async function saveUserPreferences(db, userId, preferences = {}, dashboard = {}) {
  await db.query(
    `INSERT INTO user_preferences (user_id, preferences, dashboard, updated_at) VALUES ($1, $2::jsonb, $3::jsonb, NOW())
     ON CONFLICT (user_id) DO UPDATE SET preferences = user_preferences.preferences || EXCLUDED.preferences,
       dashboard = user_preferences.dashboard || EXCLUDED.dashboard, updated_at = NOW()`,
    [userId, json(preferences), json(dashboard)],
  );
}

async function upsertAttendance(db, instituteId, record) {
  const identity = await db.query(
    'SELECT id FROM attendance WHERE institute_id = $1 AND student_id = $2 AND batch_id = $3 AND attendance_date = $4',
    [instituteId, record.studentId, record.batchId, date(record.date)],
  );
  const id = identity.rows[0]?.id || record.id;
  await db.query(
    `INSERT INTO attendance (id, institute_id, student_id, batch_id, attendance_date, status, recorded_by, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)
     ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by,
       data = EXCLUDED.data, attendance_date = EXCLUDED.attendance_date, updated_at = NOW()`,
    [id, instituteId, record.studentId, record.batchId, date(record.date), record.status, record.recordedBy || null, json(record)],
  );
}

async function upsertAssessmentResult(db, instituteId, record) {
  const identity = await db.query(
    'SELECT id FROM assessment_results WHERE institute_id = $1 AND assessment_id = $2 AND student_id = $3',
    [instituteId, record.assessmentId, record.studentId],
  );
  const id = identity.rows[0]?.id || record.id;
  await db.query(
    `INSERT INTO assessment_results (id, institute_id, assessment_id, student_id, batch_id, marks, max_marks, percentage, result, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
     ON CONFLICT (id) DO UPDATE SET marks = EXCLUDED.marks, max_marks = EXCLUDED.max_marks,
       percentage = EXCLUDED.percentage, result = EXCLUDED.result, data = EXCLUDED.data, updated_at = NOW()`,
    [id, instituteId, record.assessmentId, record.studentId, record.batchId || null,
      number(record.marks, 0), number(record.maxMarks, 0), number(record.percentage, 0), record.result || 'Fail', json(record)],
  );
}

async function upsertGroup(db, instituteId, record) {
  const memberIds = [...new Set(record.memberIds || [])];
  await db.query(
    `INSERT INTO student_groups (id, institute_id, batch_id, trainer_id, leader_id, name, project, status, data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
     ON CONFLICT (id) DO UPDATE SET batch_id = EXCLUDED.batch_id, trainer_id = EXCLUDED.trainer_id,
       leader_id = EXCLUDED.leader_id, name = EXCLUDED.name, project = EXCLUDED.project,
       status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW()`,
    [record.id, instituteId, record.batchId || null, record.trainerId || null, record.leaderId || null,
      record.name, record.project || null, record.status || 'Active', json(record)],
  );
  await db.query('DELETE FROM group_members WHERE group_id = $1', [record.id]);
  for (const studentId of memberIds) {
    await db.query('INSERT INTO group_members (group_id, student_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [record.id, studentId]).catch(() => {});
  }
}

async function upsertSyllabus(db, instituteId, record) {
  await db.query(
    `INSERT INTO syllabi (id, institute_id, course, description, status, data)
     VALUES ($1,$2,$3,$4,$5,$6::jsonb)
     ON CONFLICT (id) DO UPDATE SET course = EXCLUDED.course, description = EXCLUDED.description,
       status = EXCLUDED.status, data = EXCLUDED.data, updated_at = NOW()`,
    [record.id, instituteId, record.course, record.description || null, record.status || 'Active', json({ ...record, modules: undefined })],
  );
  const modules = Array.isArray(record.modules) ? record.modules : [];
  const moduleIds = modules.map((module) => module.id).filter(Boolean);
  if (moduleIds.length) {
    await db.query('DELETE FROM syllabus_modules WHERE syllabus_id = $1 AND NOT (id = ANY($2::text[]))', [record.id, moduleIds]);
  } else {
    await db.query('DELETE FROM syllabus_modules WHERE syllabus_id = $1', [record.id]);
  }
  for (let moduleIndex = 0; moduleIndex < modules.length; moduleIndex += 1) {
    const module = modules[moduleIndex];
    await db.query(
      `INSERT INTO syllabus_modules (id, syllabus_id, title, target_hours, position, data)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)
       ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, target_hours = EXCLUDED.target_hours,
         position = EXCLUDED.position, data = EXCLUDED.data, updated_at = NOW()`,
      [module.id, record.id, module.title, number(module.targetHours, 8), moduleIndex, json(module)],
    );
    const topics = Array.isArray(module.topics) ? module.topics : [];
    const topicIds = topics.map((topic) => topic.id).filter(Boolean);
    if (topicIds.length) {
      await db.query('DELETE FROM syllabus_topics WHERE module_id = $1 AND NOT (id = ANY($2::text[]))', [module.id, topicIds]);
    } else {
      await db.query('DELETE FROM syllabus_topics WHERE module_id = $1', [module.id]);
    }
    for (let topicIndex = 0; topicIndex < topics.length; topicIndex += 1) {
      const topic = topics[topicIndex];
      await db.query(
        `INSERT INTO syllabus_topics (id, module_id, title, completed, completion_date, position, data)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)
         ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, completed = EXCLUDED.completed,
           completion_date = EXCLUDED.completion_date, position = EXCLUDED.position,
           data = EXCLUDED.data, updated_at = NOW()`,
        [topic.id, module.id, topic.title, Boolean(topic.completed), date(topic.completionDate), topicIndex, json(topic)],
      );
    }
  }
  await db.query('DELETE FROM syllabus_batch_assignments WHERE syllabus_id = $1', [record.id]);
  for (const batchId of new Set(record.batchIds || [])) {
    await db.query('INSERT INTO syllabus_batch_assignments (syllabus_id, batch_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [record.id, batchId]).catch(() => {});
  }
}

export async function saveRecord(db, instituteId, collection, record) {
  if (!record?.id) throw new Error(`A record ID is required for ${collection}.`);
  switch (collection) {
    case 'batches':
      await db.query(
        `INSERT INTO batches (id,institute_id,trainer_id,name,course,start_date,end_date,schedule,status,capacity,student_count,data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
         ON CONFLICT (id) DO UPDATE SET trainer_id=EXCLUDED.trainer_id,name=EXCLUDED.name,course=EXCLUDED.course,
           start_date=EXCLUDED.start_date,end_date=EXCLUDED.end_date,schedule=EXCLUDED.schedule,status=EXCLUDED.status,
           capacity=EXCLUDED.capacity,student_count=EXCLUDED.student_count,data=EXCLUDED.data,updated_at=NOW()`,
        [record.id, instituteId, record.trainerId || null, record.name, record.course, date(record.startDate), date(record.endDate),
          record.schedule || null, record.status, number(record.capacity, 0), number(record.studentCount, 0), json(record)],
      );
      break;
    case 'students':
      await db.query(
        `INSERT INTO students (id,institute_id,batch_id,student_id,name,email,phone,course,admission_date,status,payment_status,data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
         ON CONFLICT (id) DO UPDATE SET batch_id=EXCLUDED.batch_id,student_id=EXCLUDED.student_id,name=EXCLUDED.name,
           email=EXCLUDED.email,phone=EXCLUDED.phone,course=EXCLUDED.course,admission_date=EXCLUDED.admission_date,
           status=EXCLUDED.status,payment_status=EXCLUDED.payment_status,data=EXCLUDED.data,updated_at=NOW()`,
        [record.id, instituteId, record.batchId || null, record.studentId || record.id, record.name, record.email,
          record.phone || null, record.course || null, date(record.admissionDate), record.status || 'Active',
          record.paymentStatus || 'Pending', json(record)],
      );
      break;
    case 'attendance': await upsertAttendance(db, instituteId, record); break;
    case 'assessments':
      await db.query(
        `INSERT INTO assessments (id,institute_id,batch_id,title,assessment_type,assessment_date,max_marks,passing_marks,status,data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
         ON CONFLICT (id) DO UPDATE SET batch_id=EXCLUDED.batch_id,title=EXCLUDED.title,assessment_type=EXCLUDED.assessment_type,
           assessment_date=EXCLUDED.assessment_date,max_marks=EXCLUDED.max_marks,passing_marks=EXCLUDED.passing_marks,
           status=EXCLUDED.status,data=EXCLUDED.data,updated_at=NOW()`,
        [record.id, instituteId, record.batchId || null, record.title, record.type || null, date(record.date),
          number(record.maxMarks, 0), number(record.passingMarks, 0), record.status || 'Draft', json(record)],
      );
      break;
    case 'assessmentResults': await upsertAssessmentResult(db, instituteId, record); break;
    case 'tasks':
      await db.query(
        `INSERT INTO tasks (id,institute_id,title,assignee,category,priority,status,due_date,data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)
         ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title,assignee=EXCLUDED.assignee,category=EXCLUDED.category,
           priority=EXCLUDED.priority,status=EXCLUDED.status,due_date=EXCLUDED.due_date,data=EXCLUDED.data,updated_at=NOW()`,
        [record.id, instituteId, record.title, record.assignee || null, record.category || null, record.priority || 'Medium',
          record.status || 'To Do', date(record.dueDate), json(record)],
      );
      break;
    case 'trainerTasks':
      await db.query(
        `INSERT INTO trainer_tasks (id,institute_id,trainer_id,batch_id,title,category,course,priority,status,progress,deadline,data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
         ON CONFLICT (id) DO UPDATE SET trainer_id=EXCLUDED.trainer_id,batch_id=EXCLUDED.batch_id,title=EXCLUDED.title,
           category=EXCLUDED.category,course=EXCLUDED.course,priority=EXCLUDED.priority,status=EXCLUDED.status,
           progress=EXCLUDED.progress,deadline=EXCLUDED.deadline,data=EXCLUDED.data,updated_at=NOW()`,
        [record.id, instituteId, record.trainerId || null, record.batchId || null, record.title, record.category || null,
          record.course || null, record.priority || 'Medium', record.status || 'To Do', number(record.progress, 0),
          date(record.deadline), json(record)],
      );
      break;
    case 'groups': await upsertGroup(db, instituteId, record); break;
    case 'syllabi': await upsertSyllabus(db, instituteId, record); break;
    default: throw new Error(`Unsupported collection: ${collection}`);
  }
}

export async function deleteRecord(db, instituteId, collection, id) {
  const table = TABLES[collection];
  if (!table) throw new Error(`Unsupported collection: ${collection}`);
  await db.query(`DELETE FROM ${table} WHERE institute_id = $1 AND id = $2`, [instituteId, id]);
}

export async function findAuthUser(db, instituteId, email) {
  const result = await db.query('SELECT * FROM users WHERE institute_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1', [instituteId, email]);
  return result.rows[0] || null;
}

export async function findUserById(db, instituteId, id) {
  const result = await db.query('SELECT * FROM users WHERE institute_id = $1 AND id = $2 LIMIT 1', [instituteId, id]);
  return result.rows[0] || null;
}

export function sanitizeDbUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone || '',
    role: row.role,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function upsertUser(db, instituteId, record, passwordFields = null) {
  const existing = record.id ? await findUserById(db, instituteId, record.id) : null;
  if (!existing && !passwordFields) throw new Error('A password is required for a new user.');
  const id = record.id || `USER-${randomUUID()}`;
  if (passwordFields) {
    await db.query(
      `INSERT INTO users (id,institute_id,name,email,phone,role,active,password_hash,password_salt,password_algorithm,password_iterations,data)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)
       ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,email=EXCLUDED.email,phone=EXCLUDED.phone,role=EXCLUDED.role,
         active=EXCLUDED.active,password_hash=EXCLUDED.password_hash,password_salt=EXCLUDED.password_salt,
         password_algorithm=EXCLUDED.password_algorithm,password_iterations=EXCLUDED.password_iterations,
         data=EXCLUDED.data,updated_at=NOW()`,
      [id, instituteId, record.name, record.email.trim().toLowerCase(), record.phone || null, record.role,
        record.active !== false, passwordFields.passwordHash, passwordFields.passwordSalt,
        passwordFields.passwordAlgorithm, passwordFields.passwordIterations, json(record)],
    );
  } else {
    await db.query(
      `UPDATE users SET name=$3,email=$4,phone=$5,role=$6,active=$7,data=$8::jsonb,updated_at=NOW()
       WHERE institute_id=$1 AND id=$2`,
      [instituteId, id, record.name, record.email.trim().toLowerCase(), record.phone || null, record.role,
        record.active !== false, json(record)],
    );
  }
  return findUserById(db, instituteId, id);
}

export async function updateUserPassword(db, instituteId, id, passwordFields) {
  await db.query(
    `UPDATE users SET password_hash=$3,password_salt=$4,password_algorithm=$5,password_iterations=$6,updated_at=NOW()
     WHERE institute_id=$1 AND id=$2`,
    [instituteId, id, passwordFields.passwordHash, passwordFields.passwordSalt,
      passwordFields.passwordAlgorithm, passwordFields.passwordIterations],
  );
}

export async function deleteDbUser(db, instituteId, id) {
  await db.query('DELETE FROM users WHERE institute_id = $1 AND id = $2', [instituteId, id]);
}

export async function seedState(db, instituteId, seed) {
  await db.query(
    `INSERT INTO institutes (id,name,profile,preferences,dashboard) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5::jsonb)
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,profile=EXCLUDED.profile,
       preferences=EXCLUDED.preferences,dashboard=EXCLUDED.dashboard,updated_at=NOW()`,
    [instituteId, seed.meta.institute.name, json(seed.meta.institute), json(seed.meta.preferences), json(seed.meta.dashboard)],
  );
  const credentialMap = new Map((seed.credentials || []).map((credential) => [credential.userId, credential]));
  for (const user of seed.users) {
    const credential = credentialMap.get(user.id) || {};
    await db.query(
      `INSERT INTO users (id,institute_id,name,email,phone,role,active,password_hash,password_salt,password_algorithm,password_iterations,data,created_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13)
       ON CONFLICT (id) DO NOTHING`,
      [user.id, instituteId, user.name, user.email, user.phone || null, user.role, user.active !== false,
        credential.passwordHash || 'unusable', credential.passwordSalt || null,
        credential.passwordAlgorithm || 'PBKDF2-SHA256', credential.passwordIterations || 120000,
        json(user), date(user.createdAt) || null],
    );
  }
  const order = ['batches', 'students', 'attendance', 'assessments', 'assessmentResults', 'tasks', 'trainerTasks', 'groups', 'syllabi'];
  for (const collection of order) {
    for (const record of seed[collection] || []) await saveRecord(db, instituteId, collection, record);
  }
}

export async function hasUsers(db, instituteId) {
  const result = await db.query('SELECT COUNT(*)::int AS count FROM users WHERE institute_id = $1', [instituteId]);
  return result.rows[0].count > 0;
}
