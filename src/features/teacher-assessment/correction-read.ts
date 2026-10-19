/** Read-only deadline: late results cannot replace a failed attempt. */
export const CORRECTION_READ_TIMEOUT_MS = 15_000;
export async function readCorrectionWithDeadline<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("correction-read-timeout")), CORRECTION_READ_TIMEOUT_MS);
    })]);
  } finally { clearTimeout(timer); }
}

/** Bounded parallel reads reuse the canonical key reader, without widening access. */
export async function readCorrectionKeys(ids: readonly string[], read: (id: string) => Promise<{ answer: unknown }[]>): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  const keys = new Map<string, string>();
  for (let start = 0; start < unique.length; start += 6) {
    const batch = await Promise.all(unique.slice(start, start + 6).map(async (id) => {
      const answer = (await read(id))[0]?.answer;
      const value = typeof answer === "string" ? answer : Array.isArray(answer) && answer.length === 1 ? String(answer[0]) : null;
      return { id, value };
    }));
    for (const { id, value } of batch) if (value) keys.set(id, value);
  }
  return keys;
}