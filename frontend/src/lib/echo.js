// @ts-nocheck
import Echo from 'laravel-echo';
import Pusher from 'pusher-js';
import { getAuthToken } from '@/lib/authStorage';
import { API_ORIGIN } from '@/api/apiClient';

window.Pusher = Pusher;

let echoInstance = null;

export function getEcho() {
	if (echoInstance) {
		return echoInstance;
	}

	const key = import.meta.env.VITE_REVERB_APP_KEY;
	if (!key) {
		return null;
	}

	echoInstance = new Echo({
		broadcaster: 'reverb',
		key,
		wsHost: import.meta.env.VITE_REVERB_HOST || window.location.hostname,
		wsPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
		wssPort: Number(import.meta.env.VITE_REVERB_PORT || 8080),
		forceTLS: (import.meta.env.VITE_REVERB_SCHEME || 'https') === 'https',
		enabledTransports: ['ws', 'wss'],
		authEndpoint: `${API_ORIGIN}/api/broadcasting/auth`,
		auth: {
			headers: {
				Authorization: `Bearer ${getAuthToken() || ''}`,
				Accept: 'application/json',
			},
		},
	});

	return echoInstance;
}

export function subscribeQuizSession(sessionId, onEvent) {
	const echo = getEcho();
	if (!echo || !sessionId) {
		return () => {};
	}

	// Refresh auth header in case token changed
	if (echo.connector?.pusher?.config?.auth?.headers) {
		echo.connector.pusher.config.auth.headers.Authorization = `Bearer ${getAuthToken() || ''}`;
	}

	const channel = echo.private(`quiz-session.${sessionId}`);
	channel.listen('.QuizSessionStateChanged', (payload) => {
		onEvent?.(payload);
	});

	return () => {
		try {
			echo.leave(`quiz-session.${sessionId}`);
		} catch {
			// ignore
		}
	};
}

export function disconnectEcho() {
	if (echoInstance) {
		try {
			echoInstance.disconnect();
		} catch {
			// ignore
		}
		echoInstance = null;
	}
}
