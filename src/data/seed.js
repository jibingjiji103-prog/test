import { derivePassword } from '../lib/crypto.js';
import { addDays, todayISO } from '../lib/utils.js';

export const DEMO_PASSWORD = 'Demo@12345';
export const STATE_VERSION = 1;

const today = todayISO();

const studentNames = [
  'Aditya Nair', 'Sneha Prakash', 'Rahul Varma', 'Fathima Zahra', 'Vishnu Krishnan',
  'Ananya Iyer', 'Arjun Menon', 'Meera Joshi', 'Nikhil Rao', 'Divya Suresh',
  'Ishaan Gupta', 'Kavya Pillai', 'Rohan Mathew', 'Sara Thomas', 'Akhil Dev',
  'Neethu Rajan', 'Devika Sharma', 'Muhammad Alif', 'Pranav Ravi', 'Riya Sebastian',
  'Joel Varghese',
];

const courses = ['DevOps', 'Full Stack JavaScript', 'Data Analytics', 'Python for Data Science'];
const localCourses = {
  'BATCH-2026-01': 'DevOps',
  'BATCH-2026-02': 'Full Stack JavaScript',
  'BATCH-2026-03': 'Data Analytics',
  'BATCH-2025-09': 'Python for Data Science',
};

async function makeUser(id, name, email, role, phone = '') {
  return {
    id,
    name,
    email,
    role,
    phone,
    active: true,
    createdAt: addDays(today, -120),
    ...(await derivePassword(DEMO_PASSWORD)),
  };
}

function makeStudents() {
  const assignments = [
    ...Array.from({ length: 8 }, (_, i) => ({ batchId: 'BATCH-2026-01', course: localCourses['BATCH-2026-01'], index: i })),
    ...Array.from({ length: 8 }, (_, i) => ({ batchId: 'BATCH-2026-02', course: localCourses['BATCH-2026-02'], index: i + 8 })),
    ...Array.from({ length: 3 }, (_, i) => ({ batchId: 'BATCH-2026-03', course: localCourses['BATCH-2026-03'], index: i + 16 })),
    ...Array.from({ length: 2 }, (_, i) => ({ batchId: 'BATCH-2025-09', course: localCourses['BATCH-2025-09'], index: i + 19 })),
  ];
  return assignments.map((assignment, position) => {
    const { index } = assignment;
    const name = studentNames[index];
    const emailName = name.toLowerCase().replace(/[^a-z]+/g, '.');
    const completed = assignment.batchId === 'BATCH-2025-09';
    const dropped = position === 17;
    return {
      id: `STU-${String(1001 + position)}`,
      studentId: `STU-${String(1001 + position)}`,
      name,
      email: `${emailName}@student.edutrack.demo`,
      phone: `+91 98${String(45000000 + position * 137).slice(-8)}`,
      course: assignment.course,
      batchId: assignment.batchId,
      admissionDate: addDays(today, -(130 - position * 5)),
      status: completed ? 'Completed' : dropped ? 'Dropped' : 'Active',
      paymentStatus: position % 7 === 0 ? 'Partial' : position % 11 === 0 ? 'Pending' : 'Paid',
      notes: position % 6 === 0 ? 'Scholarship recipient; requires weekly progress follow-up.' : '',
      createdAt: addDays(today, -(130 - position * 5)),
    };
  });
}

function makeBatches(students) {
  const values = [
    {
      id: 'BATCH-2026-01', batchId: 'BATCH-2026-01', name: 'DevOps Immersive — Cohort 12', course: 'DevOps',
      trainerId: 'USER-AARAV', trainer: 'Aarav Menon', startDate: addDays(today, -72), endDate: addDays(today, 48),
      schedule: 'Mon–Fri · 09:00–11:00 IST', status: 'Active', room: 'Lab 1', capacity: 20,
    },
    {
      id: 'BATCH-2026-02', batchId: 'BATCH-2026-02', name: 'Full Stack JavaScript — Evening', course: 'Full Stack JavaScript',
      trainerId: 'USER-PRIYA', trainer: 'Priya Nair', startDate: addDays(today, -56), endDate: addDays(today, 65),
      schedule: 'Mon/Wed/Fri · 18:00–20:00 IST', status: 'Active', room: 'Studio 2', capacity: 18,
    },
    {
      id: 'BATCH-2026-03', batchId: 'BATCH-2026-03', name: 'Data Analytics Foundations', course: 'Data Analytics',
      trainerId: 'USER-ROHIT', trainer: 'Rohit Sharma', startDate: addDays(today, 14), endDate: addDays(today, 110),
      schedule: 'Tue/Thu · 10:00–12:00 IST', status: 'Upcoming', room: 'Online', capacity: 24,
    },
    {
      id: 'BATCH-2025-09', batchId: 'BATCH-2025-09', name: 'Python for Data Science — Weekend', course: 'Python for Data Science',
      trainerId: 'USER-ROHIT', trainer: 'Rohit Sharma', startDate: addDays(today, -180), endDate: addDays(today, -40),
      schedule: 'Sat/Sun · 10:00–13:00 IST', status: 'Completed', room: 'Lab 3', capacity: 22,
    },
  ];
  return values.map((batch) => ({ ...batch, studentCount: students.filter((s) => s.batchId === batch.id).length }));
}

function makeAttendance(students) {
  const records = [];
  const activeStudents = students.filter((s) => s.status === 'Active' && ['BATCH-2026-01', 'BATCH-2026-02'].includes(s.batchId));
  const dates = [today, -1, -2, -3, -6, -7, -8, -9, -13, -14].map((offset) => (typeof offset === 'number' ? addDays(today, offset) : offset));
  dates.forEach((date, dayIndex) => {
    activeStudents.forEach((student, studentIndex) => {
      let status = 'Present';
      if ((studentIndex + dayIndex * 2) % 13 === 0) status = 'Absent';
      else if ((studentIndex + dayIndex) % 9 === 0) status = 'Late';
      else if ((studentIndex + dayIndex) % 17 === 0) status = 'Excused';
      records.push({
        id: `ATT-${date}-${student.id}`.replaceAll('-', ''),
        studentId: student.id,
        batchId: student.batchId,
        date,
        status,
        note: status === 'Excused' ? 'Medical leave' : '',
        recordedBy: 'Maya Krishnan',
        updatedAt: `${date}T10:30:00.000Z`,
      });
    });
  });
  return records;
}

function makeAssessments() {
  return [
    { id: 'ASM-1001', title: 'Linux & Shell Scripting Quiz', description: 'Short practical quiz on navigation, permissions and shell scripts.', batchId: 'BATCH-2026-01', type: 'Quiz', date: addDays(today, -18), maxMarks: 50, passingMarks: 25, status: 'Completed' },
    { id: 'ASM-1002', title: 'Docker Image Build Project', description: 'Build and publish a multi-stage Docker image.', batchId: 'BATCH-2026-01', type: 'Project', date: addDays(today, 3), maxMarks: 100, passingMarks: 40, status: 'Published' },
    { id: 'ASM-1003', title: 'React Fundamentals Test', description: 'Components, props, state and hooks.', batchId: 'BATCH-2026-02', type: 'Written Test', date: addDays(today, -9), maxMarks: 80, passingMarks: 40, status: 'Completed' },
    { id: 'ASM-1004', title: 'REST API Mini Project', description: 'Create a documented REST API with validation and tests.', batchId: 'BATCH-2026-02', type: 'Project', date: addDays(today, 7), maxMarks: 100, passingMarks: 40, status: 'Published' },
    { id: 'ASM-1005', title: 'Kubernetes Deployment Practical', description: 'Deployment, service and ingress configuration.', batchId: 'BATCH-2026-01', type: 'Practical', date: addDays(today, 12), maxMarks: 100, passingMarks: 40, status: 'Draft' },
    { id: 'ASM-1006', title: 'SQL Analytics Case Study', description: 'Data cleaning, joins and dashboard recommendations.', batchId: 'BATCH-2026-03', type: 'Case Study', date: addDays(today, 24), maxMarks: 100, passingMarks: 50, status: 'Draft' },
  ];
}

function makeAssessmentResults(assessments, students) {
  const records = [];
  assessments.filter((assessment) => assessment.status === 'Completed').forEach((assessment) => {
    students.filter((student) => student.batchId === assessment.batchId && student.status !== 'Dropped').forEach((student, index) => {
      const marks = Math.min(assessment.maxMarks, Math.round(assessment.maxMarks * (0.52 + ((index * 7) % 43) / 100)));
      records.push({
        id: `RES-${assessment.id}-${student.id}`.replaceAll('-', ''),
        assessmentId: assessment.id,
        studentId: student.id,
        batchId: assessment.batchId,
        marks,
        maxMarks: assessment.maxMarks,
        percentage: Math.round((marks / assessment.maxMarks) * 100),
        result: marks >= assessment.passingMarks ? 'Pass' : 'Fail',
        remarks: marks >= assessment.passingMarks * 1.5 ? 'Excellent work' : '',
        updatedAt: `${assessment.date}T14:00:00.000Z`,
      });
    });
  });
  return records;
}

function makeTasks() {
  const items = [
    ['Finalize November orientation invites', 'Operations', 'Maya Krishnan', -2, 'High', 'To Do'],
    ['Update DevOps lab software', 'Infrastructure', 'Aarav Menon', -1, 'Urgent', 'In Progress'],
    ['Review student fee receipts', 'Accounts', 'Neha Wilson', 2, 'Medium', 'To Do'],
    ['Publish React assignment rubric', 'Academics', 'Priya Nair', 1, 'High', 'To Do'],
    ['Prepare monthly placement report', 'Reporting', 'Maya Krishnan', 4, 'Medium', 'In Progress'],
    ['Order new studio microphones', 'Infrastructure', 'Rohit Sharma', 8, 'Low', 'To Do'],
    ['Refresh course brochure', 'Marketing', 'Neha Wilson', -5, 'Medium', 'Completed'],
    ['Schedule mock interview panel', 'Placements', 'Priya Nair', 5, 'High', 'In Progress'],
    ['Archive completed batch documents', 'Operations', 'Maya Krishnan', 12, 'Low', 'To Do'],
  ];
  return items.map(([title, category, assignee, offset, priority, status], index) => ({
    id: `TASK-${1001 + index}`,
    title,
    description: `${title}. Keep all stakeholders informed before the deadline.`,
    category,
    assignee,
    dueDate: addDays(today, offset),
    priority,
    status,
    createdAt: addDays(today, -12 + index),
    completedAt: status === 'Completed' ? addDays(today, -5) : null,
  }));
}

function makeTrainerTasks() {
  const items = [
    ['Complete Docker module delivery', 'Syllabus Completion', 'Aarav Menon', 'BATCH-2026-01', 'DevOps', -1, 'Urgent', 'In Progress', 72],
    ['Prepare Kubernetes lab notes', 'Lesson Preparation', 'Aarav Menon', 'BATCH-2026-01', 'DevOps', 2, 'High', 'To Do', 20],
    ['Evaluate Linux scripting quiz', 'Assignment Evaluation', 'Aarav Menon', 'BATCH-2026-01', 'DevOps', -3, 'High', 'Completed', 100],
    ['Submit weekly attendance', 'Attendance Submission', 'Aarav Menon', 'BATCH-2026-01', 'DevOps', 0, 'Medium', 'To Do', 0],
    ['Review capstone project proposals', 'Project Review', 'Priya Nair', 'BATCH-2026-02', 'Full Stack JavaScript', 5, 'High', 'In Progress', 45],
    ['Complete React hooks module', 'Syllabus Completion', 'Priya Nair', 'BATCH-2026-02', 'Full Stack JavaScript', 8, 'Medium', 'To Do', 10],
    ['Evaluate REST API assignment', 'Assignment Evaluation', 'Priya Nair', 'BATCH-2026-02', 'Full Stack JavaScript', -2, 'Urgent', 'In Progress', 60],
    ['Prepare analytics foundation deck', 'Lesson Preparation', 'Rohit Sharma', 'BATCH-2026-03', 'Data Analytics', 9, 'Medium', 'To Do', 0],
    ['Review student dashboard projects', 'Project Review', 'Rohit Sharma', 'BATCH-2026-03', 'Data Analytics', 15, 'Low', 'To Do', 0],
  ];
  return items.map(([title, category, owner, batchId, course, offset, priority, status, progress], index) => ({
    id: `TTASK-${1001 + index}`,
    title,
    category,
    owner,
    trainerId: owner === 'Aarav Menon' ? 'USER-AARAV' : owner === 'Priya Nair' ? 'USER-PRIYA' : 'USER-ROHIT',
    batchId,
    course,
    deadline: addDays(today, offset),
    priority,
    status,
    progress,
    notes: progress >= 100 ? 'Reviewed and shared with students.' : '',
    createdAt: addDays(today, -10 + index),
  }));
}

function makeGroups(students) {
  return [
    {
      id: 'GRP-1001', name: 'CI/CD Builders', description: 'Capstone group focused on deployment pipelines.',
      batchId: 'BATCH-2026-01', project: 'Automated release pipeline', trainerId: 'USER-AARAV', trainer: 'Aarav Menon',
      leaderId: students[0].id, memberIds: [students[0].id, students[1].id, students[2].id, students[3].id],
      status: 'Active', createdAt: addDays(today, -30),
    },
    {
      id: 'GRP-1002', name: 'Kubernetes Navigators', description: 'Container orchestration case study.',
      batchId: 'BATCH-2026-01', project: 'Kubernetes service mesh demo', trainerId: 'USER-AARAV', trainer: 'Aarav Menon',
      leaderId: students[4].id, memberIds: [students[4].id, students[5].id, students[6].id],
      status: 'Active', createdAt: addDays(today, -22),
    },
    {
      id: 'GRP-1003', name: 'React UI Guild', description: 'Frontend product team for the final project.',
      batchId: 'BATCH-2026-02', project: 'Learning management portal', trainerId: 'USER-PRIYA', trainer: 'Priya Nair',
      leaderId: students[9].id, memberIds: [students[9].id, students[10].id, students[11].id, students[12].id],
      status: 'Active', createdAt: addDays(today, -18),
    },
  ];
}

function moduleFrom(index, title, topics, completedCount) {
  return {
    id: `MOD-${index}`,
    title,
    targetHours: 6 + (index % 4) * 2,
    topics: topics.map((topic, topicIndex) => ({
      id: `TOP-${index}-${topicIndex}`,
      title: topic,
      completed: topicIndex < completedCount,
      completionDate: topicIndex < completedCount ? addDays(today, -(30 - index * 2)) : null,
    })),
  };
}

function makeSyllabi() {
  const devOpsModules = [
    ['Introduction to DevOps', ['DevOps culture', 'SDLC and delivery models', 'Roles and tooling']],
    ['Linux Fundamentals', ['File system and permissions', 'Processes and services', 'Shell scripting basics']],
    ['Git and GitHub', ['Branching strategies', 'Pull requests', 'Conflict resolution']],
    ['AWS Fundamentals', ['IAM and EC2', 'S3 and VPC basics', 'Cloud cost awareness']],
    ['Docker', ['Images and containers', 'Dockerfile and Compose', 'Volumes and networking']],
    ['Kubernetes', ['Pods and deployments', 'Services and ingress', 'ConfigMaps and secrets']],
    ['CI/CD with Jenkins and GitHub Actions', ['Pipeline fundamentals', 'Jenkinsfile', 'Actions workflows']],
    ['Terraform', ['Providers and resources', 'State management', 'Modules and workspaces']],
    ['Prometheus and Grafana', ['Metrics and exporters', 'PromQL basics', 'Dashboards and alerts']],
    ['Capstone Project', ['Requirements and design', 'Implementation', 'Presentation and review']],
  ];
  const fullStackModules = [
    ['Web Foundations', ['HTML semantics', 'Modern CSS', 'Accessibility']],
    ['JavaScript Essentials', ['Functions and scope', 'Async JavaScript', 'DOM patterns']],
    ['React', ['Components and props', 'Hooks', 'State management']],
    ['Node and Express', ['REST APIs', 'Middleware', 'Validation']],
    ['Databases and Deployment', ['Relational modeling', 'SQL basics', 'Deployment checklist']],
  ];
  const analyticsModules = [
    ['Data Literacy', ['Data types', 'Business questions', 'Data ethics']],
    ['Spreadsheets and SQL', ['Cleaning data', 'Joins and aggregations', 'Window functions']],
    ['Python for Analysis', ['Pandas', 'Exploratory analysis', 'Visualization']],
    ['Dashboards and Storytelling', ['KPI design', 'Dashboard layout', 'Presenting insights']],
  ];
  const make = (id, course, batchIds, definitions, completedModules) => ({
    id,
    course,
    batchIds,
    description: `Editable ${course} curriculum with module and topic completion tracking.`,
    modules: definitions.map(([title, topics], i) => moduleFrom(`${id}-${i + 1}`, title, topics, i < completedModules ? topics.length : i === completedModules ? 1 : 0)),
    createdAt: addDays(today, -90),
  });
  return [
    make('SYL-DEVOPS', 'DevOps', ['BATCH-2026-01'], devOpsModules, 4),
    make('SYL-FULLSTACK', 'Full Stack JavaScript', ['BATCH-2026-02'], fullStackModules, 2),
    make('SYL-DATA', 'Data Analytics', ['BATCH-2026-03'], analyticsModules, 0),
  ];
}

export async function createSeedState() {
  const users = await Promise.all([
    makeUser('USER-ADMIN', 'Maya Krishnan', 'admin@edutrack.demo', 'Admin', '+91 98450 11223'),
    makeUser('USER-AARAV', 'Aarav Menon', 'aarav@edutrack.demo', 'Trainer', '+91 98450 22334'),
    makeUser('USER-PRIYA', 'Priya Nair', 'priya@edutrack.demo', 'Trainer', '+91 98450 33445'),
    makeUser('USER-ROHIT', 'Rohit Sharma', 'rohit@edutrack.demo', 'Trainer', '+91 98450 44556'),
    makeUser('USER-NEHA', 'Neha Wilson', 'viewer@edutrack.demo', 'Read-Only', '+91 98450 55667'),
  ]);
  const students = makeStudents();
  const batches = makeBatches(students);
  const assessments = makeAssessments();
  return {
    schemaVersion: STATE_VERSION,
    demo: true,
    updatedAt: new Date().toISOString(),
    users: users.map(({ passwordHash, passwordSalt, passwordIterations, passwordAlgorithm, ...user }) => user),
    credentials: users.map(({ id, passwordHash, passwordSalt, passwordIterations, passwordAlgorithm }) => ({ id: `CRED-${id}`, userId: id, passwordHash, passwordSalt, passwordIterations, passwordAlgorithm })),
    batches,
    students,
    attendance: makeAttendance(students),
    assessments,
    assessmentResults: makeAssessmentResults(assessments, students),
    tasks: makeTasks(),
    trainerTasks: makeTrainerTasks(),
    groups: makeGroups(students),
    syllabi: makeSyllabi(),
    meta: {
      institute: {
        name: 'EduTrack Training Institute',
        email: 'hello@edutrack.demo',
        phone: '+91 484 400 1200',
        address: '2nd Floor, Knowledge Park, Kochi, Kerala 682016',
        website: 'edutrack.demo',
        accreditation: 'ISO 9001:2015 Training Center',
      },
      preferences: {
        theme: 'light',
        pageSize: 8,
        dateFormat: 'DD MMM YYYY',
        defaultPassingMarks: 40,
        showDemoLabel: true,
        compactTables: false,
      },
      dashboard: {
        cards: ['totalAdmissions', 'activeBatches', 'totalStudents', 'todayAttendance', 'upcomingAssessments', 'pendingTasks'],
        order: ['totalAdmissions', 'activeBatches', 'totalStudents', 'todayAttendance', 'upcomingAssessments', 'pendingTasks'],
      },
    },
  };
}

export const demoAccounts = [
  { label: 'Administrator', email: 'admin@edutrack.demo', role: 'Admin' },
  { label: 'Trainer', email: 'aarav@edutrack.demo', role: 'Trainer' },
  { label: 'Read-only', email: 'viewer@edutrack.demo', role: 'Read-Only' },
];

export const seededCourseNames = courses;
