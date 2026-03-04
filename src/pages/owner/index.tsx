import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import {
  signIn,
  signOut,
  signUp,
  confirmSignUp,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchUserAttributes,
} from "aws-amplify/auth";
import ImageCarousel from "@/components/ImageCarousel";
import Layout from "@/components/Layout";
import type { OwnerSession, Gym } from "@/types";
import type { GymStats } from "@/lib/statsStore";

type View = "login" | "signup" | "confirm-signup" | "forgot" | "reset-confirm" | "new-password";

export default function OwnerPortalPage() {
  const router = useRouter();
  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [stats, setStats] = useState<Record<string, GymStats>>({});
  const [loading, setLoading] = useState(true);

  // Shared form state
  const [view, setView] = useState<View>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setError(""); setInfo(""); setPassword(""); setConfirmPassword("");
    setCode(""); setNewPassword(""); setConfirmNewPassword("");
  }

  function switchView(v: View) { resetForm(); setView(v); }

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
      .catch(() => {})
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

  // ── Login ──────────────────────────────────────────────────────────────────
  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      const result = await signIn({ username: email, password });
      if (result.nextStep?.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED") {
        setBusy(false);
        switchView("new-password");
        return;
      }
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
      setError("Incorrect email or password.");
    }
    setBusy(false);
  }

  // ── Sign Up ────────────────────────────────────────────────────────────────
  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { name, email } },
      });
      switchView("confirm-signup");
      setInfo("A verification code has been sent to your email.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("already exists") ? "An account with this email already exists." : msg);
    }
    setBusy(false);
  }

  // ── Confirm Sign Up ────────────────────────────────────────────────────────
  async function handleConfirmSignUp(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      // Auto sign in after confirmation
      await signIn({ username: email, password });
      const user = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setSession({
        ownerId: attributes["custom:ownerId"] ?? "",
        email: user.signInDetails?.loginId ?? "",
        name: attributes.name ?? attributes.email ?? "",
      });
    } catch {
      setError("Invalid or expired code. Please try again.");
    }
    setBusy(false);
  }

  // ── Forgot Password ────────────────────────────────────────────────────────
  async function handleForgotPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    try {
      await resetPassword({ username: email });
      switchView("reset-confirm");
      setInfo("A reset code has been sent to your email.");
    } catch {
      // Don't reveal whether email exists — show same success message
      switchView("reset-confirm");
      setInfo("If that email is registered, a reset code has been sent.");
    }
    setBusy(false);
  }

  // ── Confirm Reset Password ─────────────────────────────────────────────────
  async function handleConfirmReset(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      await confirmResetPassword({ username: email, confirmationCode: code, newPassword });
      switchView("login");
      setInfo("Password reset successfully. Please sign in.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("Invalid") ? "Invalid or expired code." : msg);
    }
    setBusy(false);
  }

  // ── New Password Required (temp password) ─────────────────────────────────
  async function handleNewPassword(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setBusy(true);
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      setBusy(false);
      return;
    }
    try {
      await confirmSignIn({ challengeResponse: newPassword });
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
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("password") ? "Password does not meet requirements." : msg);
    }
    setBusy(false);
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20">
          <div className="text-gray-400">Loading…</div>
        </div>
      </Layout>
    );
  }

  // ── Auth views ─────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <>
        <Head>
          <title>Owner Portal — mynextgym.com.au</title>
        </Head>
        <Layout>
          <div className="max-w-md mx-auto mt-12">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">

              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-2xl font-bold text-gray-900">
                  {view === "signup" ? "Create account" :
                   view === "confirm-signup" ? "Verify your email" :
                   view === "forgot" ? "Reset password" :
                   view === "reset-confirm" ? "Enter reset code" :
                   view === "new-password" ? "Set new password" :
                   "Owner Portal"}
                </h1>
                <p className="text-gray-500 text-sm mt-1">
                  {view === "signup" ? "List and manage your gym" :
                   view === "confirm-signup" ? `Code sent to ${email}` :
                   view === "forgot" ? "We'll send a reset code to your email" :
                   view === "reset-confirm" ? `Code sent to ${email}` :
                   view === "new-password" ? "Choose a permanent password" :
                   "Manage your gym listings"}
                </p>
              </div>

              {/* Info / error banners */}
              {info && (
                <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-800">
                  {info}
                </div>
              )}
              {error && (
                <p className="mb-4 text-sm text-red-500">{error}</p>
              )}

              {/* ── Login form ── */}
              {view === "login" && (
                <form onSubmit={handleLogin} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-sm font-medium text-gray-700">Password</label>
                      <button type="button" onClick={() => switchView("forgot")}
                        className="text-xs text-brand-orange hover:underline">
                        Forgot password?
                      </button>
                    </div>
                    <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <button type="submit" disabled={busy}
                    className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {busy ? "Signing in…" : "Sign In"}
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    Don&apos;t have an account?{" "}
                    <button type="button" onClick={() => switchView("signup")}
                      className="text-brand-orange hover:underline font-medium">
                      Sign up
                    </button>
                  </p>
                </form>
              )}

              {/* ── Sign Up form ── */}
              {view === "signup" && (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
                    <input type="text" required value={name} onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                    <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                    <p className="text-xs text-gray-400 mt-1">Min 8 characters, include uppercase, lowercase and a number</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
                    <input type="password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <button type="submit" disabled={busy}
                    className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {busy ? "Creating account…" : "Create Account"}
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    Already have an account?{" "}
                    <button type="button" onClick={() => switchView("login")}
                      className="text-brand-orange hover:underline font-medium">
                      Sign in
                    </button>
                  </p>
                </form>
              )}

              {/* ── Confirm sign-up ── */}
              {view === "confirm-signup" && (
                <form onSubmit={handleConfirmSignUp} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Verification code</label>
                    <input type="text" required value={code} onChange={(e) => setCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange tracking-widest text-center text-lg" />
                  </div>
                  <button type="submit" disabled={busy}
                    className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {busy ? "Verifying…" : "Verify Email"}
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    <button type="button" onClick={() => switchView("login")}
                      className="text-brand-orange hover:underline">
                      Back to sign in
                    </button>
                  </p>
                </form>
              )}

              {/* ── Forgot password ── */}
              {view === "forgot" && (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
                    <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <button type="submit" disabled={busy}
                    className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {busy ? "Sending…" : "Send Reset Code"}
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    <button type="button" onClick={() => switchView("login")}
                      className="text-brand-orange hover:underline">
                      Back to sign in
                    </button>
                  </p>
                </form>
              )}

              {/* ── Confirm reset ── */}
              {view === "reset-confirm" && (
                <form onSubmit={handleConfirmReset} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Reset code</label>
                    <input type="text" required value={code} onChange={(e) => setCode(e.target.value)}
                      placeholder="6-digit code"
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange tracking-widest text-center text-lg" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                    <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                    <input type="password" required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <button type="submit" disabled={busy}
                    className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {busy ? "Resetting…" : "Reset Password"}
                  </button>
                  <p className="text-center text-sm text-gray-500">
                    <button type="button" onClick={() => switchView("forgot")}
                      className="text-brand-orange hover:underline">
                      Resend code
                    </button>
                  </p>
                </form>
              )}

              {/* ── New password required (temp password challenge) ── */}
              {view === "new-password" && (
                <form onSubmit={handleNewPassword} className="space-y-4">
                  <p className="text-sm text-gray-600 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    Your account was set up with a temporary password. Please choose a permanent one to continue.
                  </p>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">New password</label>
                    <input type="password" required minLength={8} value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                    <p className="text-xs text-gray-400 mt-1">Min 8 characters, include uppercase, lowercase and a number</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
                    <input type="password" required value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)}
                      className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-orange" />
                  </div>
                  <button type="submit" disabled={busy}
                    className="w-full py-2.5 bg-brand-orange hover:bg-brand-orange-dark text-white font-semibold rounded-lg transition-colors disabled:opacity-50">
                    {busy ? "Saving…" : "Set Password & Continue"}
                  </button>
                </form>
              )}

            </div>
          </div>
        </Layout>
      </>
    );
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
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
