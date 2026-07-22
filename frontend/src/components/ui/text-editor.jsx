import React, { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Strikethrough,
  Underline as UnderlineIcon,
} from 'lucide-react';
import { RICH_TEXT_CONTENT_CLASS, isEmptyRichText, preserveBlankLines } from '@/lib/richText';
import { Toggle } from '@/components/ui/toggle';
import { cn } from '@/lib/utils';

function ToolbarButton({ pressed, onPressedChange, title, children, disabled }) {
  return (
    <Toggle
      type="button"
      size="sm"
      pressed={pressed}
      onPressedChange={onPressedChange}
      disabled={disabled}
      title={title}
      aria-label={title}
      className="h-8 w-8 p-0 data-[state=on]:bg-muted"
    >
      {children}
    </Toggle>
  );
}

export default function TextEditor({
  value = '',
  onChange,
  placeholder = 'Write something…',
  className,
  editorClassName,
  minHeight = '7.5rem',
  editable = true,
  onEditorReady,
}) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Underline,
      Placeholder.configure({
        placeholder,
      }),
    ],
    content: value || '',
    editable,
    editorProps: {
      attributes: {
        class: cn(
          RICH_TEXT_CONTENT_CLASS,
          'max-w-none focus:outline-none min-h-[inherit] px-3 py-2',
          editorClassName
        ),
      },
    },
    onUpdate: ({ editor: current }) => {
      const html = preserveBlankLines(current.getHTML());
      onChange?.(isEmptyRichText(html) ? '' : html);
    },
  });

  useEffect(() => {
    if (!editor || !onEditorReady) return;
    onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(editable);
  }, [editor, editable]);

  useEffect(() => {
    if (!editor) return;

    const next = value || '';
    const current = editor.getHTML();
    if (next === current) return;
    if (!next && isEmptyRichText(current)) return;

    editor.commands.setContent(next, { emitUpdate: false });
  }, [editor, value]);

  if (!editor) {
    return (
      <div
        className={cn('rounded-md border border-input bg-transparent', className)}
        style={{ minHeight }}
      />
    );
  }

  return (
    <div className={cn('overflow-hidden rounded-md border border-input bg-transparent shadow-sm', className)}>
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border/70 bg-muted/30 px-1.5 py-1">
        <ToolbarButton
          title="Bold"
          pressed={editor.isActive('bold')}
          disabled={!editable}
          onPressedChange={() => editor.chain().focus().toggleBold().run()}
        >
          <Bold className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Italic"
          pressed={editor.isActive('italic')}
          disabled={!editable}
          onPressedChange={() => editor.chain().focus().toggleItalic().run()}
        >
          <Italic className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Underline"
          pressed={editor.isActive('underline')}
          disabled={!editable}
          onPressedChange={() => editor.chain().focus().toggleUnderline().run()}
        >
          <UnderlineIcon className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Strikethrough"
          pressed={editor.isActive('strike')}
          disabled={!editable}
          onPressedChange={() => editor.chain().focus().toggleStrike().run()}
        >
          <Strikethrough className="h-3.5 w-3.5" />
        </ToolbarButton>
        <div className="mx-1 h-4 w-px bg-border" />
        <ToolbarButton
          title="Bullet list"
          pressed={editor.isActive('bulletList')}
          disabled={!editable}
          onPressedChange={() => editor.chain().focus().toggleBulletList().run()}
        >
          <List className="h-3.5 w-3.5" />
        </ToolbarButton>
        <ToolbarButton
          title="Numbered list"
          pressed={editor.isActive('orderedList')}
          disabled={!editable}
          onPressedChange={() => editor.chain().focus().toggleOrderedList().run()}
        >
          <ListOrdered className="h-3.5 w-3.5" />
        </ToolbarButton>
      </div>

      <div className="tiptap-editor" style={{ minHeight }}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
