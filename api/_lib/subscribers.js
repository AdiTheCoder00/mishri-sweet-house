/* Mishri Sweet House. The "Notify me" list for festival boxes.

   Keys:
     mishri:subscribers        ZSET  email addresses, scored by sign-up time
     mishri:sub:<email>        JSON  { email, at, token }
     mishri:unsub:<token>      STR   the email a one-click unsubscribe link belongs to */
import { redis, pipeline } from "./store.js";

const LIST = "mishri:subscribers";
const subKey = (email) => `mishri:sub:${email}`;
const unsubKey = (token) => `mishri:unsub:${token}`;

const newToken = () => [...crypto.getRandomValues(new Uint8Array(18))].map((b) => b.toString(16).padStart(2, "0")).join("");
export const unsubscribeUrl = (siteUrl, token) => `${siteUrl}/api/unsubscribe?token=${token}`;

// Returns { created, token }; signing up twice keeps the first sign-up.
export async function addSubscriber(email) {
  const existing = await redis("GET", subKey(email));
  if (existing) {
    try { return { created: false, token: JSON.parse(existing).token }; } catch {}
  }
  const record = { email, at: new Date().toISOString(), token: newToken() };
  await pipeline([
    ["SET", subKey(email), JSON.stringify(record)],
    ["SET", unsubKey(record.token), email],
    ["ZADD", LIST, String(Date.now()), email],
  ]);
  return { created: true, token: record.token };
}

export async function removeSubscriber(email) {
  const raw = await redis("GET", subKey(email));
  if (!raw) return false;
  let token = "";
  try { token = JSON.parse(raw).token; } catch {}
  await pipeline([["DEL", subKey(email)], ["ZREM", LIST, email], ...(token ? [["DEL", unsubKey(token)]] : [])]);
  return true;
}

export async function removeByToken(token) {
  if (typeof token !== "string" || !/^[0-9a-f]{36}$/.test(token)) return null;
  const email = await redis("GET", unsubKey(token));
  if (!email) return null;
  await removeSubscriber(email);
  return email;
}

// Newest first.
export async function listSubscribers() {
  const emails = await redis("ZRANGE", LIST, "0", "-1", "REV");
  if (!emails || !emails.length) return [];
  const raws = await redis("MGET", ...emails.map(subKey));
  return raws.map((r) => { try { return JSON.parse(r); } catch { return null; } }).filter(Boolean);
}
