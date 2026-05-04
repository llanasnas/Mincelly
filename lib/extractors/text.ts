/**
 * Text extractor — trivial passthrough.
 * Input is already plain text; just return it as-is.
 */
export async function extract(input: string): Promise<string> {
    return input
}
