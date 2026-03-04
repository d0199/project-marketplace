import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  signIn,
  signOut,
  getCurrentUser,
  fetchUserAttributes,
} from "aws-amplify/auth";
import ImageCarousel from "@/components/ImageCarousel";
import Layout from "@/components/Layout";
import type { OwnerSession, Gym } from "@/types";
import type { GymStats } from "@/lib/statsStore";

export default function OwnerPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [stats, setStats] = useState<Record<string, GymStats>>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attributes = await fetchUserAttributes();
        if (attributes["custom:isAdmin"] === "true") {
          router.replace("/admin");
          return;
        }
        setSession({
          ownerId: attributes["custom:ownerId"] ?? "",
          email: user.signInDetails?.loginId ?? "",
          name: attributes.name ?? attributes.email ?? "",
        });
      })
      .catch(() => {
        // Not signed in — show login form
      })
      .finally(() => setLoading(false));
  }, [router]);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/owner/gyms?ownerId=${session.ownerId}`)
      .then((r) => r.json())
      .then((data: Gym[]) => {
        setGyms(data);
        return Promise.all(
          data.map((g) =>
            fetch(`/api/stats/${g.id}`)
              .then((r) => r.json() as Promise<GymStats>)
              .then((s) => [g.id, s] as const)
          )
        );
      })
      .then((entries) => setStats(Object.fromEntries(entries)));
  }, [session]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    try {
      await signIn({ username: email, password });
      const user = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      if (attributes["custom:isAdmin"] === "true") {
        router.replace("/admin");
        return;
      }
      setSession({
        ownerId: attributes["custom:ownerId"] ?? "",
        email: user.signInDetails?.loginId ?? "",
        name: attributes.name ?? attributes.email ?? "",
      });
    } catch {
      setError("Invalid email or password.");
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="text-gray-400">Loading…</div>
        </div>
      </Layout>
    );
  }

  if (!session) {
    return (
      <>
        <Head>
          <title>Owner Portal — mynextgym.com.au</title>
        </Head>
        <Layout>
          <div className="max-w-md mx-auto mt-12">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">
              <div className="text-center mb-6">
                <span className="text-4xl">🏋️</span>
                <h1 className="text-2xl font-bold text-gray-900 mt-2">
                  Owner Portal
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  Manage your gym listings
                </p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="owner@mynextgym.com.au"
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange"
                  />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors"
                >
                  Sign In
                </button>
              </form>
            </div>
          </div>
        </Layout>
      </>
    );
  }

  // Dashboard
  return (
    <>
      <Head>
        <title>Dashboard — mynextgym.com.au Owner Portal</title>
      </Head>
      <Layout>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Gyms</h1>
            <p className="text-gray-500 text-sm mt-1">
              Welcome back, {session.name}
            </p>
          </div>
          <button
            onClick={async () => {
              await signOut();
              router.reload();
            }}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Sign out
          </button>
        </div>

        {gyms.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-4xl mb-3">🏟️</p>
            <p className="text-gray-500">Loading your gyms…</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {gyms.map((gym) => (
              <div
                key={gym.id}
                className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col"
              >
                <div className="relative h-36 w-full bg-gray-100">
                  <ImageCarousel images={gym.images} alt={gym.name} sizes="33vw" />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h2 className="font-semibold text-gray-900 text-base mb-1">
                    {gym.name}
                  </h2>
                  <p className="text-sm text-gray-500 mb-3">
                    {gym.address.suburb}, {gym.address.postcode}
                  </p>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { label: "Page views", icon: "👁", key: "pageViews" },
                      { label: "Website clicks", icon: "🌐", key: "websiteClicks" },
                      { label: "Phone clicks", icon: "📞", key: "phoneClicks" },
                      { label: "Email clicks", icon: "✉️", key: "emailClicks" },
                    ].map(({ label, icon, key }) => (
                      <div key={key} className="bg-gray-50 rounded-lg px-3 py-2">
                        <p className="text-xs text-gray-500">{icon} {label}</p>
                        <p className="text-lg font-bold text-gray-900">
                          {stats[gym.id]?.[key as keyof GymStats] ?? 0}
                        </p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto flex gap-2">
                    <Link
                      href={`/gym/${gym.id}`}
                      className="flex-1 text-center text-sm py-1.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      View
                    </Link>
                    <Link
                      href={`/owner/${gym.id}`}
                      className="flex-1 text-center text-sm py-1.5 bg-brand-orange hover:bg-brand-orange-dark text-white rounded-lg font-medium transition-colors"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Layout>
    </>
  );
}
