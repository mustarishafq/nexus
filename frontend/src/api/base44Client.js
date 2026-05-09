// @ts-nocheck
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
const AUTH_TOKEN_KEY = 'nexus_auth_token';

const ENTITY_ENDPOINTS = {
	User: 'users',
	ConnectedSystem: 'connected-systems',
	UserSystemAccess: 'user-system-accesses',
	Notification: 'notifications',
	SystemEvent: 'system-events',
	ActivityLog: 'activity-logs',
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
	const token = localStorage.getItem(AUTH_TOKEN_KEY);
	const authHeaders = token ? { Authorization: `Bearer ${token}` } : {};

	const response = await fetch(`${API_BASE_URL}${path}`, {
		method,
		headers: {
			Accept: 'application/json',
			'Content-Type': 'application/json',
			...authHeaders,
			...headers,
		},
		body: body === undefined ? undefined : JSON.stringify(normalizeBody(body)),
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
		const error = new Error(payload?.message || `HTTP ${response.status}`);
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
			return request(`/${endpoint}${query}`);
		},

		async filter(filters = {}, sort, limit) {
			const query = buildQuery({ ...filters, sort, limit });
			return request(`/${endpoint}${query}`);
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

		async login(data) {
			const payload = await request('/auth/login', { method: 'POST', body: data });
			if (payload?.token) {
				localStorage.setItem(AUTH_TOKEN_KEY, payload.token);
			}
			return payload;
		},

		async forgotPassword(data) {
			return request('/auth/forgot-password', { method: 'POST', body: data });
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

			localStorage.removeItem(AUTH_TOKEN_KEY);
			if (redirectTo) {
				window.location.href = redirectTo;
			}
		},

		redirectToLogin(redirectTo = '/login') {
			window.location.href = redirectTo || '/login';
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

				const response = await fetch(`${API_BASE_URL}/uploads`, {
					method: 'POST',
					body: formData,
					credentials: 'include',
					headers: {
						Accept: 'application/json',
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
	 * Request a signed SSO launch URL for a connected system.
	 * Returns { launch_url, token, expires_in }.
	 * Open launch_url in a new tab to auto-login the user.
	 */
	async launchSystem(systemId) {
		return request(`/connected-systems/${systemId}/launch`, { method: 'POST' });
	},

	/**
	 * Bulk-import users from a CSV File object.
	 */
	async importUsersCsv(file) {
		const token = localStorage.getItem(AUTH_TOKEN_KEY);
		const formData = new FormData();
		formData.append('file', file);
		const response = await fetch(`${API_BASE_URL}/users/import-csv`, {
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

export const base44 = db;
export default db;