import JSZip from 'jszip';
import { uid } from './utils';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024; // 2 MB after compression target
export const MAX_IMAGE_EDGE = 1280;

export interface CompressedImage {
  dataUrl: string;
  bytes: number;
  width: number;
  height: number;
  name: string;
}

const readFileAsDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(new Error('Could not read file'));
    fr.readAsDataURL(file);
  });

export const loadImageElement = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image'));
    img.src = src;
  });

/**
 * Compress any raster image to WebP, capped at 1280px on the longest edge.
 * Falls back to JPEG when the browser cannot encode WebP (older Safari).
 */
export const compressImage = async (file: Blob, name = 'image'): Promise<CompressedImage> => {
  if (file.size > 20 * 1024 * 1024) throw new Error('Image is larger than 20 MB');
  const dataUrl = await readFileAsDataUrl(file);
  const img = await loadImageElement(dataUrl);
  const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;
  const scale = Math.min(1, MAX_IMAGE_EDGE / longest);
  const width = Math.max(1, Math.round((img.naturalWidth || 1) * scale));
  const height = Math.max(1, Math.round((img.naturalHeight || 1) * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return { dataUrl, bytes: file.size, width, height, name };
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);

  let out = canvas.toDataURL('image/webp', 0.82);
  if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.85);
  // Progressive quality reduction to land under 2 MB
  let quality = 0.82;
  while (dataUrlBytes(out) > MAX_IMAGE_BYTES && quality > 0.4) {
    quality -= 0.12;
    out = canvas.toDataURL('image/webp', quality);
  }
  return { dataUrl: out, bytes: dataUrlBytes(out), width, height, name };
};

export const dataUrlBytes = (dataUrl: string): number => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) return 0;
  const b64 = dataUrl.slice(comma + 1);
  return Math.floor((b64.length * 3) / 4);
};

/** Read every image out of a ZIP bundle; returns a filename → blob map. */
export const extractImageZip = async (zipFile: File): Promise<Map<string, Blob>> => {
  const zip = await JSZip.loadAsync(zipFile);
  const out = new Map<string, Blob>();
  const entries = Object.values(zip.files).filter(
    (f) => !f.dir && /\.(png|jpe?g|webp|gif|svg|bmp)$/i.test(f.name) && !f.name.startsWith('__MACOSX'),
  );
  for (const entry of entries) {
    const blob = await entry.async('blob');
    const base = entry.name.split('/').pop() ?? entry.name;
    out.set(base.toLowerCase(), blob);
    out.set(entry.name.toLowerCase(), blob);
  }
  return out;
};

export const imageFilesToMap = (files: File[]): Map<string, Blob> => {
  const map = new Map<string, Blob>();
  for (const f of files) {
    map.set(f.name.toLowerCase(), f);
  }
  return map;
};

/** Async-worker image compression for batches, keeping the UI responsive. */
export const compressBatch = async (
  items: Array<{ name: string; blob: Blob }>,
  onProgress?: (done: number, total: number) => void,
): Promise<Map<string, CompressedImage>> => {
  const out = new Map<string, CompressedImage>();
  let done = 0;
  for (const item of items) {
    try {
      const c = await compressImage(item.blob, item.name);
      out.set(item.name.toLowerCase(), c);
    } catch (e) {
      console.warn('image failed', item.name, e);
    }
    done++;
    onProgress?.(done, items.length);
    await new Promise((r) => setTimeout(r, 0));
  }
  return out;
};

/** Upload helper: local backend stores data URLs; Supabase stores in Storage. */
export const fileToDataUrl = readFileAsDataUrl;

export const makeImagePlaceholder = (label: string, color = '#1B3A6B'): string => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><rect width="640" height="400" fill="${color}"/><text x="320" y="210" font-family="Fredoka, Verdana, sans-serif" font-size="34" fill="#C8973A" text-anchor="middle">${label.replace(/[<>&]/g, '')}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const newImageName = (ext = 'webp') => `${uid('img')}.${ext}`;
