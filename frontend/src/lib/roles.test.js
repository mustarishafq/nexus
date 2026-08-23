import assert from 'node:assert/strict';
import { test } from 'node:test';
import { can, canViewGames } from './roles.js';
import { buildDesktopNavItems, buildMobileMoreItems } from '../components/layout/navItems.js';

test('canViewGames is quiz.view only', () => {
	assert.equal(canViewGames({ permissions: ['quiz.view'] }), true);
	assert.equal(canViewGames({ permissions: ['quiz.create', 'quiz.manage_own', 'quiz.manage'] }), false);
	assert.equal(canViewGames({ permissions: [] }), false);
	assert.equal(canViewGames(null), false);
	assert.equal(can({ permissions: ['quiz.view'] }, 'quiz.view'), true);
});

test('desktop and mobile nav hide Games without quiz.view', () => {
	const hidden = {
		showAnalytics: false,
		isAdmin: false,
		canManageUsers: false,
		canBroadcast: false,
		canViewNetwork: false,
		canViewGames: false,
	};
	const shown = { ...hidden, canViewGames: true };

	assert.equal(buildDesktopNavItems(hidden).some((item) => item.path === '/games'), false);
	assert.equal(buildMobileMoreItems(hidden).some((item) => item.path === '/games'), false);
	assert.equal(buildDesktopNavItems(shown).some((item) => item.path === '/games' && item.label === 'Games'), true);
	assert.equal(buildMobileMoreItems(shown).some((item) => item.path === '/games' && item.label === 'Games'), true);
});
