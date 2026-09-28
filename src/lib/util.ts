export const pad = (n: number) => String(n).padStart(2, '0');
export const fmtClock = (ms: number) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
export function fmtDur(ms: number) {
  ms = Math.max(0, ms);
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400);
  const hms = `${pad(Math.floor(s / 3600) % 24)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  return d > 0 ? `${d}d ${hms}` : hms;
}
export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms));

/** Party night + time → absolute ms. Times before noon are the morning after. */
export function computeDeadline(nightDate: string, time: string) {
  const [y, m, d] = nightDate.split('-').map(Number);
  const [hh, mm] = time.split(':').map(Number);
  const dt = new Date(y, m - 1, d, hh, mm, 0, 0);
  if (hh < 12) dt.setDate(dt.getDate() + 1);
  return dt.getTime();
}
export function splitDeadline(ms: number) {
  const d = new Date(ms), night = new Date(ms);
  if (d.getHours() < 12) night.setDate(night.getDate() - 1);
  return { nightDate: `${night.getFullYear()}-${pad(night.getMonth() + 1)}-${pad(night.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

/** Compress a photo client-side to a JPEG (~40–150 KB); selfies are centre-cropped square. */
export async function compressImage(file: Blob, max = 480, quality = 0.72, square = true): Promise<Blob> {
  const bmp = await createImageBitmap(file).catch(async () => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    await img.decode();
    return img as unknown as ImageBitmap;
  });
  const w = (bmp as any).width, h = (bmp as any).height;
  const c = document.createElement('canvas');
  if (square) {
    const side = Math.min(w, h);                     // centre-crop to a square
    c.width = c.height = Math.min(max, side);
    c.getContext('2d')!.drawImage(bmp as any, (w - side) / 2, (h - side) / 2, side, side, 0, 0, c.width, c.height);
  } else {
    const k = Math.min(1, max / Math.max(w, h));
    c.width = Math.round(w * k); c.height = Math.round(h * k);
    c.getContext('2d')!.drawImage(bmp as any, 0, 0, c.width, c.height);
  }
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('Could not process photo'))), 'image/jpeg', quality));
}

export const initials = (name: string) => name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
