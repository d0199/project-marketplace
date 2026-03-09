import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";

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

export const affiliationStore = {
  async getByPtId(ptId: string): Promise<Affiliation[]> {
    if (!isAmplifyConfigured()) return [];
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
    if (!isAmplifyConfigured()) return [];
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
    if (!isAmplifyConfigured()) return undefined;
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
