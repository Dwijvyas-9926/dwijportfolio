// Returns the live, published portfolio content as JSON.
// Reads from Vercel Blob storage; if nothing has been published yet,
// returns 404 so the front-end falls back to the bundled ./content.json.
import { head } from "@vercel/blob";

export default async function handler(req, res) {
  try {
    const info = await head("content.json");
    const blobRes = await fetch(info.url, { cache: "no-store" });
    if (!blobRes.ok) {
      res.status(404).send("Not found");
      return;
    }
    const text = await blobRes.text();
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    res.status(200).send(text);
  } catch {
    res.status(404).send("Not found");
  }
}
