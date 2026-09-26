/* In a real browser (Playwright + Chromium): the demo shop, the policy
   pages, and a live order followed through Track your order.

   Skipped when Playwright isn't installed. To run it locally:
     npm install --no-save playwright && npx playwright install chromium
     node --test tests/                                                   */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { ROOT, SENTRY_DSN } from "./helpers/harness.mjs";

let chromium;
try {
  ({ chromium } = createRequire(path.join(ROOT, "package.json"))(process.env.PLAYWRIGHT_MODULE || "playwright"));
} catch {}
const skip = chromium ? false : "Playwright is not installed";

const PASSWORD = "e2e-password";
const servers = [];
function startServer(port, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, "tests/helpers/serve-mocked.mjs")], {
      env: { ...process.env, PORT: String(port), ADMIN_PASSWORD: PASSWORD, ...env },
      stdio: ["ignore", "pipe", "inherit"],
    });
    servers.push(child);
    child.stdout.on("data", (d) => { if (String(d).includes("running at")) resolve(`http://127.0.0.1:${port}`); });
    child.on("exit", (code) => reject(new Error("server exited " + code)));
  });
}

let browser, DEMO, LIVE;
const pageErrors = [];
async function newPage(options = {}) {
  const context = await browser.newContext(options);
  // Fonts, icons and analytics are not the site's own; don't wait on them.
  await context.route(/^https?:\/\/(?!127\.0\.0\.1)/, (route) => route.abort());
  await context.route(/\/_vercel\//, (route) => route.fulfill({ contentType: "text/javascript", body: "" }));
  const page = await context.newPage();
  page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message}`));
  return page;
}

before(async () => {
  if (skip) return;
  browser = await chromium.launch();
  [DEMO, LIVE] = await Promise.all([startServer(5301, { STORAGE: "0" }), startServer(5302, { STORAGE: "1", SENTRY_DSN })]);
});

after(async () => {
  if (browser) await browser.close();
  servers.forEach((s) => s.kill());
});

test("the demo shop loads without script errors", { skip }, async () => {
  const page = await newPage();
  await page.goto(DEMO + "/");
  await page.waitForSelector("#product-grid .product");
  assert.ok(await page.locator("#product-grid .product").count() >= 12);
  await page.goto(DEMO + "/sweets/kaju-katli/");
  await page.waitForSelector("h1");
  assert.deepEqual(pageErrors, []);
});

test("policy pages render inside the site, linked from the footer", { skip }, async () => {
  const page = await newPage();
  await page.goto(DEMO + "/");
  await page.click('footer a[href="policies/refunds/"]');
  await page.waitForURL(/\/policies\/refunds\/$/);
  assert.equal(await page.textContent("h1"), "Refunds and cancellations");
  assert.ok(await page.locator(".doc-section").count() >= 3);
  assert.ok(await page.locator('.doc a[href="https://wa.me/918744667777"]').count() >= 1, "WhatsApp number is linked");
  await page.click('.doc-more a[href="../../policies/privacy/"]');
  assert.equal(await page.textContent("h1"), "Privacy policy");
  assert.deepEqual(pageErrors, []);
});

test("phones: policy and tracking pages fit the screen", { skip }, async () => {
  const page = await newPage({ viewport: { width: 320, height: 640 } });
  for (const p of ["/policies/terms/", "/track/"]) {
    await page.goto(DEMO + p);
    await page.waitForSelector("h1");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert.equal(overflow, 0, p + " scrolls sideways");
  }
});

test("demo shop: tracking explains it starts when the shop is live", { skip }, async () => {
  const page = await newPage();
  await page.goto(DEMO + "/track/?no=MSH-100001");
  assert.equal(await page.inputValue("#track-no"), "MSH-100001", "prefilled from the link");
  await page.fill("#track-phone", "98765 43210");
  await page.click("#track-submit");
  await page.waitForSelector("#track-result:not([hidden])");
  assert.match(await page.textContent("#track-result"), /when the shop goes live/);
});

test("live shop: place an order, then track it as the admin moves it along", { skip }, async () => {
  const page = await newPage();
  await page.goto(LIVE + "/");
  await page.evaluate(() => localStorage.setItem("mishri-cart", JSON.stringify([{ id: "kaju-katli", qty: 2 }])));
  await page.reload();
  await page.click("#cart-open");
  await page.click("#checkout-open");
  await page.fill("#co-name", "Asha Verma");
  await page.fill("#co-phone", "98765 43210");
  await page.fill("#co-address", "12 MI Road, C-Scheme");
  await page.fill("#co-city", "Jaipur");
  await page.fill("#co-pin", "302001");
  await page.click("#place-order");
  await page.waitForSelector("#order-success:not([hidden])");
  const receipt = await page.textContent("#order-success-text");
  const no = receipt.match(/MSH-\d+/)[0];

  await page.click(".receipt-track");
  await page.waitForURL(/\/track\/\?no=MSH-/);
  assert.equal(await page.inputValue("#track-no"), no);
  await page.fill("#track-phone", "9000000000");
  await page.click("#track-submit");
  await page.waitForSelector("#track-error:not([hidden])");
  assert.match(await page.textContent("#track-error"), /couldn't find/);

  await page.fill("#track-phone", "+91 98765 43210");
  await page.click("#track-submit");
  await page.waitForSelector("#track-result:not([hidden])");
  assert.ok(await page.isHidden("#track-error"));
  assert.match(await page.textContent(".track-head"), /reaches Jaipur today by evening/);
  assert.match(await page.textContent('.track-step[aria-current="step"]'), /Order received/);
  assert.match(await page.textContent("#track-result .receipt"), /Kaju Katli × 2/);

  // The shop marks it as being prepared.
  const signIn = await fetch(LIVE + "/admin/login", { method: "POST", body: new URLSearchParams({ password: PASSWORD }), redirect: "manual" });
  const cookie = signIn.headers.get("set-cookie").split(";")[0];
  const patched = await fetch(LIVE + "/api/admin/orders", { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ no, status: "preparing" }) });
  assert.equal(patched.status, 200);

  await page.click("#track-submit");
  await page.waitForFunction(() => /Being made fresh/.test(document.querySelector('.track-step[aria-current="step"]')?.textContent || ""));
  assert.equal(await page.locator(".track-step.is-done").count(), 1);
  assert.deepEqual(pageErrors, []);
});

test("with Sentry switched on, a script error in the page is reported once", { skip }, async () => {
  const page = await newPage();
  const reports = [];
  await page.context().route("https://o1.ingest.sentry.io/**", (route) => {
    reports.push(route.request().postData().split("\n").map((l) => JSON.parse(l))[2]);
    route.fulfill({ status: 200, body: "{}" });
  });
  await page.goto(LIVE + "/");
  assert.equal(await page.evaluate(() => window.MishriMonitor.enabled), true);
  const before = pageErrors.length;
  for (let i = 0; i < 2; i++) await page.evaluate(() => setTimeout(() => { throw new Error("boom from the test"); }, 0));
  await page.waitForTimeout(500);
  pageErrors.splice(before); // expected, not a failure of the site
  assert.equal(reports.length, 1, "the same error twice is reported once");
  assert.equal(reports[0].exception.values[0].value, "boom from the test");
  assert.equal(reports[0].tags.page, "/");
  assert.equal(reports[0].request.url, LIVE + "/");

  const demo = await newPage();
  await demo.goto(DEMO + "/");
  assert.equal(await demo.evaluate(() => window.MishriMonitor.enabled), false, "off without SENTRY_DSN");
});
