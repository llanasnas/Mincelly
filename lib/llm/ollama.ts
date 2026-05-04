import type { ChatMessage, CompletionOptions, CompletionResult, LLMClient } from './types'

function serializeMessage(m: ChatMessage): { role: string; content: string; images?: string[] } {
  if (typeof m.content === 'string') return { role: m.role, content: m.content }

  const text = m.content
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
    .map(p => p.text)
    .join('\n')

  const images = m.content
    .filter((p): p is { type: 'image'; mediaType: string; data: string } => p.type === 'image')
    .map(p => p.data)

  return { role: m.role, content: text, ...(images.length > 0 && { images }) }
}

export const ollamaProvider: LLMClient = {
  async complete(messages: ChatMessage[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'
    const model = options.model ?? process.env.OLLAMA_MODEL ?? 'llama3.2'

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: messages.map(serializeMessage),
        stream: false,
        ...(options.jsonMode && { format: 'json' }),
        options: {
          ...(options.temperature !== undefined && { temperature: options.temperature }),
          ...(options.maxTokens !== undefined && { num_predict: options.maxTokens }),
        },
      }),
    })


    if (!response.ok) {
      const body = await response.text()
      if (body && (body.includes('model') && body.includes('not found') || body.includes('unknown model'))) {
        throw new Error(`[ollama] Model not found: ${model}`)
      }
      throw new Error(`[ollama] Request failed: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as { message?: { content?: string } }
    const text = data.message?.content ?? ''

    return { text, provider: 'ollama', model }
  },
}
