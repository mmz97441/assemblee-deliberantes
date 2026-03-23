import crypto from 'crypto'

// AES-256-GCM encryption utilities for secret ballot voting.
// The session key is generated per vote, stored encrypted in DB,
// and destroyed after vote closure.

const IV_LENGTH = 12  // 96 bits for GCM
// Auth tag length: 16 bytes (128 bits) — GCM default, not configurable via Node API

/**
 * Generate a random 32-byte AES-256 key for a vote session.
 */
export function generateVoteSessionKey(): Buffer {
  return crypto.randomBytes(32)
}

/**
 * Encrypt the session key with the master key (from env VOTE_ENCRYPTION_KEY).
 * Returns base64-encoded string: iv:ciphertext:authTag
 */
export function encryptSessionKey(sessionKey: Buffer, masterKeyHex: string): string {
  const masterKey = Buffer.from(masterKeyHex, 'hex')
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv)
  const encrypted = Buffer.concat([cipher.update(sessionKey), cipher.final()])
  const tag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${encrypted.toString('base64')}:${tag.toString('base64')}`
}

/**
 * Decrypt the session key from the stored blob.
 */
export function decryptSessionKey(encryptedBlob: string, masterKeyHex: string): Buffer {
  const masterKey = Buffer.from(masterKeyHex, 'hex')
  const [ivB64, cipherB64, tagB64] = encryptedBlob.split(':')
  const iv = Buffer.from(ivB64, 'base64')
  const encrypted = Buffer.from(cipherB64, 'base64')
  const tag = Buffer.from(tagB64, 'base64')
  const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()])
}

/**
 * Encrypt a vote choice (POUR/CONTRE/ABSTENTION) with the session key.
 */
export function encryptChoice(choice: string, sessionKey: Buffer): { ciphertext: string; iv: string; tag: string } {
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv('aes-256-gcm', sessionKey, iv)
  const encrypted = Buffer.concat([cipher.update(choice, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString('hex'),
    iv: iv.toString('hex'),
    tag: tag.toString('hex'),
  }
}

/**
 * Decrypt a vote choice from the stored encrypted data.
 */
export function decryptChoice(ciphertext: string, iv: string, tag: string, sessionKey: Buffer): string {
  const decipher = crypto.createDecipheriv('aes-256-gcm', sessionKey, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(tag, 'hex'))
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString('utf8')
}

/**
 * Generate a random 32-byte bulletin token (anonymous identifier).
 */
export function generateBulletinToken(): string {
  return crypto.randomBytes(32).toString('hex')
}

/**
 * Compute HMAC-SHA256 integrity hash for a secret bulletin.
 */
export function computeBulletinHash(
  voteId: string,
  token: string,
  choixChiffre: string,
  nonce: string,
  hmacSecret: string
): string {
  return crypto.createHmac('sha256', hmacSecret)
    .update(`${voteId}|${token}|${choixChiffre}|${nonce}`)
    .digest('hex')
}

/**
 * Overwrite a key buffer with zeros (best-effort memory cleanup).
 */
export function destroyKey(buffer: Buffer): void {
  buffer.fill(0)
}
