export function fakeKv(entries: Record<string, unknown> = {}): KVNamespace {
  const store = new Map<string, string>(
    Object.entries(entries).map(([key, value]) => [
      key,
      typeof value === 'string' ? value : JSON.stringify(value),
    ]),
  );

  return {
    get: async (key: string, type?: string) => {
      const value = store.get(key);
      if (value === undefined) return null;
      return type === 'json' ? JSON.parse(value) : value;
    },
    put: async (key: string, value: string) => {
      store.set(key, value);
    },
  } as unknown as KVNamespace;
}
