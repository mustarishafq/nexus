import db from '@/api/apiClient';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  ALL_MENTION_OPTION,
  getMentionQueryFromEditor,
  getSerializedCursorOffset,
  matchesAllMentionQuery,
  renderMentionEditor,
  replaceActiveMentionQuery,
  serializeMentionEditor,
  setSerializedCursorOffset,
} from '@/lib/mentions';
import UserAvatar from '@/components/users/UserAvatar';

function useDebouncedValue(value, delay = 200) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}

export default function MentionInput({
  value,
  onChange,
  placeholder,
  rows = 3,
  maxLength = 2000,
  className,
  onKeyDown,
}) {
  const editorRef = useRef(null);
  const pendingCursorRef = useRef(null);
  const internalChangeRef = useRef(false);
  const lastRenderedValueRef = useRef(value);
  const [mentionState, setMentionState] = useState(null);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState(null);
  const debouncedQuery = useDebouncedValue(mentionState?.query || '');

  useEffect(() => {
    if (!mentionState) {
      setResults([]);
      return;
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

  useEffect(() => {
    renderMentionEditor(editorRef.current, value);
    lastRenderedValueRef.current = value;
  }, []);

  useEffect(() => {
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }

    if (value === lastRenderedValueRef.current) {
      return;
    }

    renderMentionEditor(editorRef.current, value);
    lastRenderedValueRef.current = value;

    if (pendingCursorRef.current != null) {
      setSerializedCursorOffset(editorRef.current, pendingCursorRef.current);
      pendingCursorRef.current = null;
    }
  }, [value]);

  const syncMentionState = () => {
    setMentionState(getMentionQueryFromEditor(editorRef.current));
  };

  useLayoutEffect(() => {
    if (!mentionState || !editorRef.current) {
      setDropdownStyle(null);
      return;
    }

    const updatePosition = () => {
      const rect = editorRef.current?.getBoundingClientRect();
      if (!rect) return;

      setDropdownStyle({
        top: rect.bottom + 8,
        left: rect.left,
        width: Math.max(rect.width, 240),
      });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [mentionState, results.length, loading]);

  const emitChange = (nextValue, nextCursor = nextValue.length, { rerender = false } = {}) => {
    if (nextValue.length > maxLength) {
      renderMentionEditor(editorRef.current, value);
      lastRenderedValueRef.current = value;
      setSerializedCursorOffset(editorRef.current, Math.min(nextCursor, value.length));
      return;
    }

    if (rerender) {
      renderMentionEditor(editorRef.current, nextValue);
      requestAnimationFrame(() => {
        setSerializedCursorOffset(editorRef.current, nextCursor);
      });
    }

    internalChangeRef.current = true;
    lastRenderedValueRef.current = nextValue;
    onChange(nextValue);
    syncMentionState();
  };

  const handleInput = () => {
    const editor = editorRef.current;
    if (!editor) return;

    const serialized = serializeMentionEditor(editor);
    const cursor = getSerializedCursorOffset(editor);
    emitChange(serialized, cursor);
  };

  const handleSelect = (user) => {
    if (!mentionState) return;

    const serialized = serializeMentionEditor(editorRef.current);
    const { value: nextValue, cursor: nextCursor } = replaceActiveMentionQuery(serialized, mentionState, user);

    pendingCursorRef.current = nextCursor;
    setMentionState(null);
    setResults([]);
    emitChange(nextValue, nextCursor, { rerender: true });

    requestAnimationFrame(() => {
      editorRef.current?.focus();
    });
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Backspace' || event.key === 'Delete') {
      const selection = window.getSelection();
      if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
        onKeyDown?.(event);
        return;
      }

      const range = selection.getRangeAt(0);
      const { startContainer, startOffset } = range;

      if (event.key === 'Backspace') {
        const nodeBefore =
          startContainer.nodeType === Node.TEXT_NODE && startOffset === 0
            ? startContainer.previousSibling
            : startContainer.nodeType === Node.ELEMENT_NODE
              ? startContainer.childNodes[startOffset - 1]
              : null;

        if (nodeBefore instanceof HTMLElement && nodeBefore.dataset.mentionId) {
          event.preventDefault();
          nodeBefore.remove();
          handleInput();
          return;
        }
      }

      if (event.key === 'Delete') {
        const nodeAfter =
          startContainer.nodeType === Node.TEXT_NODE && startOffset === (startContainer.textContent?.length || 0)
            ? startContainer.nextSibling
            : startContainer.nodeType === Node.ELEMENT_NODE
              ? startContainer.childNodes[startOffset]
              : null;

        if (nodeAfter instanceof HTMLElement && nodeAfter.dataset.mentionId) {
          event.preventDefault();
          nodeAfter.remove();
          handleInput();
          return;
        }
      }
    }

    onKeyDown?.(event);
  };

  const minHeight = rows <= 1 ? '2.5rem' : `${Math.max(rows, 2) * 1.5 + 1}rem`;

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
    <div className="relative">
      {!value ? (
        <div className="pointer-events-none absolute left-3 top-2 z-10 text-sm text-muted-foreground md:text-sm">
          {placeholder}
        </div>
      ) : null}

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline={rows > 1}
        aria-label={placeholder}
        onInput={handleInput}
        onClick={syncMentionState}
        onKeyDown={handleKeyDown}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData('text/plain');
          document.execCommand('insertText', false, text);
        }}
        className={cn(
          'w-full rounded-md border border-input bg-transparent px-3 py-2 text-base shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm',
          'whitespace-pre-wrap break-words',
          className
        )}
        style={{ minHeight }}
      />

      {dropdown}
    </div>
  );
}
