import type { LLMClient, LLMProvider } from './types'
import { anthropicProvider } from './anthropic'
import { openaiProvider } from './openai'
import { ollamaProvider } from './ollama'

const PROVIDER_LABELS: Record<LLMProvider, string> = {
  anthropic: 'Claude (Anthropic)',
  openai: 'ChatGPT (OpenAI)',
  ollama: 'Ollama (local)',
}

export function getLLMProviderByName(name: LLMProvider): LLMClient {
  switch (name) {
    case 'anthropic': return anthropicProvider
    case 'openai': return openaiProvider
    case 'ollama': return ollamaProvider
    default:
      throw new Error(`[llm] Unknown provider: "${name as string}". Valid options: anthropic, openai, ollama`)
  }
}

export function isProviderAvailable(name: LLMProvider): boolean {
  if (name === 'anthropic') return !!process.env.ANTHROPIC_API_KEY
  if (name === 'openai') return !!process.env.OPENAI_API_KEY
  if (name === 'ollama') return true
  return false
}

export function getAvailableProviders(): { id: LLMProvider; label: string }[] {
  const raw = process.env.ENABLED_PROVIDERS
  const names: LLMProvider[] = raw
    ? (raw.split(',').map((s) => s.trim()).filter(Boolean) as LLMProvider[])
    : [(process.env.LLM_PROVIDER ?? 'anthropic') as LLMProvider]

  return names
    .filter((n) => n !== ('none' as LLMProvider) && isProviderAvailable(n))
    .map((id) => ({ id, label: PROVIDER_LABELS[id] ?? id }))
}

let _instance: LLMClient | null = null
let _activeProvider: LLMProvider | null = null

export function getLLMProvider(): LLMClient {
  const available = getAvailableProviders()
  const name = available[0]?.id ?? (process.env.LLM_PROVIDER ?? 'anthropic') as LLMProvider

  if (_instance && _activeProvider === name) return _instance

  _instance = getLLMProviderByName(name)
  _activeProvider = name

  return _instance
}
