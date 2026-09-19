import { consumeStash, getStash, purgeExpiredStashes } from '../../utils/stash-db'

export default defineEventHandler((event) => {
  const stashId = getRouterParam(event, 'stashId')
  if (!stashId || !/^[A-Za-z0-9_-]{20,30}$/.test(stashId)) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid stash ID' })
  }

  purgeExpiredStashes()
  const stash = getStash(stashId)
  if (!stash) {
    throw createError({ statusCode: 404, statusMessage: 'Stash not found or expired' })
  }

  let envelope: { passwordProtected?: boolean }
  try {
    const parsed = JSON.parse(stash.envelope) as { innerIv?: string }
    envelope = { passwordProtected: Boolean(parsed.innerIv) }
  } catch {
    throw createError({ statusCode: 500, statusMessage: 'Stored stash is invalid' })
  }

  const result = stash.burn_after_reading
    ? consumeStash(stashId)
    : stash

  if (!result) {
    throw createError({ statusCode: 404, statusMessage: 'Stash not found or already burned' })
  }

  return {
    id: result.id,
    envelope: JSON.parse(result.envelope),
    passwordProtected: envelope.passwordProtected,
    expiresAt: result.expires_at,
    burnAfterReading: Boolean(result.burn_after_reading),
  }
})
