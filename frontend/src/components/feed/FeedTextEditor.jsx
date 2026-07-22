import db from '@/api/apiClient';
import React, { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Users } from 'lucide-react';
import TextEditor from '@/components/ui/text-editor';
import UserAvatar from '@/components/users/UserAvatar';
import {
  ALL_MENTION_OPTION,
  buildMentionToken,
  matchesAllMentionQuery,
} from '@/lib/mentions';
import { cn } from '@/lib/utils';

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

function getMentionQueryFromEditor(editor) {
  if (!editor) return null;

  const { from } = editor.state.selection;
  const textBefore = editor.state.doc.textBetween(Math.max(0, from - 40), from, '\n', '\n');
  const match = textBefore.match(/(?:^|\s)@([\w\s.-]{0,40})$/);
  if (!match) return null;

  return {
    query: match[1].trim(),
    deleteFrom: from - match[0].trimStart().length,
    deleteTo: from,
  };
}

export default function FeedTextEditor({
  value,
  onChange,
  placeholder,
  className,
  minHeight = '7.5rem',
  maxLength = 2000,
  disabled = false,
}) {
  const [editor, setEditor] = useState(null);
  const [mentionState, setMentionState] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const debouncedQuery = useDebouncedValue(mentionState?.query || '');

  const handleEditorReady = useCallback((instance) => {
    setEditor(instance);
  }, []);

  const syncMentionState = useCallback((instance = editor) => {
    setMentionState(getMentionQueryFromEditor(instance));
  }, [editor]);

  useEffect(() => {
    if (!editor) return undefined;

    const onUpdate = () => syncMentionState(editor);
    const onSelection = () => syncMentionState(editor);

    editor.on('update', onUpdate);
    editor.on('selectionUpdate', onSelection);

    return () => {
      editor.off('update', onUpdate);
      editor.off('selectionUpdate', onSelection);
    };
  }, [editor, syncMentionState]);

  useEffect(() => {
    if (!mentionState) {
      setResults([]);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);

    const loadUsers = debouncedQuery
      ? db.searchUsers(debouncedQuery, 8)
      : db.getPeopleDirectory({ limit: 8 }).then((payload) => payload?.users || []);

    loadUsers
      .then((users) => {
        if (cancelled) return;

        const next = Array.isArray(users) ? users.filter((user) => !user?.isAll) : [];
        if (matchesAllMentionQuery(debouncedQuery)) {
          setResults([ALL_MENTION_OPTION, ...next]);
          return;
        }

        setResults(next);
      })
      .catch(() => {
        if (!cancelled) {
          setResults(matchesAllMentionQuery(debouncedQuery) ? [ALL_MENTION_OPTION] : []);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, mentionState]);

  useLayoutEffect(() => {
    if (!mentionState || !editor) {
      setDropdownStyle(null);
      return undefined;
    }

    const updatePosition = () => {
      const coords = editor.view.coordsAtPos(editor.state.selection.from);
      const root = editor.view.dom.closest('[data-feed-text-editor]')?.getBoundingClientRect();
      if (!coords) return;

      setDropdownStyle({
        top: coords.bottom + 8,
        left: root?.left ?? coords.left,
        width: Math.max(root?.width || 0, 240),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mentionState, editor, results.length, loading]);

  const handleChange = (html) => {
    if (html.length > maxLength) {
      editor?.commands.setContent(value || '', { emitUpdate: false });
      return;
    }
    onChange(html);
  };

  const handleSelect = (user) => {
    if (!editor || !mentionState) return;

    const token = `${buildMentionToken(user)} `;
    editor
      .chain()
      .focus()
      .deleteRange({ from: mentionState.deleteFrom, to: mentionState.deleteTo })
      .insertContent(token)
      .run();

    setMentionState(null);
    setResults([]);
  };

  const dropdown =
    mentionState && dropdownStyle
      ? createPortal(
          <div
            className="fixed z-[120] overflow-hidden rounded-xl border border-border bg-popover shadow-lg"
            style={dropdownStyle}
          >
            <div className="border-b border-border/60 px-3 py-2 text-[11px] font-medium text-muted-foreground">
              Mention a colleague
            </div>
            <div className="max-h-52 overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Searching...
                </div>
              ) : results.length === 0 ? (
                <p className="px-3 py-2 text-xs text-muted-foreground">No users found.</p>
              ) : (
                results.map((user) => (
                  <button
                    key={user.id}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => handleSelect(user)}
                    className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left hover:bg-muted/70"
                  >
                    {user.isAll ? (
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <Users className="h-3.5 w-3.5" />
                      </div>
                    ) : (
                      <UserAvatar user={user} className="h-7 w-7" fallbackClassName="text-[10px]" />
                    )}
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {user.isAll ? '@all' : user.name || user.full_name || 'User'}
                      </p>
                      {user.isAll ? (
                        <p className="truncate text-[11px] text-muted-foreground">Notify everyone</p>
                      ) : user.department ? (
                        <p className="truncate text-[11px] text-muted-foreground">{user.department}</p>
                      ) : null}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div data-feed-text-editor className={cn('relative', className)}>
      <TextEditor
        value={value}
        onChange={handleChange}
        placeholder={placeholder}
        minHeight={minHeight}
        editable={!disabled}
        onEditorReady={handleEditorReady}
      />
      {dropdown}
    </div>
  );
}
