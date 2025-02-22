'use server';

import { createDecipheriv, createHash } from 'crypto';

export async function decryptBet(encryptedData: string): Promise<string> {
  try {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY environment variable is not set');
    }

    // Generate a 32-byte key from the environment variable
    const hash = createHash('sha256');
    hash.update(encryptionKey);
    const key = hash.digest();

    // Split the encrypted data into IV and encrypted bet
    const [ivHex, encryptedBet] = encryptedData.split(':');
    const iv = Buffer.from(ivHex, 'hex');

    // Create decipher
    const decipher = createDecipheriv('aes-256-cbc', key, iv);

    // Decrypt the bet
    let decrypted = decipher.update(encryptedBet, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Error decrypting bet:', error);
    throw new Error('Failed to decrypt bet');
  }
}