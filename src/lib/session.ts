export async function sessionToken(password: string) {
  const bytes = new TextEncoder().encode(`nis2-local-session-v1:${password}`);
  return Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
