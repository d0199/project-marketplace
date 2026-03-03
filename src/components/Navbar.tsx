import Link from "next/link";
import { useRouter } from "next/router";

export default function Navbar() {
  const router = useRouter();
  const isOwnerRoute = router.pathname.startsWith("/owner");

  function handleLogout() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem("ownerSession");
      router.push("/owner");
    }
  }

  return (
    <nav className="bg-brand-black text-white">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg">
          <span className="text-brand-orange">🏋️</span>
          <span>
            mynextgym<span className="text-brand-orange">.com.au</span>
          </span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="text-gray-300 hover:text-white transition-colors"
          >
            Find a Gym
          </Link>
          {isOwnerRoute ? (
            <button
              onClick={handleLogout}
              className="text-gray-300 hover:text-white transition-colors"
            >
              Log out
            </button>
          ) : (
            <Link
              href="/owner"
              className="bg-brand-orange hover:bg-brand-orange-dark text-white px-3 py-1.5 rounded-lg font-medium transition-colors"
            >
              Owner Portal
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
