import { beforeEach, describe, expect, it } from 'vitest'
import { clientKey, rateLimit, resetRateLimits } from '@/lib/rate-limit'

const options = { limit: 3, windowMs: 60_000 }

beforeEach(() => {
  resetRateLimits()
})

describe('rateLimit', () => {
  it('allows up to the limit, then blocks', () => {
    const now = 1_000_000
    expect(rateLimit('ip', options, now).allowed).toBe(true)
    expect(rateLimit('ip', options, now + 1).allowed).toBe(true)
    expect(rateLimit('ip', options, now + 2).allowed).toBe(true)
    expect(rateLimit('ip', options, now + 3).allowed).toBe(false)
  })

  it('reports how long until the window resets', () => {
    const now = 1_000_000
    for (let i = 0; i < 3; i++) rateLimit('ip', options, now)

    expect(rateLimit('ip', options, now + 15_000)).toEqual({ allowed: false, retryAfter: 45 })
  })

  it('starts a fresh window once the previous one expires', () => {
    const now = 1_000_000
    for (let i = 0; i < 4; i++) rateLimit('ip', options, now)

    expect(rateLimit('ip', options, now + 60_000).allowed).toBe(true)
  })

  it('counts each key separately', () => {
    const now = 1_000_000
    for (let i = 0; i < 4; i++) rateLimit('process:1.1.1.1', options, now)

    expect(rateLimit('process:2.2.2.2', options, now).allowed).toBe(true)
    expect(rateLimit('nutrition:1.1.1.1', options, now).allowed).toBe(true)
  })
})

describe('clientKey', () => {
  const request = (headers: Record<string, string>) => new Request('http://localhost/api/process', { headers })

  it('uses the first address in X-Forwarded-For', () => {
    expect(clientKey(request({ 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }))).toBe('203.0.113.7')
  })

  it('falls back to X-Real-IP, then to a shared bucket', () => {
    expect(clientKey(request({ 'x-real-ip': '198.51.100.4' }))).toBe('198.51.100.4')
    expect(clientKey(request({}))).toBe('unknown')
  })
})
