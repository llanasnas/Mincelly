import Anthropic from '@anthropic-ai/sdk'
import { readFile } from 'fs/promises'
import { extname } from 'path'
import { RecipeProcessingError } from '@/lib/errors'

type ImageMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'

const EXT_TO_MIME: Record<string, ImageMediaType> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
}

function detectMediaType(buf: Buffer): ImageMediaType {
    if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png'
    if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg'
    if (buf[0] === 0x47 && buf[1] === 0x49) return 'image/gif'
    if (buf[0] === 0x52 && buf[1] === 0x49 && buf[8] === 0x57 && buf[9] === 0x45) return 'image/webp'
    return 'image/jpeg'
}

const EXTRACT_PROMPT =
    'Extract all recipe text from this image. Return only the raw text content — ' +
    'ingredients, steps, quantities — exactly as written, without any formatting or commentary.'

async function extractWithAnthropic(buffer: Buffer, mediaType: ImageMediaType): Promise<string> {
    const client = new Anthropic()
    const model = process.env.ANTHROPIC_MODEL ?? 'claude-haiku-4-5-20251001'

    const response = await client.messages.create({
        model,
        max_tokens: 2048,
        messages: [{
            role: 'user',
            content: [
                {
                    type: 'image',
                    source: { type: 'base64', media_type: mediaType, data: buffer.toString('base64') },
                },
                { type: 'text', text: EXTRACT_PROMPT },
            ],
        }],
    })

    const block = response.content[0]
    if (!block || block.type !== 'text') {
        throw new RecipeProcessingError('OCR_FAILED', '[anthropic vision] Response contained no text')
    }
    return block.text
}

async function extractWithOllama(buffer: Buffer): Promise<string> {
    const model = process.env.OLLAMA_VISION_MODEL ?? process.env.OLLAMA_MODEL ?? 'llama3.2-vision'
    const baseUrl = process.env.OLLAMA_BASE_URL ?? 'http://localhost:11434'

    const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
            stream: false,
            messages: [{
                role: 'user',
                content: EXTRACT_PROMPT,
                images: [buffer.toString('base64')],
            }],
        }),
    })

    if (!res.ok) {
        throw new RecipeProcessingError('OCR_FAILED', `[ollama vision] HTTP ${res.status} — is ${model} installed? Run: ollama pull ${model}`)
    }

    const json = (await res.json()) as { message?: { content?: string } }
    const text = json.message?.content?.trim()
    if (!text) throw new RecipeProcessingError('OCR_FAILED', '[ollama vision] Empty response')
    return text
}

export async function extract(input: string | Buffer): Promise<string> {
    let buffer: Buffer
    let mediaType: ImageMediaType

    if (Buffer.isBuffer(input)) {
        buffer = input
        mediaType = detectMediaType(buffer)
    } else {
        buffer = await readFile(input)
        const ext = extname(input).toLowerCase()
        mediaType = EXT_TO_MIME[ext] ?? detectMediaType(buffer)
    }

    const provider = process.env.LLM_PROVIDER ?? 'anthropic'
    return provider === 'ollama'
        ? extractWithOllama(buffer)
        : extractWithAnthropic(buffer, mediaType)
}
