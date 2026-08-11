export const API_URL = `${process.env.NEXT_PUBLIC_API_URL!}/api`;

// Triggers a browser download for a URL the server serves with
// Content-Disposition: attachment (e.g. invoice PDFs), without opening a
// new tab or tripping popup blockers.
export function downloadFile(url: string) {
  const a = document.createElement("a");
  a.href = url;
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
