export interface StashEnvelope {
  version: 1
  algorithm: 'AES-256-GCM' | 'AES-128-GCM'
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

async function derivePasswordKey(password: string, salt: Uint8Array, iterations: number, keyLength: 128 | 256) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: asBufferSource(salt), iterations, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: keyLength },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptStash(
  payload: unknown,
  password = '',
  algorithm: StashEnvelope['algorithm'] = 'AES-256-GCM',
) {
  const keyLength = algorithm === 'AES-256-GCM' ? 256 : 128
  const contentKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: keyLength }, true, ['encrypt', 'decrypt'])
  const iv = randomBytes(12)
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(iv) },
    contentKey,
    encoder.encode(JSON.stringify(payload)),
  )
  const innerIv = toBase64Url(iv)
  const innerCiphertext = toBase64Url(new Uint8Array(ciphertext))
  const rawKey = await crypto.subtle.exportKey('raw', contentKey)
  const fragmentKey = toBase64Url(new Uint8Array(rawKey))

  if (!password) {
    return {
      envelope: {
        version: 1,
        algorithm,
        iv: innerIv,
        ciphertext: innerCiphertext,
      },
      fragmentKey,
    }
  }

  const salt = randomBytes(16)
  const outerIv = randomBytes(12)
  const passwordKey = await derivePasswordKey(password, salt, PBKDF2_ITERATIONS, keyLength)
  const outerPayload = encoder.encode(JSON.stringify({ iv: innerIv, ciphertext: innerCiphertext }))
  const outerCiphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: asBufferSource(outerIv) },
    passwordKey,
    outerPayload,
  )

  return {
    envelope: {
      version: 1,
      algorithm,
      iv: toBase64Url(outerIv),
      innerIv,
      ciphertext: toBase64Url(new Uint8Array(outerCiphertext)),
      salt: toBase64Url(salt),
      kdf: 'PBKDF2-SHA-256',
      iterations: PBKDF2_ITERATIONS,
    },
    fragmentKey,
  }
}

export async function decryptStash(envelope: StashEnvelope, password = '', fragmentKey = '') {
  if (envelope.version !== 1 || !['AES-256-GCM', 'AES-128-GCM'].includes(envelope.algorithm)) {
    throw new Error('Unsupported stash encryption')
  }

  if (!fragmentKey) throw new Error('The decryption key is missing from the URL')
  const keyLength = envelope.algorithm === 'AES-256-GCM' ? 256 : 128
  const contentKey = await crypto.subtle.importKey('raw', fromBase64Url(fragmentKey), { name: 'AES-GCM', length: keyLength }, false, ['decrypt'])
  let contentIv = envelope.iv
  let contentCiphertext = envelope.ciphertext

  if (envelope.innerIv) {
    if (!password || !envelope.salt || !envelope.iterations) throw new Error('A password is required')
    const passwordKey = await derivePasswordKey(password, fromBase64Url(envelope.salt), envelope.iterations, keyLength)
    const outerPlaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: asBufferSource(fromBase64Url(envelope.iv)) },
      passwordKey,
      fromBase64Url(envelope.ciphertext),
    )
    const innerEnvelope = JSON.parse(decoder.decode(outerPlaintext)) as { iv: string, ciphertext: string }
    contentIv = innerEnvelope.iv
    contentCiphertext = innerEnvelope.ciphertext
  }

  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: asBufferSource(fromBase64Url(contentIv)) },
    contentKey,
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
