import { randomBytes } from 'node:crypto'
import { createStash, purgeExpiredStashes } from '../utils/stash-db'

const MAX_ENVELOPE_SIZE = 8 * 1024 * 1024

function createId() {
  return randomBytes(16).toString('base64url')
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{
    envelope?: unknown
    expiresAt?: unknown
    burnAfterReading?: unknown
  }>(event)

  const candidate = body?.envelope
  const envelopeValue = candidate && typeof candidate === 'object'
    ? candidate as Record<string, unknown>
    : undefined
  const validAlgorithm = ['AES-256-GCM', 'AES-128-GCM', 'XChaCha20-Poly1305'].includes(String(envelopeValue?.algorithm))

  if (
    !envelopeValue ||
    envelopeValue.version !== 1 ||
    !validAlgorithm ||
    typeof envelopeValue.iv !== 'string' ||
    typeof envelopeValue.ciphertext !== 'string' ||
    typeof body?.expiresAt !== 'number' && body?.expiresAt !== null ||
    typeof body?.burnAfterReading !== 'boolean'
  ) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid encrypted stash payload' })
  }

  const envelope = JSON.stringify(envelopeValue)
  if (envelope.length > MAX_ENVELOPE_SIZE) {
    throw createError({ statusCode: 413, statusMessage: 'Stash is too large' })
  }

  if (body.expiresAt !== null && (!Number.isSafeInteger(body.expiresAt) || body.expiresAt <= Date.now())) {
    throw createError({ statusCode: 400, statusMessage: 'Expiration must be in the future' })
  }

  purgeExpiredStashes()
  const id = createId()
  createStash({
    id,
    envelope,
    expires_at: body.expiresAt as number | null,
    burn_after_reading: body.burnAfterReading ? 1 : 0,
  })

  setResponseStatus(event, 201)
  return { id }
})
