export interface CompressedImageResult {
  dataUrl: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
}

export async function compressImageFile(
  file: File,
  options: { lowBandwidth?: boolean; maxDimension?: number; maxTargetBytes?: number } = {}
): Promise<CompressedImageResult> {
  const {
    lowBandwidth = false,
    maxDimension = lowBandwidth ? 640 : 960,
    maxTargetBytes = lowBandwidth ? 70_000 : 140_000,
  } = options;

  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('Could not decode selected image.'));
      element.src = imageUrl;
    });

    let targetWidth = img.naturalWidth || img.width;
    let targetHeight = img.naturalHeight || img.height;

    if (targetWidth > maxDimension || targetHeight > maxDimension) {
      if (targetWidth >= targetHeight) {
        targetHeight = Math.round((targetHeight / targetWidth) * maxDimension);
        targetWidth = maxDimension;
      } else {
        targetWidth = Math.round((targetWidth / targetHeight) * maxDimension);
        targetHeight = maxDimension;
      }
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas 2D context unavailable.');
    }

    let currentWidth = Math.max(1, targetWidth);
    let currentHeight = Math.max(1, targetHeight);
    let quality = lowBandwidth ? 0.56 : 0.74;
    let bestDataUrl = '';

    for (let attempt = 0; attempt < 5; attempt++) {
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx.clearRect(0, 0, currentWidth, currentHeight);
      ctx.drawImage(img, 0, 0, currentWidth, currentHeight);

      bestDataUrl = canvas.toDataURL('image/webp', quality);
      if (!bestDataUrl.startsWith('data:image/webp')) {
        bestDataUrl = canvas.toDataURL('image/jpeg', quality);
      }

      const estimatedBytes = Math.ceil((bestDataUrl.length * 3) / 4);
      if (estimatedBytes <= maxTargetBytes) {
        return {
          dataUrl: bestDataUrl,
          originalSize: file.size,
          compressedSize: estimatedBytes,
          width: currentWidth,
          height: currentHeight,
        };
      }

      quality = Math.max(0.35, quality - 0.12);
      currentWidth = Math.max(240, Math.round(currentWidth * 0.8));
      currentHeight = Math.max(240, Math.round(currentHeight * 0.8));
    }

    const finalBytes = Math.ceil((bestDataUrl.length * 3) / 4);
    return {
      dataUrl: bestDataUrl,
      originalSize: file.size,
      compressedSize: finalBytes,
      width: currentWidth,
      height: currentHeight,
    };
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}
