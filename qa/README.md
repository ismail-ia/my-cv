# QA suite

Asserts the brand guidelines against the built page —
not just that it renders, but that it still obeys its own rules.

```bash
cd next && npm run dev &   # Start the Next.js app on port 3000
cd ../qa && npm install && npx playwright install chromium
BASE_URL=http://localhost:xxx/ npm run qa
```

Exits non-zero on any failure. Screenshots land in `qa/shots/`.

Covers: console/network errors · webfonts actually loading (no silent fallback) ·
the video's `multiply` blend and playback · one `<h1>` carrying the positioning line ·
heading order · mono/tabular numerals · **avatar never inside `.on-dark`** ·
**no white label on an orange fill** · banned vocabulary · skip link and focus rings ·
axe WCAG 2.1 AA · chat semantics, grounded numbers and the email fallback ·
sticky nav opacity · 320px · 200% zoom · 44px touch targets · reduced motion.
