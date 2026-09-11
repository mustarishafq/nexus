import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import db from '@/api/apiClient';
import { MESSAGES_INBOX_QUERY_KEY } from '@/lib/queryKeys';

/**
 * Edit/delete mutations for a single conversation's messages, shared by
 * Messages.jsx and MiniChatPanel.jsx so the two surfaces don't duplicate
 * this logic. Both invalidate the same thread + inbox query keys used by
 * the existing polling/unread mechanism, so a new/edited/deleted message
 * becomes visible without a manual refresh.
 */
export function useMessageActions(conversationId) {
	const queryClient = useQueryClient();

	const invalidate = () => {
		queryClient.invalidateQueries({ queryKey: ['messages-thread', conversationId] });
		queryClient.invalidateQueries({ queryKey: MESSAGES_INBOX_QUERY_KEY });
	};

	const updateMessage = useMutation({
		mutationFn: ({ id, body }) => db.messages.updateMessage(id, body),
		onSuccess: invalidate,
		onError: (error) => {
			toast.error(error?.message || 'Failed to update message.');
		},
	});

	const deleteMessage = useMutation({
		mutationFn: (id) => db.messages.deleteMessage(id),
		onSuccess: invalidate,
		onError: (error) => {
			toast.error(error?.message || 'Failed to delete message.');
		},
	});

	return { updateMessage, deleteMessage };
}
