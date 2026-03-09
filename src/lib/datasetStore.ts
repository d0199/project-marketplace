import { dataClient, isAmplifyConfigured } from "./amplifyServerConfig";
import type { Schema } from "../../amplify/backend";
import { ALL_SPECIALTIES } from "./utils";

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
};

export const datasetStore = {
  async getAll(): Promise<Dataset[]> {
    if (!isAmplifyConfigured()) {
      return Object.entries(FALLBACK_DATASETS).map(([name, entries], i) => ({
        id: `fallback-${i}`,
        name,
        entries,
      }));
    }
    const results: DatasetRecord[] = [];
    let nextToken: string | null | undefined;
    do {
      const res = await dataClient.models.Dataset.list({ limit: 100, nextToken });
      results.push(...(res.data ?? []));
      nextToken = res.nextToken;
    } while (nextToken);
    return results.map(toDataset);
  },

  async getByName(name: string): Promise<Dataset | undefined> {
    if (!isAmplifyConfigured()) {
      const entries = FALLBACK_DATASETS[name];
      return entries ? { id: "fallback", name, entries } : undefined;
    }
    const { data } = await dataClient.models.Dataset.list({
      filter: { name: { eq: name } },
      limit: 1,
    });
    return data?.[0] ? toDataset(data[0]) : undefined;
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
