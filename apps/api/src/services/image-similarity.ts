import sharp from 'sharp';
import fs from 'node:fs/promises';

/**
 * Calculate image similarity using sharp-based perceptual comparison (0-1, 1 = identical)
 * Uses grayscale histogram comparison which is fast and reliable in Docker environments
 */
export async function calculateSimilarity(
  imagePath1: string,
  imagePath2: string
): Promise<number> {
  console.log(`[ImageSimilarity] Calculating similarity between:`);
  console.log(`  - Image 1: ${imagePath1}`);
  console.log(`  - Image 2: ${imagePath2}`);

  // Verify both files exist
  try {
    const [stat1, stat2] = await Promise.all([
      fs.stat(imagePath1),
      fs.stat(imagePath2),
    ]);
    console.log(`[ImageSimilarity] File sizes: ${stat1.size} bytes, ${stat2.size} bytes`);

    if (stat1.size === 0 || stat2.size === 0) {
      throw new Error('One or both image files are empty');
    }
  } catch (err: any) {
    console.error(`[ImageSimilarity] File access error:`, err.message);
    throw new Error(`Cannot access image files: ${err.message}`);
  }

  try {
    // Resize both images to same small size for comparison (8x8 grayscale = 64 values)
    const size = 16;
    const [pixels1, pixels2] = await Promise.all([
      sharp(imagePath1)
        .resize(size, size, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer(),
      sharp(imagePath2)
        .resize(size, size, { fit: 'fill' })
        .grayscale()
        .raw()
        .toBuffer(),
    ]);

    console.log(`[ImageSimilarity] Pixel buffers: ${pixels1.length} bytes, ${pixels2.length} bytes`);

    // Calculate Mean Absolute Error (MAE) between pixel values
    let totalDiff = 0;
    const pixelCount = Math.min(pixels1.length, pixels2.length);

    for (let i = 0; i < pixelCount; i++) {
      totalDiff += Math.abs(pixels1[i] - pixels2[i]);
    }

    // MAE normalized to 0-1, then inverted (1 = identical)
    const mae = totalDiff / (pixelCount * 255);
    const similarity = 1 - mae;

    console.log(`[ImageSimilarity] MAE: ${mae.toFixed(4)}, Similarity: ${similarity.toFixed(4)}`);
    return similarity;
  } catch (err: any) {
    console.error(`[ImageSimilarity] Image processing error:`, err);
    throw new Error(`Failed to process images: ${err.message}`);
  }
}
