export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5001";
export const UPLOADS_BASE = `${API_BASE}/uploads`;

const TOKEN_KEY = "adminToken";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setAdminToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export async function adminFetch(path: string, options: RequestInit = {}) {
  const token = getAdminToken();
  // FormData bodies (file uploads) must not get a manual Content-Type — the
  // browser sets one with the multipart boundary itself.
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  if (res.status === 401 && typeof window !== "undefined") {
    clearAdminToken();
    window.location.href = "/admin/login";
  }

  return res;
}
