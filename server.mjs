// Tiny shop backend: JSON-file database + Server-Sent Events so every open browser updates live.
// Run with `npm run dev`. Admin PIN: set ADMIN_PIN (default "admin123").
import http from "node:http";
import fs from "node:fs";
import nodePath from "node:path";

const PIN = process.env.ADMIN_PIN || "admin123", FILE = "data/db.json", DAY = 864e5;
const STEPS = ["Order Received", "Processing", "Packed", "Shipped", "Out for Delivery", "Delivered"];
const CODES = { CUTE10: 0.1, TREAT20: 0.2, FREESHIP: 0 };

const P = (id, name, price, characterId, [bg, accent, pattern], decor, category, stock, discount, sold, added, description, rating, reviewCount, flashDiscount) =>
  ({ id, name, image: `/products/${id}.jpg`, price, rating, reviewCount, characterId, theme: { bg, accent, pattern }, decor, category, stock, discount, flashDiscount, flash: flashDiscount > 0, sold, createdAt: Date.now() - added * DAY, description });
const seed = [
  P("plushie", "Cuddle Plushie", 799, "cooky", ["#ffe3ef", "#ff8fbf", "hearts"], ["💕", "🎀", "✨"], "Plushies", 25, 0, 310, 30, "Squishy, huggable and extra fluffy.", 4.9, 26, 20),
  P("notebook", "Dreamy Notebook", 249, "koya", ["#ece4ff", "#a58bff", "stripes"], ["⭐", "☁️", "✨"], "Stationery", 3, 0, 120, 4, "Dotted pages for big dreams and tiny doodles.", 4.4, 18, 0),
  P("mug", "Cozy Cocoa Mug", 349, "shooky", ["#fff6c9", "#ffc94d", "dots"], ["💕", "⭐", "🌸"], "Mugs & Tumblers", 12, 0, 240, 12, "Holds cocoa and a little bit of cuddles.", 4.8, 31, 10),
  P("tote", "Meadow Tote Bag", 499, "mang", ["#ddf7e9", "#6fd3a0", "checks"], ["🌸", "✨", "☁️"], "Bags", 8, 10, 90, 45, "Roomy canvas tote with a meadow print.", 4.3, 12, 0),
  P("phonecase", "Pocket Pal Phone Case", 429, "tata", ["#dcefff", "#6cb8ff", "dots"], ["⭐", "💕", "✨"], "Phone Accessories", 0, 0, 200, 20, "Slim, shock-absorbing and very cute.", 4.7, 22, 15),
  P("keychain", "Twinkle Keychain", 149, "chimmy", ["#fff4c4", "#ffb938", "stripes"], ["✨", "🎀", "⭐"], "Keychains", 40, 0, 400, 2, "A tiny twinkle for your keys or bag.", 4.5, 40, 0),
  P("hoodie", "Snuggle Hoodie", 1299, "rj", ["#ffe5d6", "#ff9d6c", "hearts"], ["☁️", "💕", "🌸"], "Clothing", 6, 0, 150, 60, "Cloud-soft fleece for snuggly days.", 4.9, 15, 25),
  P("tumbler", "Sip-Sip Tumbler", 599, "koya", ["#dff1ff", "#7ec4ff", "checks"], ["⭐", "✨", "🎀"], "Mugs & Tumblers", 18, 0, 280, 7, "Stays cold for 12 hours. Sip, sip!", 4.8, 28, 0),
  P("pillow", "Chimmy Cuddle Pillow", 899, "chimmy", ["#fff4c4", "#ffb938", "hearts"], ["💕", "☁️", "✨"], "Home & Lifestyle", 15, 0, 60, 1, "A big, squishy pillow for naps and movie nights.", 4.9, 8, 0),
  P("cards", "BT21 Collectible Cards", 199, "mang", ["#f3e3ff", "#b58cff", "dots"], ["⭐", "✨", "🎀"], "Collectibles", 50, 0, 30, 1, "Shiny collectible cards with all your favourite friends.", 4.8, 6, 0),
];

let db;
try { db = JSON.parse(fs.readFileSync(FILE, "utf8")); } catch {
  db = { products: seed, flash: { endsAt: Date.now() + ((2 * 24 + 15) * 3600 + 43 * 60 + 27) * 1000 }, orders: [], reviews: [], seq: 1000 };
}
const save = () => { fs.mkdirSync("data", { recursive: true }); fs.writeFileSync(FILE, JSON.stringify(db)); };
const clients = new Set();
const emit = (e) => { save(); for (const r of clients) r.write(`data: ${JSON.stringify(e)}\n\n`); };
const live = () => Date.now() < db.flash.endsAt;
const pct = (p) => (live() && p.flash ? p.flashDiscount : p.discount);
const unit = (p) => Math.round(p.price * (1 - pct(p) / 100));
const view = () => ({ now: Date.now(), flash: db.flash, reviews: db.reviews, products: db.products.map((p) => ({ ...p, added: Math.floor((Date.now() - p.createdAt) / DAY) })) });
const send = (res, code, data) => { res.writeHead(code, { "content-type": "application/json" }); res.end(JSON.stringify(data)); };
const body = (req) => new Promise((ok) => { let s = ""; req.on("data", (c) => (s += c)); req.on("end", () => { try { ok(JSON.parse(s || "{}")); } catch { ok({}); } }); });
const num = (v, d = 0) => (Number.isFinite(+v) ? Math.max(0, +v) : d);

let was = live();
setInterval(() => { if (was && !live()) emit({ type: "flash", on: false }); was = live(); }, 1000); // sale ends by itself

http.createServer(async (req, res) => {
  const u = new URL(req.url, "http://x"), path = u.pathname, m = req.method;
  // Online: serve the built website (npm run build -> dist/). Anything that isn't /api is a static file.
  if (!path.startsWith("/api") && fs.existsSync("dist")) {
    const MIME = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp", ".json": "application/json", ".ico": "image/x-icon" };
    let file = nodePath.join("dist", nodePath.normalize(decodeURIComponent(path)).replace(/^(\.\.[\\/])+/, ""));
    if (!file.startsWith("dist") || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = nodePath.join("dist", "index.html");
    res.writeHead(200, { "content-type": MIME[nodePath.extname(file)] || "application/octet-stream" });
    return void fs.createReadStream(file).pipe(res);
  }
  if (path === "/api/events") {
    res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" });
    res.write(": ok\n\n"); clients.add(res); return void req.on("close", () => clients.delete(res));
  }
  if (path === "/api/state") return send(res, 200, view());
  if (path === "/api/orders" && m === "GET") { const ids = (u.searchParams.get("ids") || "").split(","); return send(res, 200, db.orders.filter((o) => ids.includes(o.no))); }
  const b = m === "GET" ? {} : await body(req);

  if (path === "/api/orders" && m === "POST") {
    const c = b.customer || {};
    if (!String(c.name || "").trim() || !String(c.phone || "").trim() || !String(c.address || "").trim()) return send(res, 400, { error: "Please fill in name, phone and address." });
    const lines = [];
    for (const { id, qty } of b.items || []) {
      const p = db.products.find((x) => x.id === id), q = Math.floor(num(qty));
      if (!p || !q) continue;
      if (p.stock < q) return send(res, 409, { error: p.stock ? `Only ${p.stock} ${p.name} left. Please lower the quantity.` : `${p.name} just sold out.` });
      lines.push({ p, q });
    }
    if (!lines.length) return send(res, 400, { error: "Your cart is empty." });
    const promo = String(b.promo || "").toUpperCase(), sub = lines.reduce((s, { p, q }) => s + unit(p) * q, 0);
    const disc = Math.round(sub * (CODES[promo] ?? 0)), ship = b.express ? 199 : sub >= 1000 || promo === "FREESHIP" ? 0 : 99;
    for (const { p, q } of lines) { p.stock -= q; p.sold += q; } // checked and decremented in one step, so two shoppers can't both take the last one
    const o = { no: `TT-${++db.seq}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`, at: Date.now(), status: STEPS[0], customer: c, pay: b.pay, express: !!b.express, gift: !!b.gift, msg: b.msg || "",
      items: lines.map(({ p, q }) => ({ id: p.id, name: p.name, qty: q, price: unit(p) })), sub, disc, ship, total: sub - disc + ship, eta: new Date(Date.now() + (b.express ? 2 : 5) * DAY).toDateString() };
    db.orders.push(o); emit({ type: "order", no: o.no, status: o.status });
    for (const { p } of lines) if (p.stock <= 3) emit({ type: "stock", name: p.name, left: p.stock });
    return send(res, 200, o);
  }
  if (path === "/api/reviews" && m === "POST") {
    const p = db.products.find((x) => x.id === b.productId), stars = Math.round(num(b.stars));
    if (!p || stars < 1 || stars > 5 || !String(b.text || "").trim()) return send(res, 400, { error: "Pick 1-5 stars and write a few words." });
    db.reviews.unshift({ id: Date.now(), productId: p.id, stars, name: String(b.name || "").trim() || "A cutie", text: String(b.text).slice(0, 400), at: Date.now() });
    p.rating = Math.round(((p.rating * p.reviewCount + stars) / (p.reviewCount + 1)) * 10) / 10; p.reviewCount++;
    emit({ type: "review", id: p.id }); return send(res, 200, { ok: true });
  }

  if (path.startsWith("/api/admin")) {
    if (req.headers["x-admin-pin"] !== PIN) return send(res, 401, { error: "Wrong admin PIN." });
    const [, , , kind, id] = path.split("/");
    if (kind === "orders" && m === "GET") return send(res, 200, [...db.orders].reverse());
    if (kind === "orders" && m === "PUT") {
      const o = db.orders.find((x) => x.no === id);
      if (!o || !STEPS.includes(b.status)) return send(res, 400, { error: "Unknown order or status." });
      o.status = b.status; emit({ type: "order", no: o.no, status: o.status }); return send(res, 200, o);
    }
    if (kind === "flash" && m === "POST") {
      const min = num(b.minutes); db.flash.endsAt = Date.now() + min * 60000; was = live();
      emit({ type: "flash", on: min > 0 }); return send(res, 200, db.flash);
    }
    if (kind === "products" && m === "POST") {
      const name = String(b.name || "").trim(); if (!name) return send(res, 400, { error: "Give the product a name." });
      const p = P(name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + Date.now().toString(36), name, num(b.price, 100), b.characterId || "koya", ["#ffe3ef", "#ff8fbf", "hearts"], ["💕", "✨", "🎀"], b.category || "Collectibles", num(b.stock), 0, 0, 0, "A brand-new treasure.", 5, 0, 0);
      p.image = b.image || "/products/default.svg"; db.products.push(p); emit({ type: "product" }); return send(res, 200, p);
    }
    const p = db.products.find((x) => x.id === id);
    if (kind === "products" && p && m === "PUT") {
      for (const k of ["price", "discount", "flashDiscount", "stock"]) if (k in b) p[k] = num(b[k]);
      if ("flash" in b) p.flash = !!b.flash; if (b.name) p.name = String(b.name);
      emit({ type: "product" }); if (p.stock <= 3 && p.stock > 0) emit({ type: "stock", name: p.name, left: p.stock });
      return send(res, 200, p);
    }
    if (kind === "products" && p && m === "DELETE") { db.products = db.products.filter((x) => x !== p); emit({ type: "product" }); return send(res, 200, { ok: true }); }
  }
  send(res, 404, { error: "Not found" });
}).listen(process.env.PORT || 3001, () => console.log("Shop server on port " + (process.env.PORT || 3001)));
