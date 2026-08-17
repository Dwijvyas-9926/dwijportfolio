// Accepts a POST with the full portfolio content object and, if the caller
// proves they know the admin passphrase (its SHA-256 hash, matching the
// ADMIN_HASH environment variable), stores it as the new live content.
import { put } from "@vercel/blob";


const MAX_BYTES = 4 * 1024 * 1024;

function isValidShape(body) {
  return (
    body &&
    typeof body === "object" &&
    body.profile &&
    typeof body.profile.name === "string" &&
    Array.isArray(body.projects) &&
    Array.isArray(body.domains) &&
    Array.isArray(body.contact) &&
    Array.isArray(body.education)
  );
}

export default async function handler(req) {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const expected = process.env.ADMIN_HASH;
  if (!expected) {
    return new Response(
      "Server misconfigured: ADMIN_HASH environment variable is not set.",
      { status: 500 }
    );
  }

  const authHeader = req.headers.get("authorization") || "";
  const provided = authHeader.replace(/^Bearer\s+/i, "").trim();
  if (!provided || provided.toLowerCase() !== expected.toLowerCase()) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BYTES) {
      return new Response("Payload too large", { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!isValidShape(body)) {
    return new Response("Content does not match expected shape", {
      status: 422,
    });
  }

  try {
    await put("content.json", JSON.stringify(body), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response("Server error: " + err.message, { status: 500 });
  }
}
