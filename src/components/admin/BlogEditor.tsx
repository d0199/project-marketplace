import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useRef, useCallback } from "react";

interface Props {
  content: string;
  onChange: (html: string) => void;
}

const btnCls = (active: boolean) =>
  `px-2 py-1 text-xs font-medium rounded transition-colors ${
    active
      ? "bg-brand-orange text-white"
      : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
  }`;

export default function BlogEditor({ content, onChange }: Props) {
  // Track whether the content update came from the editor itself (typing) vs external (AI)
  const isInternalUpdate = useRef(false);

  const handleUpdate = useCallback(({ editor: e }: { editor: ReturnType<typeof useEditor> }) => {
    if (!e) return;
    isInternalUpdate.current = true;
    onChange(e.getHTML());
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: "text-brand-orange underline" },
      }),
      Image.configure({
        HTMLAttributes: { class: "rounded-xl max-w-full" },
      }),
      Placeholder.configure({
        placeholder: "Start writing your blog post...",
      }),
    ],
    content,
    editorProps: {
      attributes: {
        class:
          "prose prose-sm max-w-none min-h-[400px] p-4 focus:outline-none " +
          "prose-headings:text-gray-900 prose-p:text-gray-700 prose-p:leading-relaxed " +
          "prose-a:text-brand-orange prose-li:text-gray-700 prose-img:rounded-xl " +
          "prose-ul:list-disc prose-ul:pl-6 prose-ol:list-decimal prose-ol:pl-6 " +
          "prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic",
      },
    },
    onUpdate: handleUpdate,
  });

  // Only sync external content changes (e.g. AI-generated content), not internal typing
  useEffect(() => {
    if (!editor) return;
    if (isInternalUpdate.current) {
      isInternalUpdate.current = false;
      return;
    }
    // External content change — update editor without disrupting user
    if (content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content, editor]);

  if (!editor) return null;

  function addLink() {
    const url = prompt("Enter URL:");
    if (url) {
      editor!.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
  }

  function addImage() {
    const url = prompt("Enter image URL:");
    if (url) {
      editor!.chain().focus().setImage({ src: url }).run();
    }
  }

  function insertCta(type: "search-gyms" | "search-pts") {
    const label = type === "search-gyms" ? "Search Gyms Near You" : "Find a Personal Trainer";
    const href = type === "search-gyms" ? "https://www.mynextgym.com.au/" : "https://www.mynextgym.com.au/?tab=pts";
    const html = `<div data-cta="${type}" data-href="${href}" data-label="${label}" class="cta-block"><p><a href="${href}">${label}</a></p></div>`;
    editor!.chain().focus().insertContent(html).run();
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 2 }).run(); }} className={btnCls(editor.isActive("heading", { level: 2 }))}>
          H2
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 3 }).run(); }} className={btnCls(editor.isActive("heading", { level: 3 }))}>
          H3
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }} className={btnCls(editor.isActive("bold"))}>
          <strong>B</strong>
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }} className={btnCls(editor.isActive("italic"))}>
          <em>I</em>
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }} className={btnCls(editor.isActive("bulletList"))}>
          &bull; List
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }} className={btnCls(editor.isActive("orderedList"))}>
          1. List
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); addLink(); }} className={btnCls(editor.isActive("link"))}>
          Link
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); addImage(); }} className={btnCls(false)}>
          Image
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBlockquote().run(); }} className={btnCls(editor.isActive("blockquote"))}>
          Quote
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHorizontalRule().run(); }} className={btnCls(false)}>
          —
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setHardBreak().run(); }} className={btnCls(false)} title="Line break (Shift+Enter)">
          ↵ Break
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }} className={btnCls(false)} disabled={!editor.can().undo()}>
          Undo
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }} className={btnCls(false)} disabled={!editor.can().redo()}>
          Redo
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onMouseDown={(e) => { e.preventDefault(); insertCta("search-gyms"); }} className="px-2 py-1 text-xs font-medium rounded bg-orange-50 text-brand-orange hover:bg-orange-100 border border-orange-200">
          + Search Gyms CTA
        </button>
        <button type="button" onMouseDown={(e) => { e.preventDefault(); insertCta("search-pts"); }} className="px-2 py-1 text-xs font-medium rounded bg-orange-50 text-brand-orange hover:bg-orange-100 border border-orange-200">
          + Search PTs CTA
        </button>
      </div>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
