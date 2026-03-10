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
        <Link href="/" className="font-bold text-lg">
          mynextgym<span className="text-brand-orange hidden sm:inline">.com.au</span>
        </Link>

        <div className="flex items-center gap-4 text-sm">
          <Link
            href="/"
            className="hidden sm:block text-gray-300 hover:text-white transition-colors"
          >
            Find a Gym
          </Link>
          {!isOwnerRoute && (
            <Link
              href="/list"
              className="text-brand-orange hover:text-orange-400 font-medium transition-colors whitespace-nowrap"
            >
              <span className="sm:hidden">Create listing</span>
              <span className="hidden sm:inline">Create a free listing</span>
            </Link>
          )}
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
