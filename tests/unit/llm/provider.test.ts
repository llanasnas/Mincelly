import { afterEach, describe, expect, it, vi } from 'vitest'
import { anthropicProvider } from '@/lib/llm/anthropic'
import { ollamaProvider } from '@/lib/llm/ollama'
import { openaiProvider } from '@/lib/llm/openai'

const ORIGINAL_ENV = { ...process.env }

async function loadProviderModule() {
  vi.resetModules()
  return import('@/lib/llm/provider')
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('getLLMProviderByName', () => {
  it('returns the concrete provider implementations', async () => {
    const { getLLMProviderByName } = await loadProviderModule()

    expect(getLLMProviderByName('anthropic')).toBe(anthropicProvider)
    expect(getLLMProviderByName('openai')).toBe(openaiProvider)
    expect(getLLMProviderByName('ollama')).toBe(ollamaProvider)
  })

  it('throws for unsupported provider names', async () => {
    const { getLLMProviderByName } = await loadProviderModule()

    expect(() => getLLMProviderByName('none' as never)).toThrow(/Unknown provider/)
  })
})

describe('isProviderAvailable', () => {
  it('checks required API keys and always allows ollama', async () => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY

    const { isProviderAvailable } = await loadProviderModule()

    expect(isProviderAvailable('anthropic')).toBe(false)
    expect(isProviderAvailable('openai')).toBe(false)
    expect(isProviderAvailable('ollama')).toBe(true)
  })
})

describe('getAvailableProviders', () => {
  it('uses ENABLED_PROVIDERS and filters unavailable or none entries', async () => {
    process.env.ENABLED_PROVIDERS = 'openai, ollama, none'
    delete process.env.OPENAI_API_KEY

    const { getAvailableProviders } = await loadProviderModule()

    expect(getAvailableProviders()).toEqual([{ id: 'ollama', label: 'Ollama (local)' }])
  })

  it('falls back to LLM_PROVIDER when ENABLED_PROVIDERS is not set', async () => {
    delete process.env.ENABLED_PROVIDERS
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'key'

    const { getAvailableProviders } = await loadProviderModule()

    expect(getAvailableProviders()).toEqual([{ id: 'openai', label: 'ChatGPT (OpenAI)' }])
  })
})

describe('getLLMProvider', () => {
  it('returns the first available provider and caches it per active provider', async () => {
    process.env.ENABLED_PROVIDERS = 'openai,ollama'
    delete process.env.OPENAI_API_KEY

    const { getLLMProvider } = await loadProviderModule()

    const first = getLLMProvider()
    const second = getLLMProvider()

    expect(first).toBe(ollamaProvider)
    expect(second).toBe(first)
  })

  it('falls back to LLM_PROVIDER when there are no available providers', async () => {
    delete process.env.ENABLED_PROVIDERS
    process.env.LLM_PROVIDER = 'anthropic'
    delete process.env.ANTHROPIC_API_KEY

    const { getLLMProvider } = await loadProviderModule()

    expect(getLLMProvider()).toBe(anthropicProvider)
  })
})
