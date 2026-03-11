import { useEditor, EditorContent, BubbleMenu } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";

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
          "prose-a:text-brand-orange prose-li:text-gray-700 prose-img:rounded-xl",
      },
    },
    onUpdate: ({ editor: e }) => {
      onChange(e.getHTML());
    },
  });

  // Sync external content changes (e.g. AI-generated content)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content]);

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

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 border-b border-gray-200 bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={btnCls(editor.isActive("heading", { level: 2 }))}>
          H2
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={btnCls(editor.isActive("heading", { level: 3 }))}>
          H3
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={btnCls(editor.isActive("bold"))}>
          <strong>B</strong>
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={btnCls(editor.isActive("italic"))}>
          <em>I</em>
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={btnCls(editor.isActive("bulletList"))}>
          &bull; List
        </button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={btnCls(editor.isActive("orderedList"))}>
          1. List
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={addLink} className={btnCls(editor.isActive("link"))}>
          Link
        </button>
        <button type="button" onClick={addImage} className={btnCls(false)}>
          Image
        </button>
        <div className="w-px h-5 bg-gray-300 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()} className={btnCls(editor.isActive("blockquote"))}>
          Quote
        </button>
        <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className={btnCls(false)}>
          —
        </button>
      </div>

      {/* Bubble menu for inline formatting */}
      <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
        <div className="flex items-center gap-1 bg-gray-900 text-white px-2 py-1 rounded-lg shadow-lg">
          <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={`px-1.5 py-0.5 text-xs rounded ${editor.isActive("bold") ? "bg-white/20" : "hover:bg-white/10"}`}>
            <strong>B</strong>
          </button>
          <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-1.5 py-0.5 text-xs rounded ${editor.isActive("italic") ? "bg-white/20" : "hover:bg-white/10"}`}>
            <em>I</em>
          </button>
          <button type="button" onClick={addLink} className={`px-1.5 py-0.5 text-xs rounded ${editor.isActive("link") ? "bg-white/20" : "hover:bg-white/10"}`}>
            Link
          </button>
        </div>
      </BubbleMenu>

      {/* Editor content */}
      <EditorContent editor={editor} />
    </div>
  );
}
