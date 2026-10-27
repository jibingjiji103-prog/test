import {
  BookOpen, CalendarCheck2, ClipboardList, GraduationCap, LayoutDashboard,
  ListTodo, Settings, Users, UsersRound, ChartNoAxesCombined, Layers3, Presentation,
} from 'lucide-react';

export const NAV_ITEMS = [
  { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, group: 'main' },
  { label: 'Batches', path: '/batches', icon: Layers3, group: 'main' },
  { label: 'Students', path: '/students', icon: Users, group: 'main' },
  { label: 'Attendance', path: '/attendance', icon: CalendarCheck2, group: 'main' },
  { label: 'Assessments', path: '/assessments', icon: ClipboardList, group: 'main' },
  { label: 'Tasks', path: '/tasks', icon: ListTodo, group: 'main' },
  { label: 'Trainer Tasks', path: '/trainer-tasks', icon: Presentation, group: 'main' },
  { label: 'Groups', path: '/groups', icon: UsersRound, group: 'main' },
  { label: 'Syllabi', path: '/syllabi', icon: BookOpen, group: 'main' },
  { label: 'Reports', path: '/reports', icon: ChartNoAxesCombined, group: 'main' },
];

export const SETTINGS_ITEM = { label: 'Settings', path: '/settings', icon: Settings, group: 'bottom' };

export const ALL_NAV_ITEMS = [...NAV_ITEMS, SETTINGS_ITEM];

export const PAGE_META = Object.fromEntries(ALL_NAV_ITEMS.map((item) => [item.path, {
  title: item.label,
  icon: item.icon,
  subtitle: {
    '/dashboard': 'Institute overview and daily priorities',
    '/batches': 'Manage cohorts, trainers and schedules',
    '/students': 'Admissions, profiles and enrollment records',
    '/attendance': 'Daily attendance and historical records',
    '/assessments': 'Tests, projects and student results',
    '/tasks': 'Operational work across the institute',
    '/trainer-tasks': 'Trainer responsibilities and academic delivery',
    '/groups': 'Student groups, projects and mentors',
    '/syllabi': 'Course curricula and lesson completion',
    '/reports': 'Data-driven institute performance reports',
    '/settings': 'Institute, users, roles and preferences',
  }[item.path],
}]));

export const ROLE_ICON = GraduationCap;
