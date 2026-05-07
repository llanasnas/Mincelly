import { afterEach, describe, expect, it, vi } from 'vitest'

const ORIGINAL_ENV = { ...process.env }

async function loadProviderModule() {
  vi.resetModules()
  const [providerModule, anthropicModule, openaiModule, ollamaModule] = await Promise.all([
    import('@/lib/llm/provider'),
    import('@/lib/llm/anthropic'),
    import('@/lib/llm/openai'),
    import('@/lib/llm/ollama'),
  ])
  return { providerModule, anthropicModule, openaiModule, ollamaModule }
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV }
  vi.resetModules()
})

describe('getLLMProviderByName', () => {
  it('returns the concrete provider implementations', async () => {
    const { providerModule, anthropicModule, openaiModule, ollamaModule } = await loadProviderModule()

    expect(providerModule.getLLMProviderByName('anthropic')).toBe(anthropicModule.anthropicProvider)
    expect(providerModule.getLLMProviderByName('openai')).toBe(openaiModule.openaiProvider)
    expect(providerModule.getLLMProviderByName('ollama')).toBe(ollamaModule.ollamaProvider)
  })

  it('throws for unsupported provider names', async () => {
    const { providerModule } = await loadProviderModule()

    expect(() => providerModule.getLLMProviderByName('none' as never)).toThrow(/Unknown provider/)
  })
})

describe('isProviderAvailable', () => {
  it('checks required API keys and always allows ollama', async () => {
    delete process.env.ANTHROPIC_API_KEY
    delete process.env.OPENAI_API_KEY

    const { providerModule } = await loadProviderModule()

    expect(providerModule.isProviderAvailable('anthropic')).toBe(false)
    expect(providerModule.isProviderAvailable('openai')).toBe(false)
    expect(providerModule.isProviderAvailable('ollama')).toBe(true)
  })
})

describe('getAvailableProviders', () => {
  it('uses ENABLED_PROVIDERS and filters unavailable or none entries', async () => {
    process.env.ENABLED_PROVIDERS = 'openai, ollama, none'
    delete process.env.OPENAI_API_KEY

    const { providerModule } = await loadProviderModule()

    expect(providerModule.getAvailableProviders()).toEqual([{ id: 'ollama', label: 'Ollama (local)' }])
  })

  it('falls back to LLM_PROVIDER when ENABLED_PROVIDERS is not set', async () => {
    delete process.env.ENABLED_PROVIDERS
    process.env.LLM_PROVIDER = 'openai'
    process.env.OPENAI_API_KEY = 'key'

    const { providerModule } = await loadProviderModule()

    expect(providerModule.getAvailableProviders()).toEqual([{ id: 'openai', label: 'ChatGPT (OpenAI)' }])
  })
})

describe('getLLMProvider', () => {
  it('returns the first available provider and caches it per active provider', async () => {
    process.env.ENABLED_PROVIDERS = 'openai,ollama'
    delete process.env.OPENAI_API_KEY

    const { providerModule, ollamaModule } = await loadProviderModule()

    const first = providerModule.getLLMProvider()
    const second = providerModule.getLLMProvider()

    expect(first).toBe(ollamaModule.ollamaProvider)
    expect(second).toBe(first)
  })

  it('falls back to LLM_PROVIDER when there are no available providers', async () => {
    delete process.env.ENABLED_PROVIDERS
    process.env.LLM_PROVIDER = 'anthropic'
    delete process.env.ANTHROPIC_API_KEY

    const { providerModule, anthropicModule } = await loadProviderModule()

    expect(providerModule.getLLMProvider()).toBe(anthropicModule.anthropicProvider)
  })
})
