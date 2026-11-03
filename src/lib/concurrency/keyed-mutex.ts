const locks = new Map<string, Promise<void>>();

export async function withKeyedMutex<T>(
  keys: string[],
  fn: () => Promise<T> | T,
): Promise<T> {
  const uniqueKeys = [...new Set(keys)].sort();
  const previous = uniqueKeys.map((key) => locks.get(key) ?? Promise.resolve());
  let release: () => void = () => {};
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });

  for (const key of uniqueKeys) {
    locks.set(key, current);
  }

  await Promise.all(previous);

  try {
    return await fn();
  } finally {
    release();
    for (const key of uniqueKeys) {
      if (locks.get(key) === current) {
        locks.delete(key);
      }
    }
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function isSqliteBusy(error: unknown): boolean {
  return error instanceof Error && /SQLITE_BUSY|database is locked/i.test(error.message);
}
