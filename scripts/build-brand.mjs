// Genera los SVG de marca con el texto convertido a trazos (no dependen de fuentes).
// Uso: node scripts/build-brand.mjs
// Provisional hasta tener el logo final en vector.
import opentype from "opentype.js";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";

const FONT_DIR = "node_modules/@fontsource/jost/files";
const light = opentype.parse(readFileSync(`${FONT_DIR}/jost-latin-300-normal.woff`).buffer);
const regular = opentype.parse(readFileSync(`${FONT_DIR}/jost-latin-400-normal.woff`).buffer);

const INK = "#023636";
const GOLD = "#AF804C";
const CREAM = "#F6EEE3";


/** Serializa un glifo desplazado (evita un bug de opentype con coordenadas no enteras). */
function glyphD(g, x, y, size) {
  const f = (n) => Number.isFinite(n) ? +n.toFixed(2) : 0;
  return g.getPath(0, 0, size).commands.map((c) => {
    switch (c.type) {
      case "M": case "L": return `${c.type}${f(c.x + x)} ${f(c.y + y)}`;
      case "Q": return `Q${f(c.x1 + x)} ${f(c.y1 + y)} ${f(c.x + x)} ${f(c.y + y)}`;
      case "C": return `C${f(c.x1 + x)} ${f(c.y1 + y)} ${f(c.x2 + x)} ${f(c.y2 + y)} ${f(c.x + x)} ${f(c.y + y)}`;
      default: return "Z";
    }
  }).join("");
}

/** Texto con tracking, devuelve { d, width } */
function textPath(font, text, size, tracking = 0, x = 0, y = 0) {
  let cursor = x;
  const parts = [];
  for (const ch of text) {
    const g = font.charToGlyph(ch);
    parts.push(glyphD(g, cursor, y, size));
    cursor += (g.advanceWidth / font.unitsPerEm) * size + tracking * size;
  }
  return { d: parts.join(""), width: cursor - x - tracking * size };
}

/** Texto sobre un arco (para el sello) */
function arcText(font, text, size, tracking, cx, cy, r, centerAngleDeg, outside = true) {
  const widths = [...text].map((ch) => (font.charToGlyph(ch).advanceWidth / font.unitsPerEm) * size + tracking * size);
  const total = widths.reduce((a, b) => a + b, 0) - tracking * size;
  const totalAngle = total / r; // rad
  let angle = (centerAngleDeg * Math.PI) / 180 + (outside ? -totalAngle / 2 : totalAngle / 2);
  const out = [];
  [...text].forEach((ch, i) => {
    const w = widths[i] - (i === text.length - 1 ? tracking * size : 0);
    const mid = angle + (outside ? w / 2 / r : -w / 2 / r);
    const px = cx + r * Math.sin(mid);
    const py = cy - r * Math.cos(mid);
    const rot = outside ? (mid * 180) / Math.PI : (mid * 180) / Math.PI + 180;
    const g = font.charToGlyph(ch);
    const gw = (g.advanceWidth / font.unitsPerEm) * size;
    // glifo centrado horizontalmente en el punto; base sobre el arco (fuera) o bajo él (dentro)
    const baseY = outside ? 0 : size * 0.7;
    const d = glyphD(g, 0, baseY, size);
    out.push(`<path transform="translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${rot.toFixed(2)}) translate(${(-gw / 2).toFixed(2)} 0)" d="${d}"/>`);
    angle += outside ? widths[i] / r : -widths[i] / r;
  });
  return out.join("");
}

// Isotipo: gota/montaña con dos cortes de ola y un sol dorado. Caja 100x100.
const ISO = `
  <path fill="${INK}" d="M50 20 C68 40 82 54 82 70 A32 30 0 0 1 18 70 C18 54 32 40 50 20 Z"/>
  <path fill="none" stroke="${CREAM}" stroke-width="5" stroke-linecap="round" d="M22 63 C38 53 58 71 79 59"/>
  <path fill="none" stroke="${CREAM}" stroke-width="5" stroke-linecap="round" d="M21 77 C38 67 60 85 81 73"/>
  <circle cx="50" cy="9" r="6" fill="${GOLD}"/>`;

mkdirSync("public/brand", { recursive: true });

// --- Wordmark -------------------------------------------------------
{
  const big = 100;
  const main = textPath(light, "DEALTURA", big, 0.02, 0, big * 0.72);
  const smallSize = 26;
  const sub = textPath(regular, "COFFEE", smallSize, 0.55);
  const subX = (main.width - sub.width) / 2;
  const subPath = textPath(regular, "COFFEE", smallSize, 0.55, subX, big * 0.72 + 50);
  const W = Math.ceil(main.width) + 2;
  const H = Math.ceil(big * 0.72 + 56);
  const svg = (fill) =>
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Dealtura Coffee"><g fill="${fill}"><path d="${main.d}"/><path d="${subPath.d}"/></g></svg>\n`;
  writeFileSync("public/brand/wordmark.svg", svg(INK));
  writeFileSync("public/brand/wordmark-cream.svg", svg(CREAM));
}

// --- Emblema (sello) ------------------------------------------------
{
  const S = 400, c = S / 2;
  const top = arcText(light, "DEALTURA", 40, 0.32, c, c, 150, 0, true);
  const bottom = arcText(regular, "COFFEE", 26, 0.6, c, c, 150, 180, false);
  const side = (txt, x) => textPath(regular, txt, 15, 0.3, x, c + 6).d;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${S} ${S}" role="img" aria-label="Dealtura Coffee">
  <circle cx="${c}" cy="${c}" r="${c - 6}" fill="none" stroke="${GOLD}" stroke-width="3"/>
  <g fill="${INK}">${top}${bottom}</g>
  <g fill="${GOLD}"><path d="${side("EST.", 66)}"/><path d="${side("2026", 296)}"/></g>
  <g transform="translate(${c - 78} ${c - 80}) scale(1.56)">${ISO}</g>
</svg>\n`;
  writeFileSync("public/brand/emblem.svg", svg);
  // Variante para fondos oscuros: tinta crema, cortes de ola en verde bosque.
  const dark = svg
    .replaceAll(`stroke="${CREAM}"`, "stroke=\"__WAVE__\"")
    .replaceAll(INK, CREAM)
    .replaceAll("__WAVE__", INK);
  writeFileSync("public/brand/emblem-cream.svg", dark);
}

// --- Isotipo solo (favicon / app icon) --------------------------------
{
  writeFileSync(
    "public/brand/isotype.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${ISO}</svg>\n`,
  );
  writeFileSync(
    "src/app/icon.svg",
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="${CREAM}"/><g transform="translate(8 6) scale(.84)">${ISO}</g></svg>\n`,
  );
}

console.log("Brand SVGs written.");
