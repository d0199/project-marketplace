import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import Image from "next/image";
import Layout from "@/components/Layout";
import type { OwnerSession, Gym } from "@/types";

// Hardcoded credentials for prototype
const CREDENTIALS: Record<
  string,
  { password: string; ownerId: string; name: string }
> = {
  "owner@gymmarketplace.com.au": {
    password: "demo123",
    ownerId: "owner-1",
    name: "Alex Thompson",
  },
  "owner2@gymmarketplace.com.au": {
    password: "demo456",
    ownerId: "owner-2",
    name: "Jordan Lee",
  },
};

export default function OwnerPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem("ownerSession");
    if (raw) {
      try {
        setSession(JSON.parse(raw) as OwnerSession);
      } catch {
        sessionStorage.removeItem("ownerSession");
      }
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!session) return;
    fetch(`/api/owner/gyms?ownerId=${session.ownerId}`)
      .then((r) => r.json())
      .then((data: Gym[]) => setGyms(data));
  }, [session]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const cred = CREDENTIALS[email.toLowerCase()];
    if (!cred || cred.password !== password) {
      setError("Invalid email or password.");
      return;
    }
    const s: OwnerSession = {
      ownerId: cred.ownerId,
      email: email.toLowerCase(),
      name: cred.name,
    };
    sessionStorage.setItem("ownerSession", JSON.stringify(s));
    setSession(s);
    setError("");
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
          <title>Owner Portal — GymMarket</title>
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
                    placeholder="owner@gymmarketplace.com.au"
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
                {error && (
                  <p className="text-sm text-red-500">{error}</p>
                )}
                <button
                  type="submit"
                  className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors"
                >
                  Sign In
                </button>
              </form>

              <p className="text-xs text-gray-400 mt-4 text-center">
                Demo: owner@gymmarketplace.com.au / demo123
              </p>
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
        <title>Dashboard — GymMarket Owner Portal</title>
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
            onClick={() => {
              sessionStorage.removeItem("ownerSession");
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
                  <Image
                    src={gym.imageUrl}
                    alt={gym.name}
                    fill
                    className="object-cover"
                    sizes="33vw"
                    unoptimized
                  />
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <h2 className="font-semibold text-gray-900 text-base mb-1">
                    {gym.name}
                  </h2>
                  <p className="text-sm text-gray-500 mb-3">
                    {gym.address.suburb}, {gym.address.postcode}
                  </p>
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
