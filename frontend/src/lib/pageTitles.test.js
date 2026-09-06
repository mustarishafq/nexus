import assert from 'node:assert/strict';
import { test } from 'node:test';
import { formatDocumentTitle, getPageTitle } from './pageTitles.js';

test('getPageTitle maps each module path to its page heading', () => {
  const cases = [
    ['/', 'Dashboard'],
    ['/feed', 'Company Feed'],
    ['/messages', 'Messages'],
    ['/messages/12', 'Messages'],
    ['/email', 'Email'],
    ['/email/compose', 'Email'],
    ['/people', 'People'],
    ['/people/42', 'People'],
    ['/users/1/dashboard', 'People'],
    ['/organization', 'Organization'],
    ['/notifications', 'Notification Center'],
    ['/activity', 'Activity Timeline'],
    ['/network-health', 'Network Health'],
    ['/attendance', 'Attendance'],
    ['/attendance/records', 'Attendance'],
    ['/missions', 'Missions'],
    ['/leaderboard', 'Missions'],
    ['/analytics', 'Analytics'],
    ['/applications', 'Applications'],
    ['/applications/usage', 'Applications'],
    ['/applications/9/view', 'Applications'],
    ['/admin/broadcast', 'Broadcast Center'],
    ['/admin/events', 'System Events'],
    ['/admin/users', 'User Management'],
    ['/calendar', 'Calendar'],
    ['/calendar/events/3/attendance', 'Calendar'],
    ['/games', 'Games'],
    ['/games/new', 'Games'],
    ['/games/5/edit', 'Games'],
    ['/scan-qr', 'Scan QR'],
    ['/settings', 'Settings'],
    ['/profile', 'Profile'],
    ['/login', 'Login'],
    ['/register', 'Register'],
    ['/forgot-password', 'Forgot Password'],
    ['/reset-password', 'Reset Password'],
    ['/admin/settings', 'Settings'],
    ['/admin/calendar', 'Calendar'],
    ['/people/org-chart', 'Organization'],
    ['/mcp-consent', 'Connect'],
    ['/event-check-in/abc', 'Event Check-in'],
    ['/quiz-join/xyz', 'Join Game'],
    ['/does-not-exist', 'Page not found'],
  ];

  for (const [path, expected] of cases) {
    assert.equal(getPageTitle(path), expected, path);
  }
});

test('getPageTitle uses Change Password while a forced reset is required', () => {
  assert.equal(getPageTitle('/settings', { forcePasswordChange: true }), 'Change Password');
});

test('formatDocumentTitle is Page - System name', () => {
  assert.equal(formatDocumentTitle('Dashboard', 'EMZI Nexus Brain'), 'Dashboard - EMZI Nexus Brain');
  assert.equal(formatDocumentTitle('People', 'Nexus'), 'People - Nexus');
  assert.equal(formatDocumentTitle('', 'Nexus'), 'Nexus');
  assert.equal(formatDocumentTitle('Nexus', 'Nexus'), 'Nexus');
});
