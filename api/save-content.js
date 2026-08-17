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

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).send("Method not allowed");
    return;
  }

  const expected = process.env.ADMIN_HASH;
  if (!expected) {
    res
      .status(500)
      .send("Server misconfigured: ADMIN_HASH environment variable is not set.");
    return;
  }

  const authHeader = req.headers["authorization"] || "";
  const provided = String(authHeader).replace(/^Bearer\s+/i, "").trim();
  if (!provided || provided.toLowerCase() !== expected.toLowerCase()) {
    res.status(401).send("Unauthorized");
    return;
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch {
      res.status(400).send("Invalid JSON");
      return;
    }
  }

  if (!body || typeof body !== "object") {
    res.status(400).send("Invalid JSON");
    return;
  }

  const raw = JSON.stringify(body);
  if (raw.length > MAX_BYTES) {
    res.status(413).send("Payload too large");
    return;
  }

  if (!isValidShape(body)) {
    res.status(422).send("Content does not match expected shape");
    return;
  }

  try {
    await put("content.json", raw, {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: "application/json",
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    res.status(500).send("Server error: " + err.message);
  }
}
