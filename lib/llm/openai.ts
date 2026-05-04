import OpenAI from 'openai'
import type { ChatMessage, CompletionOptions, CompletionResult, LLMClient } from './types'

function serializeMessages(
  messages: ChatMessage[],
): OpenAI.Chat.ChatCompletionMessageParam[] {
  return messages.map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role as 'system' | 'user' | 'assistant', content: m.content }
    }

    // Multi-part: text + images → image_url
    const parts: OpenAI.Chat.ChatCompletionContentPart[] = m.content.map((p) => {
      if (p.type === 'text') return { type: 'text', text: p.text }
      return {
        type: 'image_url',
        image_url: { url: `data:${p.mediaType};base64,${p.data}` },
      }
    })
    return { role: 'user', content: parts }
  })
}

export const openaiProvider: LLMClient = {
  async complete(
    messages: ChatMessage[],
    options: CompletionOptions = {},
  ): Promise<CompletionResult> {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error('[openai] OPENAI_API_KEY is not set')

    const client = new OpenAI({ apiKey })
    const model = options.model ?? process.env.OPENAI_MODEL ?? 'gpt-4o-mini'

    const response = await client.chat.completions.create({
      model,
      messages: serializeMessages(messages),
      ...(options.temperature !== undefined && { temperature: options.temperature }),
      ...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
      ...(options.jsonMode && { response_format: { type: 'json_object' } }),
    })

    const text = response.choices[0]?.message?.content ?? ''
    if (!text) throw new Error('[openai] Response contained no text content')

    return { text, provider: 'openai', model: response.model }
  },
}
