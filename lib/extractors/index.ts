/**
 * Extractor router — detects input type by URL pattern or file extension
 * and delegates to the appropriate extractor.
 *
 * Detection order:
 *  1. Buffer  → docx (most common binary recipe format in MVP)
 *  2. YouTube URL  → youtube
 *  3. .docx extension → docx
 *  4. Image extension (.jpg / .jpeg / .png / .gif / .webp) → image
 *  5. Anything else → text (plain string passthrough)
 */
import { extname } from 'path'
import { extract as extractText } from './text'
import { extract as extractDocx } from './docx'
import { extract as extractImage } from './image'
import { extract as extractYoutube } from './youtube'

const YOUTUBE_RE = /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/

const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp'])

export async function extract(input: string | Buffer): Promise<string> {
    if (Buffer.isBuffer(input)) {
        return extractDocx(input)
    }

    if (YOUTUBE_RE.test(input)) {
        return extractYoutube(input)
    }

    const ext = extname(input).toLowerCase()

    if (ext === '.docx') return extractDocx(input)
    if (IMAGE_EXTENSIONS.has(ext)) return extractImage(input)

    return extractText(input)
}
