import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";

// ---------------------------------------------------------------------------
// In-memory seed data for local dev (no DynamoDB)
// ---------------------------------------------------------------------------
const seedAffiliations: Affiliation[] = [
  {
    id: "aff-001",
    ptId: "pt-001",
    ptName: "Sarah Mitchell",
    gymId: "gym-001",
    gymName: "Anytime Fitness",
    requestedBy: "pt",
    status: "approved",
    requestedAt: "2026-02-15T08:00:00Z",
  },
  {
    id: "aff-002",
    ptId: "pt-002",
    ptName: "Marcus Chen",
    gymId: "gym-001",
    gymName: "Anytime Fitness",
    requestedBy: "pt",
    status: "approved",
    requestedAt: "2026-02-20T10:00:00Z",
  },
  {
    id: "aff-003",
    ptId: "pt-002",
    ptName: "Marcus Chen",
    gymId: "gym-002",
    gymName: "Snap Fitness 24/7 Perth CBD",
    requestedBy: "pt",
    status: "approved",
    requestedAt: "2026-02-22T09:00:00Z",
  },
  {
    id: "aff-004",
    ptId: "pt-003",
    ptName: "Emma Williams",
    gymId: "gym-003",
    gymName: "Surge Fitness | Club One",
    requestedBy: "pt",
    status: "approved",
    requestedAt: "2026-03-01T07:00:00Z",
  },
  {
    id: "aff-005",
    ptId: "pt-004",
    ptName: "Jake Thompson",
    gymId: "gym-004",
    gymName: "Snap Fitness Perth City 24/7",
    requestedBy: "pt",
    status: "pending",
    requestedAt: "2026-03-08T14:00:00Z",
  },
  {
    id: "aff-006",
    ptId: "pt-003",
    ptName: "Emma Williams",
    gymId: "gym-001",
    gymName: "Anytime Fitness",
    requestedBy: "pt",
    status: "pending",
    requestedAt: "2026-03-09T11:00:00Z",
  },
];

export interface Affiliation {
  id: string;
  ptId: string;
  ptName?: string;
  gymId: string;
  gymName?: string;
  requestedBy: string; // "pt" | "gym"
  status: string;      // "pending" | "approved" | "rejected"
  notes?: string;
  requestedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

type AffRecord = Schema["Affiliation"]["type"];

function toAffiliation(r: AffRecord): Affiliation {
  return {
    id: r.id,
    ptId: r.ptId,
    ptName: r.ptName ?? undefined,
    gymId: r.gymId,
    gymName: r.gymName ?? undefined,
    requestedBy: r.requestedBy ?? "pt",
    status: r.status ?? "pending",
    notes: r.notes ?? undefined,
    requestedAt: r.requestedAt ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function isModelAvailable(): boolean {
  return isAmplifyConfigured() && !!dataClient.models.Affiliation;
}

export const affiliationStore = {
  async getByPtId(ptId: string): Promise<Affiliation[]> {
    if (!isModelAvailable()) return seedAffiliations.filter((a) => a.ptId === ptId);
    const results: AffRecord[] = [];
    let nextToken: string | null | undefined;
    do {
      const res = await dataClient.models.Affiliation.listAffiliationByPtId(
        { ptId },
        { limit: 100, nextToken }
      );
      results.push(...(res.data ?? []));
      nextToken = res.nextToken;
    } while (nextToken);
    return results.map(toAffiliation);
  },

  async getByGymId(gymId: string): Promise<Affiliation[]> {
    if (!isModelAvailable()) return seedAffiliations.filter((a) => a.gymId === gymId);
    const results: AffRecord[] = [];
    let nextToken: string | null | undefined;
    do {
      const res = await dataClient.models.Affiliation.listAffiliationByGymId(
        { gymId },
        { limit: 100, nextToken }
      );
      results.push(...(res.data ?? []));
      nextToken = res.nextToken;
    } while (nextToken);
    return results.map(toAffiliation);
  },

  async getById(id: string): Promise<Affiliation | undefined> {
    if (!isModelAvailable()) return seedAffiliations.find((a) => a.id === id);
    const { data } = await dataClient.models.Affiliation.get({ id });
    return data ? toAffiliation(data) : undefined;
  },

  async create(aff: Omit<Affiliation, "id" | "createdAt" | "updatedAt">): Promise<Affiliation> {
    if (!isAmplifyConfigured()) throw new Error("Backend not configured");
    const { data } = await dataClient.models.Affiliation.create({
      ptId: aff.ptId,
      ptName: aff.ptName,
      gymId: aff.gymId,
      gymName: aff.gymName,
      requestedBy: aff.requestedBy,
      status: aff.status ?? "pending",
      notes: aff.notes,
      requestedAt: aff.requestedAt ?? new Date().toISOString(),
    });
    if (!data) throw new Error("Failed to create affiliation");
    return toAffiliation(data);
  },

  async updateStatus(id: string, status: string, notes?: string): Promise<void> {
    if (!isAmplifyConfigured()) return;
    await dataClient.models.Affiliation.update({ id, status, ...(notes != null && { notes }) });
  },

  async delete(id: string): Promise<void> {
    if (!isAmplifyConfigured()) return;
    await dataClient.models.Affiliation.delete({ id });
  },
};
