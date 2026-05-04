import Anthropic from '@anthropic-ai/sdk'
import type { ChatMessage, CompletionOptions, CompletionResult, LLMClient } from './types'

const client = new Anthropic()

export const anthropicProvider: LLMClient = {
  async complete(messages: ChatMessage[], options: CompletionOptions = {}): Promise<CompletionResult> {
    const model = options.model ?? process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'
    const systemMessage = messages.find(m => m.role === 'system')
    const conversationMessages = messages.filter(m => m.role !== 'system')

    const toStringContent = (content: ChatMessage['content']): string =>
      typeof content === 'string'
        ? content
        : content.filter(p => p.type === 'text').map(p => (p.type === 'text' ? p.text : '')).join('\n')

    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(systemMessage && { system: toStringContent(systemMessage.content) }),
      messages: conversationMessages.map(m => ({
        role: m.role as 'user' | 'assistant',
        content: toStringContent(m.content),
      })),
    })

    const block = response.content[0]
    if (!block || block.type !== 'text') {
      throw new Error('[anthropic] Response contained no text content')
    }

    return { text: block.text, provider: 'anthropic', model }
  },
}
