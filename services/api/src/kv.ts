import { flagsSchema, type Flags } from '@repo/shared';

const FLAGS_KEY = 'flags';
const INDEX_VERSION_KEY = 'rag:index:current';
const INDEX_ENTRIES_PREFIX = 'rag:index:v';
export const DIGEST_PREFIX = 'digest:';

export const DEFAULT_FLAGS: Flags = {
  killSwitch: false,
  imageGenEnabled: false,
  chatMode: 'full',
};

export async function readFlags(kv: KVNamespace): Promise<Flags> {
  const stored = await kv.get(FLAGS_KEY, 'json');
  const parsed = flagsSchema.safeParse(stored);
  return parsed.success ? parsed.data : DEFAULT_FLAGS;
}

export async function writeFlags(kv: KVNamespace, flags: Flags): Promise<void> {
  await kv.put(FLAGS_KEY, JSON.stringify(flags));
}

export async function readIndexVersion(kv: KVNamespace): Promise<number> {
  const stored = await kv.get(INDEX_VERSION_KEY);
  const version = Number(stored);
  return Number.isInteger(version) && version > 0 ? version : 0;
}

export function indexEntriesKey(version: number): string {
  return `${INDEX_ENTRIES_PREFIX}${version}`;
}

export async function writeIndexVersion(kv: KVNamespace, version: number): Promise<void> {
  await kv.put(INDEX_VERSION_KEY, String(version));
}
