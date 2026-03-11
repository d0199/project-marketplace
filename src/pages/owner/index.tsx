import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import {
  signIn,
  signUp,
  confirmSignUp,
  confirmSignIn,
  resetPassword,
  confirmResetPassword,
  getCurrentUser,
  fetchUserAttributes,
} from "aws-amplify/auth";
import Layout from "@/components/Layout";
import { trackEvent } from "@/lib/gtag";

type View = "login" | "signup" | "confirm-signup" | "forgot" | "reset-confirm" | "new-password";

export default function OwnerPortalPage() {
  const router = useRouter();
  const redirectTo = (router.query.redirect as string) || "/billing";
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

  function postLoginRedirect(attributes: Record<string, string | undefined>) {
    if (attributes["custom:isAdmin"] === "true") {
      router.replace("/admin");
    } else {
      router.replace(redirectTo);
    }
  }

  function resetForm() {
    setError(""); setInfo(""); setPassword(""); setConfirmPassword("");
    setCode(""); setNewPassword(""); setConfirmNewPassword("");
  }

  function switchView(v: View) { resetForm(); setView(v); }

  const isDev = process.env.NODE_ENV === "development";

  useEffect(() => {
    getCurrentUser()
      .then(async () => {
        const attributes = await fetchUserAttributes();
        postLoginRedirect(attributes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, redirectTo]);

  function devLogin(ownerId: string, email: string) {
    sessionStorage.setItem("devSession", JSON.stringify({ ownerId, email, name: email.split("@")[0] }));
    router.push(redirectTo);
  }


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
      const attributes = await fetchUserAttributes();
      postLoginRedirect(attributes);
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
      trackEvent("sign_up", { method: "email" });
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
      const attributes = await fetchUserAttributes();
      postLoginRedirect(attributes);
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
      const attributes = await fetchUserAttributes();
      postLoginRedirect(attributes);
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
  return (
      <>
        <Head>
          <title>Owner Portal — mynextgym.com.au</title>
        </Head>
        <Layout>
          <div className="max-w-md mx-auto mt-12">
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-8">

              {/* Dev login bypass */}
              {isDev && view === "login" && (
                <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-xs font-semibold text-yellow-800 mb-2">Dev Login</p>
                  <div className="flex flex-col gap-1.5">
                    <button onClick={() => devLogin("owner-1", "owner@mynextgym.com.au")} className="text-left text-xs px-2 py-1.5 bg-white border rounded hover:bg-yellow-100">owner-1 — Gyms + PTs (Sarah, Marcus)</button>
                    <button onClick={() => devLogin("owner-2", "owner2@mynextgym.com.au")} className="text-left text-xs px-2 py-1.5 bg-white border rounded hover:bg-yellow-100">owner-2 — Gyms + PT (Emma)</button>
                  </div>
                </div>
              )}

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
