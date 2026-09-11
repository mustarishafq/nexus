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

	try {
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
	} catch (error) {
		console.warn('Realtime quiz updates unavailable; falling back to polling.', error);
		echoInstance = null;
		return null;
	}

	return echoInstance;
}

/**
 * @param {string|number} sessionId
 * @param {(payload: any) => void} onEvent Fired for every QuizSessionStateChanged broadcast.
 * @param {() => void} [onReconnect] Fired when the socket re-establishes a
 *   connection after having dropped (not on the very first connect) — a
 *   participant can miss events while disconnected, so this is the signal
 *   to reconcile immediately instead of waiting for the next poll tick.
 */
export function subscribeQuizSession(sessionId, onEvent, onReconnect) {
	if (!sessionId) {
		return () => {};
	}

	let echo;
	try {
		echo = getEcho();
	} catch (error) {
		console.warn('Realtime quiz updates unavailable; falling back to polling.', error);
		return () => {};
	}

	if (!echo) {
		return () => {};
	}

	try {
		// Refresh auth header in case token changed
		if (echo.connector?.pusher?.config?.auth?.headers) {
			echo.connector.pusher.config.auth.headers.Authorization = `Bearer ${getAuthToken() || ''}`;
		}

		const channel = echo.private(`quiz-session.${sessionId}`);
		channel.listen('.QuizSessionStateChanged', (payload) => {
			onEvent?.(payload);
		});

		let hasConnectedBefore = false;
		const connection = echo.connector?.pusher?.connection;
		const handleStateChange = (states) => {
			if (states?.current !== 'connected') return;
			if (hasConnectedBefore) {
				onReconnect?.();
			}
			hasConnectedBefore = true;
		};
		connection?.bind('state_change', handleStateChange);

		return () => {
			try {
				connection?.unbind('state_change', handleStateChange);
				echo.leave(`quiz-session.${sessionId}`);
			} catch {
				// ignore
			}
		};
	} catch (error) {
		console.warn('Realtime quiz updates unavailable; falling back to polling.', error);
		return () => {};
	}
}

/**
 * Host-only channel for lightweight per-answer progress (answer_count),
 * kept separate from subscribeQuizSession so ordinary participants never
 * subscribe to it. See QuizSessionAnswerCountChanged on the backend.
 *
 * @param {(payload: { question_id: number, answer_count: number }) => void} onCount
 */
export function subscribeQuizHostProgress(sessionId, onCount) {
	if (!sessionId) {
		return () => {};
	}

	let echo;
	try {
		echo = getEcho();
	} catch {
		return () => {};
	}

	if (!echo) {
		return () => {};
	}

	try {
		if (echo.connector?.pusher?.config?.auth?.headers) {
			echo.connector.pusher.config.auth.headers.Authorization = `Bearer ${getAuthToken() || ''}`;
		}

		const channelName = `quiz-session.${sessionId}.host`;
		const channel = echo.private(channelName);
		channel.listen('.QuizSessionAnswerCountChanged', (payload) => {
			onCount?.(payload);
		});

		return () => {
			try {
				echo.leave(channelName);
			} catch {
				// ignore
			}
		};
	} catch {
		return () => {};
	}
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
