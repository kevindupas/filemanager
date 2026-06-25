import { Link } from '@tiptap/extension-link';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { TaskItem } from '@tiptap/extension-task-item';
import { TaskList } from '@tiptap/extension-task-list';
import { Underline } from '@tiptap/extension-underline';
import { type Editor, EditorContent, useEditor } from '@tiptap/react';
import { StarterKit } from '@tiptap/starter-kit';
import {
    Bold,
    Code,
    Heading1,
    Heading2,
    Italic,
    Link2,
    List,
    ListChecks,
    ListOrdered,
    Quote,
    Table as TableIcon,
    Underline as UnderlineIcon,
} from 'lucide-react';
import { useEffect, useRef } from 'react';

/**
 * Apple-Notes-style WYSIWYG editor. Content is rich text (HTML) — what you type
 * is formatted live, no markdown source shown. Emits HTML on every change.
 */
export function NoteEditor({ noteId, initialHtml, onChange }: { noteId: number; initialHtml: string; onChange: (html: string) => void }) {
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;

    const editor = useEditor(
        {
            extensions: [
                StarterKit,
                Underline,
                Link.configure({ openOnClick: false, autolink: true }),
                TaskList,
                TaskItem.configure({ nested: true }),
                Table.configure({ resizable: false }),
                TableRow,
                TableHeader,
                TableCell,
                Placeholder.configure({ placeholder: 'Titre sur la première ligne…' }),
            ],
            content: initialHtml || '',
            onUpdate: ({ editor }) => onChangeRef.current(editor.getHTML()),
            editorProps: { attributes: { class: 'note-prose min-h-full focus:outline-none' } },
        },
        [noteId], // rebuild with the right content when switching notes
    );

    useEffect(() => () => editor?.destroy(), [editor]);

    if (!editor) return null;

    return (
        <div className="flex min-h-0 flex-1 flex-col">
            <Toolbar editor={editor} />
            <EditorContent editor={editor} className="min-h-0 flex-1 cursor-text overflow-y-auto p-4 text-sm" onClick={() => editor.chain().focus().run()} />
        </div>
    );
}

function Toolbar({ editor }: { editor: Editor }) {
    const btn = (active: boolean, onClick: () => void, Icon: typeof Bold, label: string) => (
        <button
            type="button"
            title={label}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
            className={`rounded p-1.5 transition-colors hover:bg-primary/10 hover:text-primary ${active ? 'bg-primary/15 text-primary' : 'text-muted-foreground'}`}
        >
            <Icon className="size-4" />
        </button>
    );

    const addLink = () => {
        const url = window.prompt('URL');
        if (url) editor.chain().focus().setLink({ href: url }).run();
        else editor.chain().focus().unsetLink().run();
    };

    return (
        <div className="flex shrink-0 flex-wrap items-center gap-0.5 border-b border-primary/10 px-2 py-1">
            {btn(editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), Heading1, 'Title')}
            {btn(editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), Heading2, 'Subtitle')}
            <span className="mx-1 h-4 w-px bg-border" />
            {btn(editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), Bold, 'Bold')}
            {btn(editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), Italic, 'Italic')}
            {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), UnderlineIcon, 'Underline')}
            {btn(editor.isActive('code'), () => editor.chain().focus().toggleCode().run(), Code, 'Code')}
            <span className="mx-1 h-4 w-px bg-border" />
            {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), List, 'Bullet list')}
            {btn(editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), ListOrdered, 'Numbered list')}
            {btn(editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), ListChecks, 'Checklist')}
            {btn(editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), Quote, 'Quote')}
            <span className="mx-1 h-4 w-px bg-border" />
            {btn(false, () => editor.chain().focus().insertTable({ rows: 3, cols: 2, withHeaderRow: true }).run(), TableIcon, 'Table')}
            {btn(editor.isActive('link'), addLink, Link2, 'Link')}
        </div>
    );
}
