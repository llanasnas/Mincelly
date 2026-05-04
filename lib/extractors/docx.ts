// Mammoth only runs in Node.js (no Edge runtime support).
// Any route handler that imports this file must also declare:
//   export const runtime = 'nodejs'
export const runtime = 'nodejs'

import mammoth from 'mammoth'
import { readFile } from 'fs/promises'

/**
 * Docx extractor — extracts plain text from a .docx file using mammoth.
 * @param input  File path (string) or raw file contents (Buffer).
 */
export async function extract(input: string | Buffer): Promise<string> {
    const buffer = Buffer.isBuffer(input) ? input : await readFile(input)
    const result = await mammoth.extractRawText({ buffer })
    console.log(`mammoth result`, { value: result.value, messages: result.messages })
    return result.value.trim()
}
