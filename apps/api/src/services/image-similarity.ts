import { hash } from 'imghash';

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
  const [hash1, hash2] = await Promise.all([
    hash(imagePath1, 16),
    hash(imagePath2, 16),
  ]);

  const maxBits = Math.min(hash1.length, hash2.length) * 4; // 4 bits per hex char
  const distance = hammingDistance(hash1, hash2);

  return 1 - distance / maxBits;
}
