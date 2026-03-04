import type { ReactNode } from "react";
import Navbar from "./Navbar";

interface Props {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8">{children}</main>
      <footer className="bg-white border-t text-center text-xs text-gray-400 py-4">
        &copy; 2026 Mynextgym
      </footer>
    </div>
  );
}
