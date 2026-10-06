# Tiny Treasures

Vite + React front end and a small Node backend (`server.mjs`) that keeps products, stock, the flash sale, orders and reviews in `data/db.json` and pushes changes to every open browser (Server-Sent Events).

```
npm install
npm run dev      # starts the shop server (port 3001) and the site (Vite)
```

- Shop: `/`  ·  My orders / tracking: `/#/track`  ·  Admin: `/#/admin` (PIN `admin123`, change with `ADMIN_PIN`)
- Product pictures are illustrated SVGs in `public/products/` - replace them with real photos (same file names).
- Not included yet: customer accounts/login, payment processing (the payment choice is only saved on the order), email/SMS.
