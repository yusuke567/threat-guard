import { hash } from 'imghash';
import fs from 'node:fs/promises';

/**
 * Calculate hamming distance between two hex hash strings
 */
function hammingDistance(hash1: string, hash2: string): number {
  let distance = 0;
  const len = Math.min(hash1.length, hash2.length);

  for (let i = 0; i < len; i++) {
    const n1 = parseInt(hash1[i], 16);
    const n2 = parseInt(hash2[i], 16);
    let xor = n1 ^ n2;
    while (xor) {
      distance += xor & 1;
      xor >>= 1;
    }
  }

  return distance;
}

/**
 * Calculate image similarity using perceptual hash (0-1, 1 = identical)
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
  } catch (err: any) {
    console.error(`[ImageSimilarity] File access error:`, err.message);
    throw new Error(`Cannot access image files: ${err.message}`);
  }

  try {
    const [hash1, hash2] = await Promise.all([
      hash(imagePath1, 16),
      hash(imagePath2, 16),
    ]);
    console.log(`[ImageSimilarity] Hashes computed: ${hash1.slice(0, 16)}..., ${hash2.slice(0, 16)}...`);

    const maxBits = Math.min(hash1.length, hash2.length) * 4; // 4 bits per hex char
    const distance = hammingDistance(hash1, hash2);
    const similarity = 1 - distance / maxBits;

    console.log(`[ImageSimilarity] Distance: ${distance}, MaxBits: ${maxBits}, Similarity: ${similarity}`);
    return similarity;
  } catch (err: any) {
    console.error(`[ImageSimilarity] Hash computation error:`, err);
    throw new Error(`Failed to compute image hash: ${err.message}`);
  }
}
