import { format, isSameWeek, isToday, isYesterday } from 'date-fns';

/**
 * WhatsApp-style date separator label for a message thread. Uses the same
 * date-fns conventions already used elsewhere in the app (e.g.
 * WeeklyCalendarWidget's `weekStartsOn: 1`) and operates on the viewer's
 * local time, exactly like every other relative timestamp in the app
 * (formatDistanceToNow(new Date(item.created_date))) — no separate
 * timezone interpretation is introduced.
 */
export function messageDateSeparatorLabel(value, now = new Date()) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';

	if (isToday(date)) return 'Today';
	if (isYesterday(date)) return 'Yesterday';
	if (isSameWeek(date, now, { weekStartsOn: 1 })) return format(date, 'EEEE');
	return format(date, 'd MMMM yyyy');
}

function dayKey(value) {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return '';
	return format(date, 'yyyy-MM-dd');
}

/**
 * Interleaves a date-separator entry ahead of the first message of each
 * calendar day. `messages` must already be in chronological order (as the
 * thread endpoint returns them). Shared between Messages.jsx and
 * MiniChatPanel.jsx so both render identical separators.
 *
 * @returns {Array<{ type: 'separator', key: string, label: string } | { type: 'message', key: string, message: object }>}
 */
export function groupMessagesWithDateSeparators(messages, now = new Date()) {
	const list = Array.isArray(messages) ? messages : [];
	const items = [];
	let lastKey = null;

	for (const message of list) {
		const key = dayKey(message?.created_date);
		if (key && key !== lastKey) {
			items.push({
				type: 'separator',
				key: `sep-${key}`,
				label: messageDateSeparatorLabel(message.created_date, now),
			});
			lastKey = key;
		}
		items.push({ type: 'message', key: `msg-${message.id}`, message });
	}

	return items;
}
