/* /api/admin/catalogue: the admin's catalogue edits. Needs the admin
   session cookie from sign-in.

   GET  the saved edits, { items: { id: { name, price, weight, tag, desc, status } } }
   PUT  replaces them. Only fields that differ from products.js are kept, and
        unknown items, fields or values are dropped. */
import { storeReady, redis, KEYS, readCatalogue } from "../_lib/store.js";
import { cleanSettings } from "../_lib/catalogue.js";
import { adminGuard, json } from "../_lib/auth.js";

export async function GET(request) {
  const denied = await adminGuard(request, storeReady);
  if (denied) return denied;
  try {
    return json(await readCatalogue());
  } catch (e) {
    console.error("read catalogue failed", e);
    return json({ error: "The catalogue could not be loaded." }, 500);
  }
}

export async function PUT(request) {
  const denied = await adminGuard(request, storeReady);
  if (denied) return denied;
  let body;
  try { body = await request.json(); } catch { return json({ error: "That request could not be read." }, 400); }
  try {
    const settings = cleanSettings(body);
    await redis("SET", KEYS.catalogue, JSON.stringify(settings));
    return json(settings);
  } catch (e) {
    console.error("save catalogue failed", e);
    return json({ error: "The catalogue could not be saved." }, 500);
  }
}
