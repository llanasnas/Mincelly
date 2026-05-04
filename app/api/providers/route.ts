import { NextResponse } from 'next/server'
import { getAvailableProviders } from '@/lib/llm/provider'

/**
 * GET /api/providers
 * Returns the list of LLM providers currently configured and available.
 * Used by the UI to show/hide the provider selector.
 */
export async function GET() {
    const providers = getAvailableProviders()
    return NextResponse.json(providers)
}
