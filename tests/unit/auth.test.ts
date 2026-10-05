import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getAllowedEmails, isEmailAllowed, isForceLogin, safeReturnPath } from '@/lib/auth/config'
import { sessionCookieAttributes, signSession, verifySession } from '@/lib/auth/session'

const ORIGINAL_ENV = { ...process.env }
const user = { email: 'ana@example.com', name: 'Ana', picture: 'https://example.com/a.png' }

beforeEach(() => {
  process.env.AUTH_SECRET = 'x'.repeat(48)
})

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.useRealTimers()
})

describe('safeReturnPath', () => {
  it('keeps paths inside the app', () => {
    expect(safeReturnPath('/recipes/12')).toBe('/recipes/12')
    expect(safeReturnPath('/?type=cocina&q=tortilla')).toBe('/?type=cocina&q=tortilla')
  })

  it('rejects anything a browser would resolve to another origin', () => {
    expect(safeReturnPath('https://evil.example')).toBe('/')
    expect(safeReturnPath('//evil.example')).toBe('/')
    expect(safeReturnPath('/\\evil.example')).toBe('/')
    expect(safeReturnPath('/\t/evil.example')).toBe('/')
    expect(safeReturnPath('javascript:alert(1)')).toBe('/')
  })

  it('defaults to the home page', () => {
    expect(safeReturnPath(undefined)).toBe('/')
    expect(safeReturnPath(null)).toBe('/')
    expect(safeReturnPath('')).toBe('/')
  })
})

describe('isForceLogin', () => {
  it('accepts the usual truthy spellings', () => {
    for (const value of ['true', 'TRUE', '1', 'yes', ' on ']) {
      process.env.FORCE_LOGIN = value
      expect(isForceLogin(), value).toBe(true)
    }
  })

  it('is off by default and for anything else', () => {
    delete process.env.FORCE_LOGIN
    expect(isForceLogin()).toBe(false)
    process.env.FORCE_LOGIN = 'false'
    expect(isForceLogin()).toBe(false)
  })
})

describe('email allowlist', () => {
  it('normalises case and whitespace', () => {
    process.env.ALLOWED_EMAILS = ' Ana@Example.com , bob@example.com,, '
    expect(getAllowedEmails()).toEqual(['ana@example.com', 'bob@example.com'])
    expect(isEmailAllowed('ANA@example.com ')).toBe(true)
    expect(isEmailAllowed('eve@example.com')).toBe(false)
  })

  it('allows everyone when the list is empty', () => {
    delete process.env.ALLOWED_EMAILS
    expect(isEmailAllowed('anyone@example.com')).toBe(true)
  })
})

describe('session tokens', () => {
  it('round-trips a signed session', async () => {
    const token = await signSession(user)
    expect(await verifySession(token)).toEqual(user)
  })

  it('rejects a tampered payload', async () => {
    const token = await signSession(user)
    const [, signature] = token.split('.')
    const forged = Buffer.from(JSON.stringify({ ...user, email: 'admin@example.com', exp: 9_999_999_999 }))
      .toString('base64url')

    expect(await verifySession(`${forged}.${signature}`)).toBeNull()
  })

  it('rejects a token signed with a different secret', async () => {
    const token = await signSession(user)
    process.env.AUTH_SECRET = 'y'.repeat(48)

    expect(await verifySession(token)).toBeNull()
  })

  it('rejects an expired session', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    const token = await signSession(user)

    vi.setSystemTime(new Date('2026-01-07T23:59:00Z'))
    expect(await verifySession(token)).toEqual(user)

    vi.setSystemTime(new Date('2026-01-08T00:00:01Z'))
    expect(await verifySession(token)).toBeNull()
  })

  it('rejects malformed tokens without throwing', async () => {
    for (const token of [undefined, null, '', 'no-dot', '.sig', 'payload.', '%%%.%%%']) {
      expect(await verifySession(token), String(token)).toBeNull()
    }
  })

  it('treats a missing or short secret as "no valid session"', async () => {
    const token = await signSession(user)
    process.env.AUTH_SECRET = 'short'

    expect(await verifySession(token)).toBeNull()
    await expect(signSession(user)).rejects.toThrow(/AUTH_SECRET/)
  })
})

describe('sessionCookieAttributes', () => {
  it('is HttpOnly and SameSite=Lax, and Secure only in production', () => {
    const env = process.env as Record<string, string | undefined>

    env.NODE_ENV = 'development'
    expect(sessionCookieAttributes(60)).toBe('Path=/; HttpOnly; SameSite=Lax; Max-Age=60')

    env.NODE_ENV = 'production'
    expect(sessionCookieAttributes(60)).toBe('Path=/; HttpOnly; SameSite=Lax; Secure; Max-Age=60')
  })
})
