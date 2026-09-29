import { flagsSchema, type Flags } from '@repo/shared';

const FLAGS_KEY = 'flags';
const INDEX_VERSION_KEY = 'rag:index:current';

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
