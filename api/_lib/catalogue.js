/* Mishri Sweet House. The catalogue as the server sees it: products.js
   with the admin's saved edits applied. Orders are priced from this, never
   from prices the browser sends. */
import shop from "../../products.js";

const { PRODUCTS, GIFT_BOXES, DELIVERY } = shop;
export { DELIVERY };

const BASE = [...PRODUCTS, ...GIFT_BOXES];
const TEXT_FIELDS = { name: 80, weight: 40, tag: 30, desc: 400 };
const STATUSES = ["live", "soldout", "hidden"];

export const baseItem = (id) => BASE.find((p) => p.id === id);

// Same rules as store-settings.js applies in the browser.
export function effectiveItem(id, settings) {
  const base = baseItem(id);
  if (!base) return null;
  const edit = (settings && settings.items && settings.items[id]) || {};
  const item = { ...base, status: edit.status || "live" };
  for (const k of ["name", "price", "weight", "tag", "desc"]) {
    if (edit[k] !== undefined && (edit[k] !== "" || k === "tag")) item[k] = edit[k];
  }
  return item;
}

/* Accepts only known items, fields and sane values, so the public catalogue
   script can never carry anything the admin form could not produce. */
export function cleanSettings(input) {
  const out = { items: {} };
  const items = input && typeof input.items === "object" && input.items ? input.items : {};
  for (const [id, edit] of Object.entries(items)) {
    if (!baseItem(id) || !edit || typeof edit !== "object") continue;
    const clean = {};
    for (const [k, max] of Object.entries(TEXT_FIELDS)) {
      if (typeof edit[k] === "string") clean[k] = edit[k].trim().slice(0, max);
    }
    if (clean.name === "") delete clean.name;
    if (clean.weight === "") delete clean.weight;
    if (clean.desc === "") delete clean.desc;
    if (Number.isInteger(edit.price) && edit.price >= 1 && edit.price <= 1000000) clean.price = edit.price;
    if (STATUSES.includes(edit.status) && edit.status !== "live") clean.status = edit.status;
    if (Object.keys(clean).length) out.items[id] = clean;
  }
  return out;
}
