import type { ReactNode } from "react";
import Link from "next/link";
import Navbar from "./Navbar";
import ChatWidget from "./ChatWidget";

interface Props {
  children: ReactNode;
  hero?: ReactNode;
}

export default function Layout({ children, hero }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      {hero}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">{children}</main>
      <footer className="bg-white border-t text-center text-xs text-gray-400 py-4">
        <div className="flex items-center justify-center gap-3 mb-1">
          <Link href="/about" className="hover:text-gray-600 transition-colors">About</Link>
          <span>&middot;</span>
          <Link href="/about#faq" className="hover:text-gray-600 transition-colors">FAQ</Link>
          <span>&middot;</span>
          <Link href="/resources" className="hover:text-gray-600 transition-colors">Resources</Link>
          <span>&middot;</span>
          <Link href="/list" className="hover:text-gray-600 transition-colors">List your gym</Link>
        </div>
        &copy; 2026 Mynextgym
      </footer>
      <ChatWidget />
    </div>
  );
}
