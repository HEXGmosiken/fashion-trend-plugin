/**
 * 形状词云：把词排进一个轮廓里。
 *
 * 做法：把轮廓栅格化成 3px 网格，再从中心向外逐格找空位放词，放得下就占位。
 * 全程在构建时算好，输出绝对定位的 span，静态 HTML 也能显示。
 */

export type MaskName = "heart" | "dress" | "circle";

export interface CloudWord {
  t: string;
  n: number;
}
export interface PlacedWord {
  t: string;
  x: number;
  y: number;
  size: number;
  weight: number;
}
export interface CloudLayout {
  width: number;
  height: number;
  words: PlacedWord[];
}

type Pt = [number, number];

const CELL = 3;

function heartPoints(steps = 200): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    pts.push([x, -y]);
  }
  return pts;
}

/** A 字裙：肩、腰、裙摆 */
const DRESS: Pt[] = [
  [0.50, 0.02],
  [0.61, 0.06],
  [0.67, 0.22],
  [0.62, 0.40],
  [0.88, 0.97],
  [0.50, 1.00],
  [0.12, 0.97],
  [0.38, 0.40],
  [0.33, 0.22],
  [0.39, 0.06],
];

function normalize(pts: Pt[], w: number, h: number, pad: number): Pt[] {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const s = Math.min((w - pad * 2) / (maxX - minX || 1), (h - pad * 2) / (maxY - minY || 1));
  const ox = (w - (maxX - minX) * s) / 2;
  const oy = (h - (maxY - minY) * s) / 2;
  return pts.map(([x, y]) => [ox + (x - minX) * s, oy + (y - minY) * s] as Pt);
}

function polygonFor(mask: MaskName, w: number, h: number): Pt[] {
  const pad = Math.min(w, h) * 0.04;
  if (mask === "heart") return normalize(heartPoints(), w, h, pad);
  if (mask === "dress") return normalize(DRESS, w, h, pad);
  const pts: Pt[] = [];
  const r = Math.min(w, h) / 2 - pad;
  for (let i = 0; i < 160; i++) {
    const a = (i / 160) * Math.PI * 2;
    pts.push([w / 2 + r * Math.cos(a), h / 2 + r * Math.sin(a)]);
  }
  return pts;
}

function inside(poly: Pt[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]!;
    const [xj, yj] = poly[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-9) + xi) hit = !hit;
  }
  return hit;
}

function textWidth(text: string, size: number): number {
  let units = 0;
  for (const ch of text) units += /[\u3000-\u9fff\uff00-\uffef]/.test(ch) ? 1 : 0.55;
  return units * size * 1.12;
}

export function layoutCloud(
  words: CloudWord[],
  opts: { width: number; height: number; mask?: MaskName; maxWords?: number },
): CloudLayout {
  const { width, height } = opts;
  const mask = opts.mask ?? "heart";
  const poly = polygonFor(mask, width, height);

  const cols = Math.floor(width / CELL);
  const rows = Math.floor(height / CELL);
  const free = new Uint8Array(cols * rows);
  const cx0 = width / 2, cy0 = height / 2;

  // 候选点按到中心的距离排序，先填中间
  const candidates: { c: number; r: number; d: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (!inside(poly, (c + 0.5) * CELL, (r + 0.5) * CELL)) continue;
      free[r * cols + c] = 1;
      const dx = (c + 0.5) * CELL - cx0;
      const dy = ((r + 0.5) * CELL - cy0) * 1.15;
      candidates.push({ c, r, d: dx * dx + dy * dy });
    }
  }
  candidates.sort((a, b) => a.d - b.d);

  const list = [...words].sort((a, b) => b.n - a.n).slice(0, opts.maxWords ?? 40);
  const maxN = Math.max(1, ...list.map((w) => w.n));
  const placed: PlacedWord[] = [];

  for (const w of list) {
    const ratio = Math.sqrt(w.n / maxN);
    let size = 8 + Math.round(26 * ratio);
    let ok = false;

    for (let shrink = 0; shrink < 4 && !ok; shrink++, size = Math.round(size * 0.84)) {
      const cw = Math.ceil(textWidth(w.t, size) / CELL);
      const ch = Math.ceil((size * 1.15) / CELL);
      const halfW = Math.floor(cw / 2);
      const halfH = Math.floor(ch / 2);

      for (const cand of candidates) {
        let fits = true;
        for (let dr = -halfH; dr <= halfH && fits; dr++) {
          const rr = cand.r + dr;
          if (rr < 0 || rr >= rows) { fits = false; break; }
          for (let dc = -halfW; dc <= halfW; dc++) {
            const cc = cand.c + dc;
            if (cc < 0 || cc >= cols || !free[rr * cols + cc]) { fits = false; break; }
          }
        }
        if (!fits) continue;

        for (let dr = -halfH; dr <= halfH; dr++) {
          for (let dc = -halfW; dc <= halfW; dc++) {
            free[(cand.r + dr) * cols + (cand.c + dc)] = 0;
          }
        }
        placed.push({
          t: w.t,
          x: Number(((cand.c + 0.5) * CELL).toFixed(1)),
          y: Number(((cand.r + 0.5) * CELL).toFixed(1)),
          size,
          weight: Math.round(300 + 400 * ratio),
        });
        ok = true;
        break;
      }
    }
  }

  return { width, height, words: placed };
}
