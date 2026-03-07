// src/api/client.ts
const API_URL = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export async function apiFetch(endpoint: string, options: RequestInit = {}) {
  const normalizedEndpoint = endpoint.replace(/^\//, "");

  const res = await fetch(`${API_URL}/${normalizedEndpoint}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }

  return res.json();
}
