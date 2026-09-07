// 아이콘 PNG(512×512 — 맥 dmg가 512 이상을 요구한다) 생성 — 바깥 의존 없이 zlib로 직접 싼다. 임자색 원 위에 위로 향한
// 화살표(올린다는 뜻)와 아래 받침(리플레이 파일). 필요하면 나중에 진짜 그림으로 바꾼다.
import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

const N = 512;
const px = new Uint8Array(N * N * 4);
const put = (x, y, r, g, b, a = 255) => { const i = (y * N + x) * 4; px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a; };
for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
  const dx = x - 256, dy = y - 256, d = Math.hypot(dx, dy);
  if (d <= 248) {
    const edge = Math.min(1, 248 - d);
    put(x, y, 43, 98, 232, Math.round(255 * edge));
  }
  // 화살표: 머리(삼각형) + 몸통
  const inHead = y >= 124 && y <= 252 && Math.abs(dx) <= (y - 124) * 0.95;
  const inShaft = y > 252 && y <= 352 && Math.abs(dx) <= 44;
  const inBase = y >= 376 && y <= 408 && Math.abs(dx) <= 124;
  if (inHead || inShaft || inBase) put(x, y, 255, 255, 255);
}
const crc = (buf) => { let c, t = new Int32Array(256); for (let n = 0; n < 256; n++) { c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } let v = -1; for (const b of buf) v = t[(v ^ b) & 255] ^ (v >>> 8); return (v ^ -1) >>> 0; };
const chunk = (type, data) => { const len = Buffer.alloc(4); len.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([len, td, c]); };
const raw = Buffer.alloc((N * 4 + 1) * N);
for (let y = 0; y < N; y++) { raw[y * (N * 4 + 1)] = 0; Buffer.from(px.buffer, y * N * 4, N * 4).copy(raw, y * (N * 4 + 1) + 1); }
const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(N, 0); ihdr.writeUInt32BE(N, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
writeFileSync(new URL("../assets/icon.png", import.meta.url), png);
console.log("assets/icon.png", png.length, "bytes");
