/* Mishri Sweet House. Applies the changes saved in admin.html on top of
   products.js, so the storefront shows the shop's current prices, copy and
   availability without editing the catalogue file.

   Load it after products.js and before app.js. Settings live in this
   browser's localStorage under "mishri-admin":

     { items: { "<id>": { name, price, weight, tag, desc, status } } }

   status is "live" (default), "soldout" (shown, cannot be added) or
   "hidden" (removed from the storefront). */
(function () {
  "use strict";
  let settings = null;
  try { settings = JSON.parse(localStorage.getItem("mishri-admin") || "null"); } catch { settings = null; }
  if (!settings || !settings.items) return;

  const FIELDS = ["name", "price", "weight", "tag", "desc"];
  [PRODUCTS, GIFT_BOXES].forEach((list) => {
    for (let i = list.length - 1; i >= 0; i--) {
      const edit = settings.items[list[i].id];
      if (!edit) continue;
      if (edit.status === "hidden") { list.splice(i, 1); continue; }
      FIELDS.forEach((k) => { if (edit[k] !== undefined && edit[k] !== "") list[i][k] = edit[k]; });
      if (edit.tag === "") list[i].tag = "";
      if (edit.status === "soldout") list[i].soldOut = true;
    }
  });
})();
