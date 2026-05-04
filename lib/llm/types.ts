export type LLMProvider = 'anthropic' | 'openai' | 'ollama'

export type MessageContentPart =
  | { type: 'text'; text: string }
  | { type: 'image'; mediaType: string; data: string }

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string | MessageContentPart[]
}

export interface CompletionOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  /** Force structured JSON output. Honored by Ollama via `format: 'json'`; ignored by providers that don't support it. */
  jsonMode?: boolean
}

export interface CompletionResult {
  text: string
  provider: LLMProvider
  model: string
}

export interface LLMClient {
  complete(messages: ChatMessage[], options?: CompletionOptions): Promise<CompletionResult>
}
