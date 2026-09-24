export interface ProcessedImage {
  dataUrl: string;
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
}

/**
 * Loads an image file, normalizes it to clean PNG (or JPEG if already JPEG),
 * and computes proportional width and height constrained to maxWidth x maxHeight.
 */
export async function processImageFile(
  file: File,
  maxWidth: number = 240,
  maxHeight: number = 240
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const src = reader.result as string;
      processImageDataUrl(src, maxWidth, maxHeight).then(resolve).catch(reject);
    };
    reader.readAsDataURL(file);
  });
}

/**
 * Normalizes an image data URL and computes proportional placement dimensions.
 */
export async function processImageDataUrl(
  dataUrl: string,
  maxWidth: number = 240,
  maxHeight: number = 240
): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof Image === 'undefined') {
      return resolve({
        dataUrl,
        width: 150,
        height: 100,
        naturalWidth: 150,
        naturalHeight: 100
      });
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => reject(new Error('Failed to decode image data'));
    img.onload = () => {
      const nw = img.naturalWidth || 150;
      const nh = img.naturalHeight || 100;

      // Scale proportionally to fit within maxWidth x maxHeight
      const scale = Math.min(maxWidth / nw, maxHeight / nh, 1.0);
      const targetW = Math.max(30, Math.round(nw * scale));
      const targetH = Math.max(20, Math.round(nh * scale));

      // Draw onto canvas to convert any format (SVG, WebP, GIF, BMP) to a clean PNG
      const canvas = document.createElement('canvas');
      canvas.width = nw;
      canvas.height = nh;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        return resolve({
          dataUrl,
          width: targetW,
          height: targetH,
          naturalWidth: nw,
          naturalHeight: nh
        });
      }

      ctx.drawImage(img, 0, 0);

      // If already a clean JPEG, preserve jpeg, otherwise standard PNG for 100% PDF compatibility
      let outUrl = dataUrl;
      try {
        if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) {
          outUrl = canvas.toDataURL('image/jpeg', 0.92);
        } else {
          outUrl = canvas.toDataURL('image/png');
        }
      } catch {
        outUrl = dataUrl;
      }

      resolve({
        dataUrl: outUrl,
        width: targetW,
        height: targetH,
        naturalWidth: nw,
        naturalHeight: nh
      });
    };
    img.src = dataUrl;
  });
}
