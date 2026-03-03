import type { ReactNode } from "react";
import Navbar from "./Navbar";

interface Props {
  children: ReactNode;
  title?: string;
}

export default function Layout({ children }: Props) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
