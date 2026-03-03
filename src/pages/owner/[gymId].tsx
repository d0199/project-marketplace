import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import Head from "next/head";
import Link from "next/link";
import { getCurrentUser, fetchUserAttributes } from "aws-amplify/auth";
import Layout from "@/components/Layout";
import OwnerGymForm from "@/components/OwnerGymForm";
import type { OwnerSession, Gym } from "@/types";

export default function EditGymPage() {
  const router = useRouter();
  const { gymId } = router.query;

  const [session, setSession] = useState<OwnerSession | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    getCurrentUser()
      .then(async (user) => {
        const attributes = await fetchUserAttributes();
        setSession({
          ownerId: attributes["custom:ownerId"] ?? "",
          email: user.signInDetails?.loginId ?? "",
          name: attributes.name ?? attributes.email ?? "",
        });
      })
      .catch(() => {
        router.replace("/owner");
      });
  }, [router]);

  useEffect(() => {
    if (!gymId || !session) return;
    fetch(`/api/owner/gym/${gymId}`)
      .then((r) => {
        if (!r.ok) throw new Error("Not found");
        return r.json();
      })
      .then((data: Gym) => {
        if (data.ownerId !== session.ownerId) {
          setError("You don't have permission to edit this gym.");
        } else {
          setGym(data);
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Gym not found.");
        setLoading(false);
      });
  }, [gymId, session]);

  async function handleSave(updated: Gym) {
    await fetch(`/api/owner/gym/${gymId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updated),
    });
    setGym(updated);
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex justify-center py-20 text-gray-400">
          Loading…
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="text-center py-20">
          <p className="text-red-500 text-lg mb-4">{error}</p>
          <Link href="/owner" className="text-brand-orange hover:underline">
            Back to dashboard
          </Link>
        </div>
      </Layout>
    );
  }

  if (!gym) return null;

  return (
    <>
      <Head>
        <title>Edit {gym.name} — mynextgym.com.au</title>
      </Head>
      <Layout>
        <nav className="text-sm text-gray-500 mb-6">
          <Link href="/owner" className="hover:text-brand-orange">
            Dashboard
          </Link>
          {" / "}
          <span className="text-gray-800 font-medium">Edit {gym.name}</span>
        </nav>

        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Edit Gym Profile
          </h1>
          <OwnerGymForm gym={gym} onSave={handleSave} />
        </div>
      </Layout>
    </>
  );
}
