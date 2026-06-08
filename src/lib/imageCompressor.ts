/**
 * Reusable utility to compress images on the client side using a canvas.
 * This ensures they fit perfectly within Firestore's 1MB document limit.
 */
export function compressImage(
  fileOrBase64: File | string,
  maxWidth = 1000,
  maxHeight = 1000,
  quality = 0.7
): Promise<string> {
  return new Promise((resolve, reject) => {
    let src: string;
    if (typeof fileOrBase64 === 'string') {
      src = fileOrBase64;
    } else {
      src = URL.createObjectURL(fileOrBase64);
    }

    const img = new Image();
    // Only set crossOrigin if it is a remote HTTP/HTTPS URL. Setting it for blob or data URLs can cause errors.
    if (typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))) {
      img.crossOrigin = "anonymous";
    }

    img.onload = () => {
      // Calculate new dimensions keeping aspect ratio
      let width = img.width;
      let height = img.height;

      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        if (typeof fileOrBase64 !== 'string') URL.revokeObjectURL(src);
        reject(new Error('Could not get canvas context'));
        return;
      }

      ctx.drawImage(img, 0, 0, width, height);

      // Export as jpeg with high compression to minimize size
      let currentQuality = quality;
      let currentWidth = width;
      let currentHeight = height;
      let dataUrl = canvas.toDataURL('image/jpeg', currentQuality);
      
      // Recursive adjustment if the text/base64 length exceeds 800,000 characters
      let attempts = 0;
      while (dataUrl.length > 800000 && attempts < 4) {
        attempts++;
        currentQuality = Math.max(0.1, currentQuality - 0.15);
        currentWidth = Math.round(currentWidth * 0.75);
        currentHeight = Math.round(currentHeight * 0.75);

        const newCanvas = document.createElement('canvas');
        newCanvas.width = currentWidth;
        newCanvas.height = currentHeight;
        const newCtx = newCanvas.getContext('2d');
        if (newCtx) {
          newCtx.drawImage(img, 0, 0, currentWidth, currentHeight);
          dataUrl = newCanvas.toDataURL('image/jpeg', currentQuality);
        }
      }
      
      if (typeof fileOrBase64 !== 'string') URL.revokeObjectURL(src);
      resolve(dataUrl);
    };

    img.onerror = (err) => {
      if (typeof fileOrBase64 !== 'string') URL.revokeObjectURL(src);
      reject(err);
    };

    img.src = src;
  });
}
