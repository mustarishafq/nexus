// @ts-nocheck
import { clearBirthdayShownKeys } from '@/lib/birthday';
import { clearBroadcastAckKeys } from '@/lib/broadcast';
import { clearAuthToken, clearImpersonationSession, getAuthToken, setAuthToken } from '@/lib/authStorage';

export const API_ORIGIN = `${import.meta.env.VITE_API_BASE_URL || ''}`.replace(/\/$/, '');
const API_BASE_URL = `${import.meta.env.VITE_API_BASE_URL || ''}/api`;

const ENTITY_ENDPOINTS = {
	User: 'users',
	Application: 'applications',
	UserSystemAccess: 'user-system-accesses',
	AccessGroup: 'access-groups',
	MetabaseDashboard: 'metabase-dashboards',
	Broadcast: 'broadcasts',
	Notification: 'notifications',
	SystemEvent: 'system-events',
	CalendarEvent: 'calendar-events',
	ActivityLog: 'activity-logs',
	ApplicationReleaseNote: 'application-release-notes',
	PlatformReleaseNote: 'platform-release-notes',
};

function normalizeBody(data) {
	if (!data || typeof data !== 'object') return data;

	const normalized = { ...data };

	// Keep compatibility with legacy pages that still pass JSON strings.
	if (typeof normalized.notification_settings === 'string') {
		try {
			normalized.notification_settings = JSON.parse(normalized.notification_settings);
		} catch {
			// Keep original value if parsing fails.
		}
	}

	return normalized;
}

async function request(path, { method = 'GET', body, headers = {} } = {}) {
	const token = getAuthToken();
	const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};
	const hasBody = body !== undefined;

	const response = await fetch(`${API_BASE_URL}${path}`, {
		method,
		headers: {
			Accept: 'application/json',
			...(hasBody ? { 'Content-Type': 'application/json' } : {}),
			...authHeaders,
			...headers,
		},
		body: hasBody ? JSON.stringify(normalizeBody(body)) : undefined,
		credentials: 'include',
	});

	if (response.status === 204) {
		return null;
	}

	let payload = null;
	try {
		payload = await response.json();
	} catch {
		payload = null;
	}

	if (!response.ok) {
		const validationMessage = payload?.errors
			? Object.values(payload.errors).flat().join(' ')
			: null;
		const error = new Error(payload?.message || validationMessage || `HTTP ${response.status}`);
		error.status = response.status;
		error.data = payload;
		throw error;
	}

	return payload;
}

function buildQuery(params) {
	const search = new URLSearchParams();

	Object.entries(params || {}).forEach(([key, value]) => {
		if (value === undefined || value === null) return;
		if (Array.isArray(value)) {
			value.forEach((entry) => search.append(key, String(entry)));
			return;
		}
		search.append(key, String(value));
	});

	const queryString = search.toString();
	return queryString ? `?${queryString}` : '';
}

function createEntityClient(entityName) {
	const endpoint = ENTITY_ENDPOINTS[entityName];
	if (!endpoint) {
		throw new Error(`Unsupported entity: ${entityName}`);
	}

	return {
		async list(sort, limit) {
			const query = buildQuery({ sort, limit });
			const payload = await request(`/${endpoint}${query}`);
			return Array.isArray(payload) ? payload : [];
		},

		async filter(filters = {}, sort, limit) {
			const query = buildQuery({ ...filters, sort, limit });
			const payload = await request(`/${endpoint}${query}`);
			return Array.isArray(payload) ? payload : [];
		},

		async listAdmin(sort, limit) {
			const query = buildQuery({ admin: true, sort, limit });
			const payload = await request(`/${endpoint}${query}`);
			return Array.isArray(payload) ? payload : [];
		},

		async get(id) {
			return request(`/${endpoint}/${id}`);
		},

		async create(data) {
			return request(`/${endpoint}`, { method: 'POST', body: data });
		},

		async update(id, data) {
			return request(`/${endpoint}/${id}`, { method: 'PATCH', body: data });
		},

		async delete(id) {
			return request(`/${endpoint}/${id}`, { method: 'DELETE' });
		},

		subscribe() {
			return () => {};
		},
	};
}

export const db = {
	auth: {
		async register(data) {
			return request('/auth/register', { method: 'POST', body: data });
		},

		async login(data, { remember = true } = {}) {
			const payload = await request('/auth/login', { method: 'POST', body: data });
			if (payload?.token) {
				setAuthToken(payload.token, { remember });
			}
			return payload;
		},

		async forgotPassword(data) {
			return request('/auth/forgot-password', { method: 'POST', body: data });
		},

		async resetPassword(data) {
			return request('/auth/reset-password', { method: 'POST', body: data });
		},

		async resetPassword(data) {
			return request('/auth/reset-password', { method: 'POST', body: data });
		},

		async isAuthenticated() {
			try {
				await request('/me');
				return true;
			} catch {
				return false;
			}
		},

		async me() {
			return request('/me');
		},

		async updateMe(data) {
			return request('/me', { method: 'PATCH', body: data });
		},

		async logout(redirectTo = '/login') {
			try {
				await request('/auth/logout', { method: 'POST' });
			} catch {
				// Always clear client token even if backend revoke fails.
			}

			clearAuthToken();
			clearImpersonationSession();
			clearBirthdayShownKeys();
			clearBroadcastAckKeys();
			if (redirectTo) {
				window.location.href = redirectTo;
			}
		},

		async impersonate(userId) {
			return request(`/admin/impersonate/${encodeURIComponent(userId)}`, { method: 'POST' });
		},

		async stopImpersonate() {
			return request('/admin/impersonate/stop', { method: 'POST' });
		},

		redirectToLogin(redirectTo = '/login') {
			window.location.href = redirectTo || '/login';
		},
	},

	oauth: {
		async getClient(clientId, redirectUri) {
			const query = redirectUri ? `?redirect_uri=${encodeURIComponent(redirectUri)}` : '';
			return request(`/oauth/clients/${encodeURIComponent(clientId)}${query}`);
		},

		async decide(payload) {
			return request('/oauth/authorize/decide', { method: 'POST', body: payload });
		},
	},

	appSettings: {
		async public() {
			return request('/app-settings');
		},

		async admin() {
			return request('/admin/app-settings');
		},

		async update(data) {
			return request('/admin/app-settings', { method: 'PATCH', body: data });
		},
	},

	pushSubscriptions: {
		async list() {
			return request('/push-subscriptions');
		},

		async upsert(data) {
			return request('/push-subscriptions', { method: 'POST', body: data });
		},

		async remove(data) {
			return request('/push-subscriptions', { method: 'DELETE', body: data });
		},
	},

	networkHealth: {
		async ping() {
			return request('/network-health/ping');
		},

		async clientInfo() {
			return request('/network-health/client-info');
		},

		async saveLog(data) {
			return request('/network-health/logs', { method: 'POST', body: data });
		},

		async dashboard(filters = {}) {
			const query = buildQuery(filters);
			return request(`/network-health/dashboard${query}`);
		},

		async userHistory(userId) {
			return request(`/network-health/users/${userId}/history`);
		},

		async acknowledgeAlert(alertId) {
			return request(`/network-health/alerts/${alertId}/acknowledge`, { method: 'PATCH' });
		},

		async acknowledgeAllAlerts() {
			return request('/network-health/alerts/acknowledge-all', { method: 'PATCH' });
		},

		async exportCsv(filters = {}) {
			const token = getAuthToken();
			const query = buildQuery(filters);
			const response = await fetch(`${API_BASE_URL}/network-health/export${query}`, {
				method: 'GET',
				headers: {
					Accept: 'text/csv',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: 'include',
			});

			if (!response.ok) {
				let payload = null;
				try {
					payload = await response.json();
				} catch {
					payload = null;
				}
				const error = new Error(payload?.message || `HTTP ${response.status}`);
				error.status = response.status;
				error.data = payload;
				throw error;
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `network-health-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		},
	},

	departmentAttendance: {
		async list() {
			return request('/admin/department-attendance');
		},

		async get(departmentId) {
			return request(`/admin/department-attendance/${departmentId}`);
		},

		async update(departmentId, data) {
			return request(`/admin/department-attendance/${departmentId}`, { method: 'PUT', body: data });
		},

		async bulkUpdate(data) {
			return request('/admin/department-attendance', { method: 'PUT', body: data });
		},
	},

	attendanceLocations: {
		async list() {
			return request('/admin/attendance-locations');
		},

		async create(data) {
			return request('/admin/attendance-locations', { method: 'POST', body: data });
		},

		async update(locationId, data) {
			return request(`/admin/attendance-locations/${locationId}`, { method: 'PUT', body: data });
		},

		async delete(locationId) {
			return request(`/admin/attendance-locations/${locationId}`, { method: 'DELETE' });
		},
	},

	attendance: {
		async status() {
			return request('/attendance/status');
		},

		async myHistory(filters = {}) {
			const query = buildQuery(filters);
			return request(`/attendance/my-history${query}`);
		},

		async clock(data) {
			return request('/attendance/clock', { method: 'POST', body: data });
		},

		async dashboard(filters = {}) {
			const query = buildQuery(filters);
			return request(`/attendance/dashboard${query}`);
		},

		async exportCsv(filters = {}) {
			const token = getAuthToken();
			const query = buildQuery(filters);
			const response = await fetch(`${API_BASE_URL}/attendance/export${query}`, {
				method: 'GET',
				headers: {
					Accept: 'text/csv',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: 'include',
			});

			if (!response.ok) {
				let payload = null;
				try {
					payload = await response.json();
				} catch {
					payload = null;
				}
				const error = new Error(payload?.message || `HTTP ${response.status}`);
				error.status = response.status;
				error.data = payload;
				throw error;
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `attendance-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		},

		async userHistory(userId, filters = {}) {
			const query = buildQuery(filters);
			return request(`/attendance/users/${userId}/history${query}`);
		},

		async reverseGeocode({ latitude, longitude }) {
			const query = buildQuery({ latitude, longitude });
			return request(`/attendance/reverse-geocode${query}`);
		},

        async fetchWatermarkLogo(path) {
			const token = getAuthToken();
			const query = buildQuery({ path });
			const response = await fetch(`${API_BASE_URL}/attendance/watermark-logo${query}`, {
				method: 'GET',
				headers: {
					Accept: 'image/*',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: 'include',
			});

			if (!response.ok) {
				let payload = null;
				try {
					payload = await response.json();
				} catch {
					payload = null;
				}
				const error = new Error(payload?.message || `HTTP ${response.status}`);
				error.status = response.status;
				error.data = payload;
				throw error;
			}

			return response.blob();
		},
	},

	eventCheckIn: {
		async show(token) {
			return request(`/event-check-in/${encodeURIComponent(token)}`);
		},

		async checkIn(token, data) {
			return request(`/event-check-in/${encodeURIComponent(token)}`, {
				method: 'POST',
				body: data,
			});
		},

		async checkInMe(token, data) {
			return request(`/event-check-in/${encodeURIComponent(token)}/me`, {
				method: 'POST',
				body: data || {},
			});
		},

		async listAttendances(eventId) {
			return request(`/calendar-events/${eventId}/attendances`);
		},

		async listSeriesOccurrences(eventId) {
			return request(`/calendar-events/${eventId}/series-occurrences`);
		},

		async exportAttendancesCsv(eventId) {
			const token = getAuthToken();
			const response = await fetch(`${API_BASE_URL}/calendar-events/${eventId}/attendances/export`, {
				method: 'GET',
				headers: {
					Accept: 'text/csv',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
				credentials: 'include',
			});

			if (!response.ok) {
				let payload = null;
				try {
					payload = await response.json();
				} catch {
					payload = null;
				}
				const error = new Error(payload?.message || `HTTP ${response.status}`);
				error.status = response.status;
				error.data = payload;
				throw error;
			}

			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = url;
			link.download = `event-attendance-${eventId}-${new Date().toISOString().slice(0, 10)}.csv`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			window.URL.revokeObjectURL(url);
		},
	},

	quizzes: {
		async list({ scope } = {}) {
			const query = buildQuery({ scope });
			return request(`/quizzes${query}`);
		},

		async get(id) {
			return request(`/quizzes/${id}`);
		},

		async create(data) {
			return request('/quizzes', { method: 'POST', body: data });
		},

		async update(id, data) {
			return request(`/quizzes/${id}`, { method: 'PUT', body: data });
		},

		async delete(id) {
			return request(`/quizzes/${id}`, { method: 'DELETE' });
		},

		async attempts(id) {
			return request(`/quizzes/${id}/attempts`);
		},

		async startSession(id, data = {}) {
			return request(`/quizzes/${id}/sessions`, { method: 'POST', body: data });
		},
	},

	quizSessions: {
		async join(pin) {
			return request('/quiz-sessions/join', { method: 'POST', body: { pin } });
		},

		async get(id) {
			return request(`/quiz-sessions/${id}`);
		},

		async start(id) {
			return request(`/quiz-sessions/${id}/start`, { method: 'POST' });
		},

		async reveal(id) {
			return request(`/quiz-sessions/${id}/reveal`, { method: 'POST' });
		},

		async leaderboard(id) {
			return request(`/quiz-sessions/${id}/leaderboard`, { method: 'POST' });
		},

		async next(id) {
			return request(`/quiz-sessions/${id}/next`, { method: 'POST' });
		},

		async end(id) {
			return request(`/quiz-sessions/${id}/end`, { method: 'POST' });
		},

		async leave(id) {
			return request(`/quiz-sessions/${id}/leave`, { method: 'POST' });
		},

		async heartbeat(id) {
			return request(`/quiz-sessions/${id}/heartbeat`, { method: 'POST' });
		},

		async answer(id, optionId) {
			return request(`/quiz-sessions/${id}/answer`, {
				method: 'POST',
				body: { option_id: optionId },
			});
		},

		async powerUp(id, type) {
			return request(`/quiz-sessions/${id}/power-ups`, {
				method: 'POST',
				body: { type },
			});
		},

		async music(id, enabledOrSettings) {
			const body = typeof enabledOrSettings === 'boolean'
				? { enabled: enabledOrSettings }
				: enabledOrSettings;
			return request(`/quiz-sessions/${id}/music`, {
				method: 'POST',
				body,
			});
		},

		async analytics(id) {
			return request(`/quiz-sessions/${id}/analytics`);
		},

		async showByToken(token) {
			return request(`/quiz-join/${encodeURIComponent(token)}`);
		},
	},

	dashboard: {
		async celebrations({ date } = {}) {
			const query = date ? `?date=${encodeURIComponent(date)}` : '';
			return request(`/dashboard/celebrations${query}`);
		},

		async actionItems({ limit } = {}) {
			const query = buildQuery({ limit });
			const payload = await request(`/dashboard/action-items${query}`);
			return Array.isArray(payload) ? payload : [];
		},

		async completeActionItem(id) {
			return request(`/dashboard/action-items/${id}/complete`, { method: 'PATCH' });
		},

        async sendReaction(data) {
			return request('/dashboard/celebrations/wishes', { method: 'POST', body: data });
		},

		async removeReaction(reactionId) {
			return request(`/dashboard/celebrations/wishes/${reactionId}`, { method: 'DELETE' });
		},
	},

	gamification: {
		async me() {
			return request('/gamification/me');
		},

		async missions() {
			return request('/gamification/missions');
		},

		async rewards(filters = {}) {
			const query = buildQuery(filters);
			return request(`/gamification/rewards${query}`);
		},

		async claim(rewardId) {
			return request(`/gamification/rewards/${rewardId}/claim`, { method: 'POST' });
		},

		async claimAll() {
			return request('/gamification/rewards/claim-all', { method: 'POST' });
		},

		async leaderboard(filters = {}) {
			const query = buildQuery(filters);
			return request(`/gamification/leaderboard${query}`);
		},
	},

	feed: {
		async list({ limit, focusPost, authorUserId, before } = {}) {
			const queryString = buildQuery({
				limit,
				focus_post: focusPost,
				author_user_id: authorUserId,
				before,
			});
			return request(`/feed${queryString}`);
		},

		async activeDiscussions({ limit } = {}) {
			return request(`/feed/active${buildQuery({ limit })}`);
		},

		async createPost({ body = '', image_url = null, image_urls = null, poll = null, polls = null } = {}) {
			const urls = Array.isArray(image_urls)
				? image_urls.filter(Boolean)
				: image_url
					? [image_url]
					: [];

			const payload = {
				body,
				image_url: urls[0] || null,
				image_urls: urls,
			};

			const normalizePoll = (entry) => {
				if (!entry || !Array.isArray(entry.options)) return null;
				const options = entry.options
					.map((option) => {
						if (typeof option === 'string') return option.trim();
						if (option && typeof option === 'object') return String(option.label || '').trim();
						return '';
					})
					.filter(Boolean);
				if (options.length < 2) return null;
				const isQna = Boolean(entry.is_qna);
				const correctIndex = entry.correct_option_index == null || entry.correct_option_index === ''
					? null
					: Number(entry.correct_option_index);
				return {
					options,
					allow_multiple: isQna ? false : Boolean(entry.allow_multiple),
					allow_add_options: isQna ? false : Boolean(entry.allow_add_options),
					is_qna: isQna,
					correct_option_index: isQna && Number.isInteger(correctIndex) ? correctIndex : null,
				};
			};

			const normalizedPolls = (Array.isArray(polls) ? polls : [])
				.map(normalizePoll)
				.filter(Boolean);

			if (normalizedPolls.length > 0) {
				payload.polls = normalizedPolls;
			} else {
				const single = normalizePoll(poll);
				if (single) {
					payload.poll = single;
				}
			}

			return request('/posts', {
				method: 'POST',
				body: payload,
			});
		},

		async voteOnPoll(postId, pollId, optionId) {
			return request(`/posts/${postId}/polls/${pollId}/vote`, {
				method: 'POST',
				body: { option_id: optionId },
			});
		},

		async addPollOption(postId, pollId, label) {
			return request(`/posts/${postId}/polls/${pollId}/options`, {
				method: 'POST',
				body: { label },
			});
		},

		async updatePoll(postId, pollId, { options, allow_multiple, allow_add_options, is_qna } = {}) {
			return request(`/posts/${postId}/polls/${pollId}`, {
				method: 'PUT',
				body: {
					options,
					allow_multiple,
					allow_add_options,
					is_qna,
				},
			});
		},

		async createPoll(postId, { options, allow_multiple, allow_add_options, is_qna, correct_option_index } = {}) {
			return request(`/posts/${postId}/polls`, {
				method: 'POST',
				body: {
					options,
					allow_multiple,
					allow_add_options,
					is_qna,
					correct_option_index,
				},
			});
		},

		async deletePoll(postId, pollId) {
			return request(`/posts/${postId}/polls/${pollId}`, {
				method: 'DELETE',
			});
		},

		async updatePost(postId, { body = '' } = {}) {
			return request(`/posts/${postId}`, {
				method: 'PUT',
				body: { body },
			});
		},

		async listPostEdits(postId) {
			return request(`/posts/${postId}/edits`);
		},

		async markPostsSeen(postIds) {
			const ids = Array.isArray(postIds) ? postIds.filter(Boolean) : [];
			if (ids.length === 0) {
				return { marked_post_ids: [] };
			}

			return request('/posts/seen', {
				method: 'POST',
				body: { post_ids: ids },
			});
		},

		async markPostSeen(postId) {
			return request(`/posts/${postId}/seen`, { method: 'POST' });
		},

		async listPostSeen(postId) {
			return request(`/posts/${postId}/seen`);
		},

		async listPostReaches(postId) {
			return request(`/posts/${postId}/reaches`);
		},

		async approvePost(postId) {
			return request(`/posts/${postId}/approve`, { method: 'POST' });
		},

		async rejectPost(postId) {
			return request(`/posts/${postId}/reject`, { method: 'POST' });
		},

		async deletePost(postId) {
			return request(`/posts/${postId}`, { method: 'DELETE' });
		},

		async listComments(postId) {
			return request(`/posts/${postId}/comments`);
		},

		async createComment(postId, body, parentCommentId = null) {
			return request(`/posts/${postId}/comments`, {
				method: 'POST',
				body: {
					body,
					...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
				},
			});
		},

		async deleteComment(commentId) {
			return request(`/post-comments/${commentId}`, { method: 'DELETE' });
		},

		async reactToPost(postId, reaction) {
			return request(`/posts/${postId}/reactions`, { method: 'POST', body: { reaction } });
		},

		async removeReaction(postId) {
			return request(`/posts/${postId}/reactions`, { method: 'DELETE' });
		},

		async reactToComment(commentId, reaction) {
			return request(`/post-comments/${commentId}/reactions`, { method: 'POST', body: { reaction } });
		},

		async removeCommentReaction(commentId) {
			return request(`/post-comments/${commentId}/reactions`, { method: 'DELETE' });
		},
	},

	profileMedia: {
		async get(userId, mediaType) {
			return request(`/users/${userId}/profile-media/${mediaType}`);
		},

		async react(userId, mediaType, reaction) {
			return request(`/users/${userId}/profile-media/${mediaType}/reactions`, {
				method: 'POST',
				body: { reaction },
			});
		},

		async removeReaction(userId, mediaType) {
			return request(`/users/${userId}/profile-media/${mediaType}/reactions`, {
				method: 'DELETE',
			});
		},

		async listComments(userId, mediaType) {
			return request(`/users/${userId}/profile-media/${mediaType}/comments`);
		},

		async createComment(userId, mediaType, body, parentCommentId = null) {
			return request(`/users/${userId}/profile-media/${mediaType}/comments`, {
				method: 'POST',
				body: {
					body,
					...(parentCommentId ? { parent_comment_id: parentCommentId } : {}),
				},
			});
		},

		async deleteComment(commentId) {
			return request(`/profile-media-comments/${commentId}`, { method: 'DELETE' });
		},

		async reactToComment(commentId, reaction) {
			return request(`/profile-media-comments/${commentId}/reactions`, {
				method: 'POST',
				body: { reaction },
			});
		},

		async removeCommentReaction(commentId) {
			return request(`/profile-media-comments/${commentId}/reactions`, {
				method: 'DELETE',
			});
		},
	},

	messages: {
		async listConversations() {
			return request('/conversations');
		},

		async startConversation(recipientUserId, body) {
			return request('/conversations', {
				method: 'POST',
				body: {
					recipient_user_id: recipientUserId,
					...(body ? { body } : {}),
				},
			});
		},

		async getThread(conversationId) {
			return request(`/conversations/${conversationId}/messages`);
		},

		async sendMessage(conversationId, body) {
			return request(`/conversations/${conversationId}/messages`, {
				method: 'POST',
				body: { body },
			});
		},

		async markRead(conversationId) {
			return request(`/conversations/${conversationId}/read`, { method: 'PATCH' });
		},

		async deleteConversation(conversationId) {
			return request(`/conversations/${conversationId}`, { method: 'DELETE' });
		},
	},

	mail: {
		async status(accountId) {
			return request(`/mail/status${buildQuery({ account_id: accountId || undefined })}`);
		},

		async unreadCount({ accountId, folder, fresh } = {}) {
			return request(`/mail/unread-count${buildQuery({
				account_id: accountId || undefined,
				folder: folder || undefined,
				fresh: fresh ? 1 : undefined,
			})}`);
		},

		async connect({ password, email, label } = {}) {
			return request('/mail/connect', {
				method: 'POST',
				body: {
					password,
					...(email ? { email } : {}),
					...(label ? { label } : {}),
				},
			});
		},

		async disconnect(accountId) {
			return request(`/mail/disconnect${buildQuery({ account_id: accountId || undefined })}`, {
				method: 'DELETE',
			});
		},

		async setPrimary(accountId) {
			return request('/mail/accounts/primary', {
				method: 'POST',
				body: { account_id: accountId },
			});
		},

		async listMessages({ limit = 50, q, unread, accountId, folder } = {}) {
			return request(`/mail/messages${buildQuery({
				limit,
				q,
				unread: unread ? 1 : undefined,
				account_id: accountId || undefined,
				folder: folder || undefined,
			})}`);
		},

		async getMessage(uid, { accountId, folder } = {}) {
			return request(`/mail/messages/${uid}${buildQuery({
				account_id: accountId || undefined,
				folder: folder || undefined,
			})}`);
		},

		async downloadAttachment(uid, part, { accountId, folder, filename } = {}) {
			const token = getAuthToken();
			const response = await fetch(`${API_BASE_URL}/mail/messages/${uid}/attachments/${encodeURIComponent(part)}${buildQuery({
				account_id: accountId || undefined,
				folder: folder || undefined,
			})}`, {
				method: 'GET',
				credentials: 'include',
				headers: {
					Accept: '*/*',
					...(token ? { Authorization: `Bearer ${token}` } : {}),
				},
			});

			if (!response.ok) {
				let message = `HTTP ${response.status}`;
				try {
					const payload = await response.json();
					message = payload?.message || message;
				} catch {
					// keep status message
				}
				const error = new Error(message);
				error.status = response.status;
				throw error;
			}

			const blob = await response.blob();
			const objectUrl = URL.createObjectURL(blob);
			const link = document.createElement('a');
			link.href = objectUrl;
			link.download = filename || `attachment-${part}`;
			document.body.appendChild(link);
			link.click();
			link.remove();
			URL.revokeObjectURL(objectUrl);
		},

		async deleteMessage(uid, { accountId, folder } = {}) {
			return request(`/mail/messages/${uid}${buildQuery({
				account_id: accountId || undefined,
				folder: folder || undefined,
			})}`, { method: 'DELETE' });
		},

		async markUnread(uid, { accountId, folder } = {}) {
			return request(`/mail/messages/${uid}/unread${buildQuery({
				account_id: accountId || undefined,
				folder: folder || undefined,
			})}`, { method: 'PATCH' });
		},

		async recipientSuggestions({ q, limit = 8 } = {}) {
			return request(`/mail/recipient-suggestions${buildQuery({
				q,
				limit,
			})}`);
		},

		async saveDraft(payload = {}) {
			return request('/mail/drafts', {
				method: 'PUT',
				body: {
					to: payload.to || '',
					cc: payload.cc || undefined,
					subject: payload.subject || '',
					body: payload.body || '',
					in_reply_to: payload.in_reply_to || undefined,
					references: payload.references || undefined,
					account_id: payload.accountId || payload.account_id || undefined,
					uid: payload.uid || undefined,
				},
			});
		},

		async deleteDraft(uid, { accountId } = {}) {
			return request(`/mail/drafts/${uid}${buildQuery({
				account_id: accountId || undefined,
			})}`, { method: 'DELETE' });
		},

		async send(payload) {
			const { attachments = [], ...fields } = payload || {};

			if (attachments.length > 0) {
				const formData = new FormData();
				Object.entries(fields).forEach(([key, value]) => {
					if (value !== undefined && value !== null && value !== '') {
						formData.append(key, String(value));
					}
				});
				attachments.forEach((file) => formData.append('attachments[]', file));

				const token = getAuthToken();
				const response = await fetch(`${API_BASE_URL}/mail/send`, {
					method: 'POST',
					body: formData,
					credentials: 'include',
					headers: {
						Accept: 'application/json',
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
				});

				if (response.status === 204) {
					return null;
				}

				let result = null;
				try {
					result = await response.json();
				} catch {
					result = null;
				}

				if (!response.ok) {
					const validationMessage = result?.errors
						? Object.values(result.errors).flat().join(' ')
						: null;
					const error = new Error(result?.message || validationMessage || `HTTP ${response.status}`);
					error.status = response.status;
					error.data = result;
					throw error;
				}

				return result;
			}

			return request('/mail/send', { method: 'POST', body: fields });
		},
	},

	googleOAuth: {
		async status() {
			return request('/google/oauth/status');
		},

		async connect() {
			return request('/google/oauth/connect', { method: 'POST' });
		},

		async disconnect() {
			return request('/google/oauth/disconnect', { method: 'DELETE' });
		},
	},

	entities: new Proxy(
		{},
		{
			get(_target, prop) {
				return createEntityClient(String(prop));
			},
		}
	),

	integrations: {
		Core: {
			async UploadFile({ file, folder = 'uploads' } = {}) {
				if (!file) {
					throw new Error('UploadFile requires a file parameter.');
				}

				const formData = new FormData();
				formData.append('file', file);
				formData.append('folder', folder);

				const token = getAuthToken();
				const response = await fetch(`${API_BASE_URL}/uploads`, {
					method: 'POST',
					body: formData,
					credentials: 'include',
					headers: {
						Accept: 'application/json',
						...(token ? { Authorization: `Bearer ${token}` } : {}),
					},
				});

				let payload = null;
				try {
					payload = await response.json();
				} catch {
					payload = null;
				}

				if (!response.ok) {
					const error = new Error(payload?.message || `HTTP ${response.status}`);
					error.status = response.status;
					error.data = payload;
					throw error;
				}

				return payload;
			},
		},
	},

	/**
	 * Request a signed SSO launch URL for an application.
	 * Returns { launch_url, token, expires_in }.
	 * Open launch_url in a new tab to auto-login the user.
	 */
	async launchSystem(systemId, { redirect_to, sso_email } = {}) {
		const body = {};
		if (redirect_to) body.redirect_to = redirect_to;
		if (sso_email) body.sso_email = sso_email;

		return request(`/applications/${systemId}/launch`, {
			method: 'POST',
			body: Object.keys(body).length > 0 ? body : undefined,
		});
	},

	async getApplicationSsoCredentials(applicationId) {
		return request(`/applications/${applicationId}/sso-credentials`);
	},

	async createApplicationSsoCredential(applicationId, payload) {
		return request(`/applications/${applicationId}/sso-credentials`, {
			method: 'POST',
			body: payload,
		});
	},

	async deleteApplicationSsoCredential(applicationId, credentialId) {
		return request(`/applications/${applicationId}/sso-credentials/${credentialId}`, {
			method: 'DELETE',
		});
	},

	async listAdminSsoCredentials({ status = 'pending' } = {}) {
		const params = status ? `?status=${encodeURIComponent(status)}` : '';
		return request(`/admin/sso-credentials${params}`);
	},

	async reviewAdminSsoCredential(credentialId, { status }) {
		return request(`/admin/sso-credentials/${credentialId}`, {
			method: 'PATCH',
			body: { status },
		});
	},

	async reorderApplications(order) {
		return request('/applications/reorder', { method: 'POST', body: { order } });
	},

	async getApplicationUsageStats(applicationId = null) {
		const params = applicationId ? `?application_id=${encodeURIComponent(applicationId)}` : '';
		return request(`/applications/usage-stats${params}`);
	},

	async getMyApplicationUsage(applicationId) {
		return request(`/applications/${applicationId}/my-usage`);
	},

	async previewApplicationEventMapping(applicationId, event, notificationConfig = null) {
		return request(`/applications/${applicationId}/event-webhook/preview`, {
			method: 'POST',
			body: notificationConfig
				? { event, notification_config: notificationConfig }
				: event,
		});
	},

	async previewApplicationCalendarMapping(applicationId, event, calendarConfig = null) {
		return request(`/applications/${applicationId}/calendar-webhook/preview`, {
			method: 'POST',
			body: calendarConfig
				? { event, calendar_config: calendarConfig }
				: event,
		});
	},

	async testApplicationMcpCatalog(applicationId, draft = {}) {
		return request(`/applications/${applicationId}/mcp-catalog/test`, {
			method: 'POST',
			body: draft,
		});
	},

	async testApplicationHealth(applicationId, draft = {}) {
		return request(`/applications/${applicationId}/health-check/test`, {
			method: 'POST',
			body: draft,
		});
	},

	async runApplicationHealthChecks() {
		return request('/applications/health-check/run', { method: 'POST' });
	},

	async getApplicationReleaseNoteUnreadCounts() {
		return request('/application-release-notes/unread-counts');
	},

	async markApplicationReleaseNotesRead({ application_id, release_note_ids } = {}) {
		const body = {};
		if (application_id != null) body.application_id = application_id;
		if (release_note_ids != null) body.release_note_ids = release_note_ids;
		return request('/application-release-notes/mark-read', {
			method: 'POST',
			body,
		});
	},

	async getPlatformReleaseNoteUnreadCount() {
		return request('/platform-release-notes/unread-count');
	},

	async markPlatformReleaseNotesRead({ release_note_ids } = {}) {
		const body = {};
		if (release_note_ids != null) body.release_note_ids = release_note_ids;
		return request('/platform-release-notes/mark-read', {
			method: 'POST',
			body,
		});
	},

	/**
	 * Bulk-import users from a CSV File object.
	 */
	async importUsersCsv(file) {
		return this.uploadUsersCsv(file, '/users/import-csv');
	},

	async importHrOnboardingCsv(file) {
		return this.uploadUsersCsv(file, '/users/import-hr-onboarding-csv');
	},

	async assignAccessGroupsCsv(file) {
		return this.uploadUsersCsv(file, '/users/assign-access-groups-csv');
	},

	async exportUsersCsv(filters = {}) {
		const token = getAuthToken();
		const query = buildQuery(filters);
		const response = await fetch(`${API_BASE_URL}/users/export${query}`, {
			method: 'GET',
			headers: {
				Accept: 'text/csv',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			credentials: 'include',
		});

		if (!response.ok) {
			let payload = null;
			try {
				payload = await response.json();
			} catch {
				payload = null;
			}
			const error = new Error(payload?.message || `HTTP ${response.status}`);
			error.status = response.status;
			error.data = payload;
			throw error;
		}

		const blob = await response.blob();
		const url = window.URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
		document.body.appendChild(link);
		link.click();
		link.remove();
		window.URL.revokeObjectURL(url);
	},

	async searchUsers(query, limit = 10) {
		const queryString = buildQuery({ q: query, limit });
		const payload = await request(`/users/search${queryString}`);
		return Array.isArray(payload) ? payload : [];
	},

	async listAdminUsers(filters = {}) {
		const queryString = buildQuery(filters);
		const payload = await request(`/users${queryString}`);

		if (Array.isArray(payload)) {
			return {
				data: payload,
				meta: {
					total: payload.length,
					page: 1,
					per_page: payload.length || 20,
					last_page: 1,
					stats: null,
				},
			};
		}

		return {
			data: Array.isArray(payload?.data) ? payload.data : [],
			meta: payload?.meta || {
				total: 0,
				page: 1,
				per_page: 20,
				last_page: 1,
				stats: null,
			},
		};
	},

	async getPeopleDirectory(filters = {}) {
		const queryString = buildQuery(filters);
		return request(`/users/directory${queryString}`);
	},

	async getUserRoster() {
		return request('/users/roster');
	},

	async listDepartments() {
		const payload = await request('/departments');
		return Array.isArray(payload) ? payload : [];
	},

	async createDepartment(name) {
		return request('/departments', {
			method: 'POST',
			body: { name },
		});
	},

	async listCompanies() {
		const payload = await request('/companies');
		return Array.isArray(payload) ? payload : [];
	},

	async createCompany(name) {
		return request('/companies', {
			method: 'POST',
			body: { name },
		});
	},

	async getUserProfile(userId) {
		return request(`/users/${userId}/profile`);
	},

	async getOrgChart(filters = {}) {
		const queryString = buildQuery(filters);
		return request(`/users/org-chart${queryString}`);
	},

	async sendPresenceHeartbeat() {
		return request('/presence/heartbeat', { method: 'POST' });
	},

	async getOnlinePresence() {
		const payload = await request('/presence/online');
		return {
			userIds: Array.isArray(payload?.user_ids) ? payload.user_ids : [],
			lastSeen: payload?.last_seen && typeof payload.last_seen === 'object' ? payload.last_seen : {},
		};
	},

	async getOnlineUserIds() {
		const payload = await this.getOnlinePresence();
		return payload.userIds;
	},

	async sendProfileNudge(userId, options = {}) {
		return request(`/users/${userId}/profile-nudge`, {
			method: 'POST',
			body: options,
		});
	},

	async nudgeIncompleteProfiles(options = {}) {
		return request('/users/nudge-incomplete-profiles', {
			method: 'POST',
			body: options,
		});
	},

	async sendAdminNotification(payload) {
		return request('/admin/notifications/send', {
			method: 'POST',
			body: payload,
		});
	},

	async listManualExpAwards(params = {}) {
		const query = new URLSearchParams();
		if (params.limit) query.set('limit', String(params.limit));
		const suffix = query.toString() ? `?${query}` : '';
		return request(`/admin/gamification/manual-awards${suffix}`);
	},

	async createManualExpAwards(payload) {
		return request('/admin/gamification/manual-awards', {
			method: 'POST',
			body: payload,
		});
	},

	async listAdminApiTokens() {
		return request('/admin/api-tokens');
	},

	async createAdminApiToken(payload) {
		return request('/admin/api-tokens', {
			method: 'POST',
			body: payload,
		});
	},

	async revokeAdminApiToken(tokenId) {
		return request(`/admin/api-tokens/${tokenId}`, {
			method: 'DELETE',
		});
	},

	async getAdminApiTokenUserMcpAccess(userId) {
		return request(`/admin/api-tokens/users/${userId}/mcp-access`);
	},

	async updateAdminApiTokenUserMcpAccess(userId, payload) {
		return request(`/admin/api-tokens/users/${userId}/mcp-access`, {
			method: 'PATCH',
			body: payload,
		});
	},

	async uploadUsersCsv(file, path) {
		const token = getAuthToken();
		const formData = new FormData();
		formData.append('file', file);
		const response = await fetch(`${API_BASE_URL}${path}`, {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				...(token ? { Authorization: `Bearer ${token}` } : {}),
			},
			body: formData,
			credentials: 'include',
		});
		let payload = null;
		try { payload = await response.json(); } catch { payload = null; }
		if (!response.ok) {
			const error = new Error(payload?.message || `HTTP ${response.status}`);
			error.status = response.status;
			error.data = payload;
			throw error;
		}
		return payload;
	},
};

export default db;