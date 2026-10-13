// Edge-compatible verification of the existing session cookie contract.
export async function verifyEdgeSession(
  raw: string | undefined,
  signature: string | undefined,
  secret: string,
) {
  if (
    !raw ||
    !signature ||
    !secret ||
    raw.length > 20000 ||
    !/^[A-Za-z0-9_-]{43}$/.test(signature)
  )
    return null;
  try {
    const bytes = Uint8Array.from(
      atob(signature.replace(/-/g, "+").replace(/_/g, "/") + "="),
      (c) => c.charCodeAt(0),
    );
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    if (
      !(await crypto.subtle.verify(
        "HMAC",
        key,
        bytes,
        new TextEncoder().encode(raw),
      ))
    )
      return null;
    const value = JSON.parse(decodeURIComponent(raw));
    return value &&
      typeof value.S_USER_ID === "string" &&
      value.S_USER_ID &&
      typeof value.S_SESSION_ID === "string" &&
      value.S_SESSION_ID
      ? value
      : null;
  } catch {
    return null;
  }
}
