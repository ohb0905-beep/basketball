// 앱 아이콘(PWA) 생성 스크립트: node scripts/make-app-icons.js <출력폴더>
// 결과물: public/icons/*.png, app/apple-icon.png(=apple-touch-icon.png), app/icon.png(=favicon-48.png)
const { chromium } = require('playwright');
const fs = require('fs');
// 원본 디자인: 어두운 배경 + 주황 농구공 + 아래 MVP 리본
function svg({ size, ballScale, withText, rounded }) {
  const s = 512;
  const r = 150 * ballScale;
  const cx = 256, cy = withText ? 226 : 256;
  const seam = Math.max(10, 13 * ballScale);
  const text = withText ? `
    <rect x="${256 - 118 * ballScale}" y="${cy + r - 30 * ballScale}" width="${236 * ballScale}" height="${84 * ballScale}" rx="${22 * ballScale}" fill="#ffffff"/>
    <text x="256" y="${cy + r + 34 * ballScale}" text-anchor="middle" font-family="Arial Black, Arial, Helvetica, sans-serif" font-weight="900" font-size="${70 * ballScale}" letter-spacing="${2 * ballScale}" fill="#17171c">MVP</text>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${s} ${s}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#2a2a33"/><stop offset="1" stop-color="#101013"/></radialGradient>
    <radialGradient id="ball" cx="38%" cy="32%" r="75%"><stop offset="0" stop-color="#ff8a4c"/><stop offset="0.55" stop-color="#f05a1f"/><stop offset="1" stop-color="#c2410c"/></radialGradient>
    <clipPath id="clip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
  </defs>
  <rect width="${s}" height="${s}" rx="${rounded ? 112 : 0}" fill="url(#bg)"/>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#ball)"/>
  <g clip-path="url(#clip)" fill="none" stroke="#17171c" stroke-width="${seam}" stroke-linecap="round">
    <line x1="${cx}" y1="${cy - r}" x2="${cx}" y2="${cy + r}"/>
    <line x1="${cx - r}" y1="${cy}" x2="${cx + r}" y2="${cy}"/>
    <path d="M ${cx - r * 0.62} ${cy - r * 0.95} Q ${cx - r * 0.12} ${cy} ${cx - r * 0.62} ${cy + r * 0.95}"/>
    <path d="M ${cx + r * 0.62} ${cy - r * 0.95} Q ${cx + r * 0.12} ${cy} ${cx + r * 0.62} ${cy + r * 0.95}"/>
  </g>
  <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#17171c" stroke-width="${seam * 0.6}"/>
  ${text}
</svg>`;
}
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch();
  const p = await b.newPage();
  const jobs = [
    ['icon-192.png', 192, { ballScale: 1.15, withText: true }],
    ['icon-512.png', 512, { ballScale: 1.15, withText: true }],
    ['icon-maskable-512.png', 512, { ballScale: 0.92, withText: true }],
    ['apple-touch-icon.png', 180, { ballScale: 1.15, withText: true }],
    ['favicon-48.png', 48, { ballScale: 1.55, withText: false }],
  ];
  for (const [name, size, opt] of jobs) {
    const markup = svg({ size, ...opt });
    if (name === 'icon-512.png') fs.writeFileSync(out + '/icon.svg', svg({ size: 512, ballScale: 1.55, withText: false, rounded: true }));
    await p.setViewportSize({ width: size, height: size });
    await p.setContent(`<html><body style="margin:0">${markup}</body></html>`);
    await p.locator('svg').screenshot({ path: `${out}/${name}`, omitBackground: true });
  }
  await b.close();
})();
