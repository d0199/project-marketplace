/**
 * Stage affiliation test data via the dev API endpoint.
 *
 * Prerequisites: dev server running (npm run dev)
 * Run: npx tsx scripts/stage-affiliations.ts
 */

const BASE = "http://localhost:3000";

async function main() {
  console.log("Calling POST /api/dev/stage-affiliations...\n");

  const r = await fetch(`${BASE}/api/dev/stage-affiliations`, { method: "POST" });
  const data = await r.json();

  if (!r.ok) {
    console.error("Error:", data.error);
    if (data.log) data.log.forEach((l: string) => console.log("  " + l));
    process.exit(1);
  }

  console.log("Log:");
  data.log.forEach((l: string) => console.log("  " + l));

  console.log("\n--- Test Flow ---\n");
  const { ownerA, ownerB } = data.testFlow;
  console.log(`Owner A (${ownerA.ownerId}):`);
  console.log(`  PT: ${ownerA.pt.name} (${ownerA.pt.id})`);
  console.log(`  Gym: ${ownerA.gym.name} (${ownerA.gym.id})`);
  ownerA.actions.forEach((a: string) => console.log(`  → ${a}`));
  console.log();
  console.log(`Owner B (${ownerB.ownerId}):`);
  console.log(`  PT: ${ownerB.pt.name} (${ownerB.pt.id})`);
  console.log(`  Gym: ${ownerB.gym.name} (${ownerB.gym.id})`);
  ownerB.actions.forEach((a: string) => console.log(`  → ${a}`));
}

main().catch((err) => {
  console.error("Error:", err.message ?? err);
  process.exit(1);
});
