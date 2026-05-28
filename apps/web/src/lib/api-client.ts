/**
 * Thin fetch wrapper for talking to apps/api.
 *
 * Usage with TanStack Query:
 *   useQuery({ queryKey: ['items'], queryFn: () => apiFetch<Item[]>('/items') })
 *
 * Auth: pass the Clerk session token via getToken() — wire that up per project.
 * In the template, no pages call this — left here as the canonical helper to extend.
 */

const baseUrl = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type ApiError = {
  error: string;
  message?: string;
  status: number;
};

export async function apiFetch<T>(
  path: string,
  init?: RequestInit & { token?: string },
): Promise<T> {
  const { token, headers, ...rest } = init ?? {};
  const res = await fetch(`${baseUrl}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err: ApiError = {
      error: body.error ?? 'request_failed',
      message: body.message,
      status: res.status,
    };
    throw err;
  }

  return res.json() as Promise<T>;
}
