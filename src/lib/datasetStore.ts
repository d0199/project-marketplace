import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";
import { ALL_SPECIALTIES, ALL_AMENITIES, ALL_MEMBER_OFFERS, REPORT_ISSUE_TYPES } from "./utils";

type DatasetRecord = Schema["Dataset"]["type"];

export interface Dataset {
  id: string;
  name: string;
  entries: string[];
}

function toDataset(r: DatasetRecord): Dataset {
  return {
    id: r.id,
    name: r.name,
    entries: (r.entries?.filter(Boolean) ?? []) as string[],
  };
}

// Hardcoded fallback data for when DynamoDB isn't available
const FALLBACK_DATASETS: Record<string, string[]> = {
  specialties: [...ALL_SPECIALTIES],
  amenities: [...ALL_AMENITIES],
  "member-offers": [...ALL_MEMBER_OFFERS],
  "report-issues": [...REPORT_ISSUE_TYPES],
};

export const datasetStore = {
  async getAll(): Promise<Dataset[]> {
    const fallback = Object.entries(FALLBACK_DATASETS).map(([name, entries]) => ({
      id: `fallback-${name}`,
      name,
      entries,
    }));
    if (!isAmplifyConfigured()) return fallback;
    try {
      const results: DatasetRecord[] = [];
      let nextToken: string | null | undefined;
      do {
        const res = await dataClient.models.Dataset.list({ limit: 100, nextToken });
        results.push(...(res.data ?? []));
        nextToken = res.nextToken;
      } while (nextToken);

      if (results.length === 0) return fallback;

      // Merge: use DynamoDB records, fill in any missing fallback datasets
      const dbDatasets = results.map(toDataset);
      const dbNames = new Set(dbDatasets.map((d) => d.name));
      const missing = fallback.filter((f) => !dbNames.has(f.name));
      return [...dbDatasets, ...missing];
    } catch (err) {
      console.error("[datasetStore.getAll] DynamoDB error, using fallback:", err);
      return fallback;
    }
  },

  async getByName(name: string): Promise<Dataset | undefined> {
    const fallbackEntries = FALLBACK_DATASETS[name];
    const fallback = fallbackEntries ? { id: `fallback-${name}`, name, entries: fallbackEntries } : undefined;
    if (!isAmplifyConfigured()) return fallback;
    try {
      const { data } = await dataClient.models.Dataset.list({
        filter: { name: { eq: name } },
        limit: 1,
      });
      return data?.[0] ? toDataset(data[0]) : fallback;
    } catch (err) {
      console.error(`[datasetStore.getByName] DynamoDB error for "${name}", using fallback:`, err);
      return fallback;
    }
  },

  async create(name: string, entries: string[]): Promise<Dataset> {
    if (!isAmplifyConfigured()) throw new Error("Backend not configured");
    const { data } = await dataClient.models.Dataset.create({ name, entries });
    if (!data) throw new Error("Failed to create dataset");
    return toDataset(data);
  },

  async update(id: string, entries: string[]): Promise<void> {
    if (!isAmplifyConfigured()) return;
    const { errors } = await dataClient.models.Dataset.update({ id, entries });
    if (errors?.length) console.error("[datasetStore.update] errors:", JSON.stringify(errors));
  },

  async delete(id: string): Promise<void> {
    if (!isAmplifyConfigured()) return;
    await dataClient.models.Dataset.delete({ id });
  },
};
