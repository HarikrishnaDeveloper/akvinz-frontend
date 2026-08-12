export const API_URL = `${process.env.NEXT_PUBLIC_API_URL!}/api`;

// Fetches a file (e.g. an invoice PDF) and triggers a browser download from
// an in-memory blob. Unlike navigating an <a href> directly to the URL, a
// failed request never replaces the current page with the server's raw
// error response — it just rejects, so callers can fail silently.
export async function downloadFile(url: string, filename?: string) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download file: ${res.status}`);
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  if (filename) a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(blobUrl);
}
