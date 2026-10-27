export const ROLES = ['Admin', 'Trainer', 'Read-Only'];

export function isAdmin(user) {
  return user?.role === 'Admin';
}

export function isReadOnly(user) {
  return user?.role === 'Read-Only';
}

export function assignedBatchIds(state, user) {
  if (!user || isAdmin(user) || isReadOnly(user)) return state.batches.map((batch) => batch.id);
  return state.batches
    .filter((batch) => batch.trainerId === user.id || batch.trainer === user.name || batch.trainer === user.email)
    .map((batch) => batch.id);
}

function isOwner(user, value) {
  if (!user || !value) return false;
  return value === user.id || value === user.name || value === user.email;
}

const TRAINER_WRITABLE = new Set([
  'students', 'attendance', 'assessments', 'assessmentResults',
  'tasks', 'trainerTasks', 'groups', 'syllabi',
]);

export function canWriteCollection(user, collection) {
  if (isAdmin(user)) return true;
  if (isReadOnly(user)) return false;
  return TRAINER_WRITABLE.has(collection);
}

export function canMutateRecord(user, state, collection, record, existingRecord = null) {
  if (isAdmin(user)) return { allowed: true };
  if (isReadOnly(user)) return { allowed: false, reason: 'Read-only users cannot modify records.' };
  if (!TRAINER_WRITABLE.has(collection)) return { allowed: false, reason: 'Trainers cannot modify this module.' };
  const target = { ...(existingRecord || {}), ...(record || {}) };
  const batches = new Set(assignedBatchIds(state, user));

  if (collection === 'students') {
    return target.batchId && batches.has(target.batchId)
      ? { allowed: true }
      : { allowed: false, reason: 'Only students in assigned batches can be edited.' };
  }
  if (['attendance', 'assessments', 'assessmentResults'].includes(collection)) {
    return target.batchId && batches.has(target.batchId)
      ? { allowed: true }
      : { allowed: false, reason: 'This record belongs to a batch that is not assigned to you.' };
  }
  if (collection === 'tasks') {
    return isOwner(user, target.assignee) || (existingRecord && isOwner(user, existingRecord.assignee))
      ? { allowed: true }
      : { allowed: false, reason: 'Only the assigned user can change this task.' };
  }
  if (collection === 'trainerTasks') {
    return isOwner(user, target.owner) || isOwner(user, target.trainerId) || (existingRecord && isOwner(user, existingRecord.owner))
      ? { allowed: true }
      : { allowed: false, reason: 'Only the task owner can change this trainer task.' };
  }
  if (collection === 'groups') {
    return (target.batchId && batches.has(target.batchId)) || isOwner(user, target.trainerId)
      ? { allowed: true }
      : { allowed: false, reason: 'Only groups for assigned batches can be edited.' };
  }
  if (collection === 'syllabi') {
    return (target.batchIds || []).some((id) => batches.has(id))
      ? { allowed: true }
      : { allowed: false, reason: 'Only syllabi for assigned batches can be edited.' };
  }
  return { allowed: false, reason: 'You do not have permission for this action.' };
}

export function canManageUsers(user) {
  return isAdmin(user);
}

export function canChangeSettings(user) {
  return isAdmin(user);
}

export function filterStateForUser(state, user) {
  if (!user || isAdmin(user) || isReadOnly(user)) {
    const { credentials, ...safe } = state;
    return safe;
  }
  const batchIds = new Set(assignedBatchIds(state, user));
  const studentIds = new Set(state.students.filter((student) => batchIds.has(student.batchId)).map((student) => student.id));
  const assessmentIds = new Set(state.assessments.filter((assessment) => batchIds.has(assessment.batchId)).map((assessment) => assessment.id));
  const { credentials, ...safe } = state;
  return {
    ...safe,
    batches: state.batches.filter((batch) => batchIds.has(batch.id)),
    students: state.students.filter((student) => studentIds.has(student.id)),
    attendance: state.attendance.filter((record) => batchIds.has(record.batchId) || studentIds.has(record.studentId)),
    assessments: state.assessments.filter((assessment) => assessmentIds.has(assessment.id)),
    assessmentResults: state.assessmentResults.filter((result) => assessmentIds.has(result.assessmentId) || batchIds.has(result.batchId)),
    tasks: state.tasks.filter((task) => isOwner(user, task.assignee) || isOwner(user, task.assignedTo)),
    trainerTasks: state.trainerTasks.filter((task) => isOwner(user, task.owner) || isOwner(user, task.trainerId) || batchIds.has(task.batchId)),
    groups: state.groups.filter((group) => batchIds.has(group.batchId) || isOwner(user, group.trainerId)),
    syllabi: state.syllabi.filter((syllabus) => (syllabus.batchIds || []).some((id) => batchIds.has(id))),
  };
}

export function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, passwordSalt, passwordIterations, passwordAlgorithm, ...safe } = user;
  return safe;
}
