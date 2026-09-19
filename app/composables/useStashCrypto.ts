import { xchacha20poly1305 } from '@noble/ciphers/chacha.js'

export type StashAlgorithm = 'AES-256-GCM' | 'AES-128-GCM' | 'XChaCha20-Poly1305'

export interface StashEnvelope {
  version: 1
  algorithm: StashAlgorithm
  iv: string
  ciphertext: string
  innerIv?: string
  salt?: string
  kdf?: 'PBKDF2-SHA-256'
  iterations?: number
}

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const PBKDF2_ITERATIONS = 600_000

function toBase64Url(bytes: Uint8Array) {
  let binary = ''
  for (let index = 0; index < bytes.length; index += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 0x8000))
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

function fromBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
  const binary = atob(padded)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

function randomBytes(length: number) {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

function asBufferSource(bytes: Uint8Array) {
  return bytes.slice().buffer
}

function isXChaCha(algorithm: StashAlgorithm) {
  return algorithm === 'XChaCha20-Poly1305'
}

function keyLengthFor(algorithm: StashAlgorithm) {
  return algorithm === 'AES-128-GCM' ? 16 : 32
}

function nonceLengthFor(algorithm: StashAlgorithm) {
  return isXChaCha(algorithm) ? 24 : 12
}

async function derivePasswordBytes(password: string, salt: Uint8Array, iterations: number, length: number) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations, hash: 'SHA-256' },
    material,
    length * 8,
  )
  return new Uint8Array(bits)
}

async function encryptLayer(algorithm: StashAlgorithm, key: Uint8Array, plaintext: Uint8Array) {
  const iv = randomBytes(nonceLengthFor(algorithm))
  if (isXChaCha(algorithm)) {
    return { iv, ciphertext: xchacha20poly1305(key, iv).encrypt(plaintext) }
  }

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    asBufferSource(key),
    { name: 'AES-GCM', length: key.length * 8 },
    false,
    ['encrypt'],
  )
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    cryptoKey,
    asBufferSource(plaintext),
  )
  return { iv, ciphertext: new Uint8Array(ciphertext) }
}

async function decryptLayer(algorithm: StashAlgorithm, key: Uint8Array, iv: Uint8Array, ciphertext: Uint8Array) {
  if (isXChaCha(algorithm)) return xchacha20poly1305(key, iv).decrypt(ciphertext)

  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    asBufferSource(key),
    { name: 'AES-GCM', length: key.length * 8 },
    false,
    ['decrypt'],
  )
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    cryptoKey,
    asBufferSource(ciphertext),
  )
  return new Uint8Array(plaintext)
}

export async function encryptStash(
  payload: unknown,
  password = '',
  algorithm: StashAlgorithm = 'AES-256-GCM',
) {
  const contentKey = randomBytes(keyLengthFor(algorithm))
  const inner = await encryptLayer(algorithm, contentKey, encoder.encode(JSON.stringify(payload)))
  const innerIv = toBase64Url(inner.iv)
  const innerCiphertext = toBase64Url(inner.ciphertext)
  const fragmentKey = toBase64Url(contentKey)

  if (!password) {
    return {
      envelope: {
        version: 1,
        algorithm,
        iv: innerIv,
        ciphertext: innerCiphertext,
      } satisfies StashEnvelope,
      fragmentKey,
    }
  }

  const salt = randomBytes(16)
  const passwordKey = await derivePasswordBytes(password, salt, PBKDF2_ITERATIONS, keyLengthFor(algorithm))
  const outerPayload = encoder.encode(JSON.stringify({ iv: innerIv, ciphertext: innerCiphertext }))
  const outer = await encryptLayer(algorithm, passwordKey, outerPayload)

  return {
    envelope: {
      version: 1,
      algorithm,
      iv: toBase64Url(outer.iv),
      innerIv,
      ciphertext: toBase64Url(outer.ciphertext),
      salt: toBase64Url(salt),
      kdf: 'PBKDF2-SHA-256',
      iterations: PBKDF2_ITERATIONS,
    } satisfies StashEnvelope,
    fragmentKey,
  }
}

export async function decryptStash(envelope: StashEnvelope, password = '', fragmentKey = '') {
  if (
    envelope.version !== 1 ||
    !['AES-256-GCM', 'AES-128-GCM', 'XChaCha20-Poly1305'].includes(envelope.algorithm)
  ) {
    throw new Error('Unsupported stash encryption')
  }

  if (!fragmentKey) throw new Error('The decryption key is missing from the URL')
  const contentKey = fromBase64Url(fragmentKey)
  let contentIv = envelope.iv
  let contentCiphertext = envelope.ciphertext

  if (envelope.innerIv) {
    if (!password || !envelope.salt || !envelope.iterations) throw new Error('A password is required')
    const passwordKey = await derivePasswordBytes(
      password,
      fromBase64Url(envelope.salt),
      envelope.iterations,
      keyLengthFor(envelope.algorithm),
    )
    const outerPlaintext = await decryptLayer(
      envelope.algorithm,
      passwordKey,
      fromBase64Url(envelope.iv),
      fromBase64Url(envelope.ciphertext),
    )
    const innerEnvelope = JSON.parse(decoder.decode(outerPlaintext)) as { iv: string, ciphertext: string }
    contentIv = innerEnvelope.iv
    contentCiphertext = innerEnvelope.ciphertext
  }

  const plaintext = await decryptLayer(
    envelope.algorithm,
    contentKey,
    fromBase64Url(contentIv),
    fromBase64Url(contentCiphertext),
  )
  return JSON.parse(decoder.decode(plaintext)) as {
    version: 1
    type: 'text' | 'form'
    format?: string
    content?: string
    fields?: Array<{ title: string, value: string, type: 'text' | 'secret' }>
  }
}
