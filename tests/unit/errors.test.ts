import { afterEach, describe, expect, it } from 'vitest'
import { RecipeProcessingError, publicMessage } from '@/lib/errors'

const ORIGINAL_NODE_ENV = process.env.NODE_ENV

afterEach(() => {
  process.env.NODE_ENV = ORIGINAL_NODE_ENV
})

describe('RecipeProcessingError', () => {
  it('preserves the error code and custom name', () => {
    const error = new RecipeProcessingError('PARSING_FAILED', 'Could not parse recipe')

    expect(error).toBeInstanceOf(Error)
    expect(error.code).toBe('PARSING_FAILED')
    expect(error.name).toBe('RecipeProcessingError')
    expect(error.message).toBe('Could not parse recipe')
  })
})

describe('publicMessage', () => {
  it('returns the real error message outside production', () => {
    process.env.NODE_ENV = 'test'

    expect(publicMessage(new Error('debug me'))).toBe('debug me')
  })

  it('returns the fallback for non-Error values outside production', () => {
    process.env.NODE_ENV = 'development'

    expect(publicMessage('bad value', 'safe fallback')).toBe('safe fallback')
  })

  it('always returns the fallback in production', () => {
    process.env.NODE_ENV = 'production'

    expect(publicMessage(new Error('secret details'), 'safe fallback')).toBe('safe fallback')
    expect(publicMessage('bad value')).toBe('Internal server error')
  })
})
