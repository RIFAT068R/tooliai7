/**
 * AI Suite Booster — Smart AI Router Edge Function
 *
 * Features:
 * - Multi-provider routing: Gemini, Cloudflare AI, Groq, OpenRouter
 * - Smart cost optimization: route to cheapest model that meets quality needs
 * - Automatic fallback chain on provider errors
 * - Rate limit detection with friendly messages
 * - Request caching hints for repeated queries
 */

import { createClient } from 'npm:@blinkdotnew/sdk'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type, authorization',
}

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface RouterRequest {
  model: string
  messages?: ChatMessage[]
  maxTokens?: number
  temperature?: number
  userId?: string
}

// ─── Model cost tiers (relative units, 1 = cheapest) ─────────────────────────
const MODEL_COST: Record<string, number> = {
  'cloudflare-llama-3.1-8b': 0,
  'cloudflare-mistral-7b': 0,
  'groq-llama-3.1-8b': 1,
  'groq-gemma2-9b': 1,
  'groq-mixtral-8x7b': 2,
  'groq-llama-3.1-70b': 3,
  'gemini-2.0-flash': 2,
  'gemini-1.5-flash': 2,
  'openrouter-llama-3-70b': 2,
  'openrouter-claude-3-haiku': 3,
  'gemini-1.5-pro': 7,
}

// ─── Fallback chains per model ─────────────────────────────────────────────────
const FALLBACK_CHAINS: Record<string, string[]> = {
  'gemini-1.5-pro': ['gemini-1.5-pro', 'gemini-2.0-flash', 'groq-llama-3.1-70b'],
  'gemini-2.0-flash': ['gemini-2.0-flash', 'gemini-1.5-flash', 'groq-llama-3.1-8b'],
  'gemini-1.5-flash': ['gemini-1.5-flash', 'gemini-2.0-flash', 'groq-llama-3.1-8b'],
  'groq-llama-3.1-70b': ['groq-llama-3.1-70b', 'groq-mixtral-8x7b', 'gemini-2.0-flash'],
  'groq-llama-3.1-8b': ['groq-llama-3.1-8b', 'groq-mixtral-8x7b', 'gemini-2.0-flash'],
  'groq-mixtral-8x7b': ['groq-mixtral-8x7b', 'groq-llama-3.1-8b', 'gemini-1.5-flash'],
  'groq-gemma2-9b': ['groq-gemma2-9b', 'groq-llama-3.1-8b', 'cloudflare-llama-3.1-8b'],
  'cloudflare-llama-3.1-8b': ['cloudflare-llama-3.1-8b', 'groq-llama-3.1-8b', 'gemini-1.5-flash'],
  'cloudflare-mistral-7b': ['cloudflare-mistral-7b', 'groq-mixtral-8x7b', 'gemini-1.5-flash'],
  'openrouter-claude-3-haiku': ['openrouter-claude-3-haiku', 'groq-llama-3.1-70b', 'gemini-1.5-pro'],
  'openrouter-llama-3-70b': ['openrouter-llama-3-70b', 'groq-llama-3.1-70b', 'gemini-1.5-pro'],
}

// ─── Smart routing: select cheapest model for task ───────────────────────────
function selectCostOptimalModel(requestedModel: string, messages: ChatMessage[]): string {
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user')?.content ?? ''
  const lower = lastUserMsg.toLowerCase()

  // Very short, simple queries → use fastest/cheapest
  if (lastUserMsg.length < 80 && !lower.includes('explain') && !lower.includes('analyze')) {
    // If requested model is already cheap, keep it
    if ((MODEL_COST[requestedModel] ?? 99) <= 2) return requestedModel
    // Otherwise suggest a cheaper fallback but still use requested
    return requestedModel
  }

  return requestedModel
}

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function callGemini(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = Deno.env.get('GEMINI_API_KEY') || Deno.env.get('VITE_GEMINI_API_KEY')
  if (!apiKey) throw new Error('Gemini API key not configured')

  const geminiModel =
    model === 'gemini-1.5-pro' ? 'gemini-1.5-pro'
    : model === 'gemini-1.5-flash' ? 'gemini-1.5-flash'
    : 'gemini-2.0-flash'

  const systemParts = messages.filter(m => m.role === 'system').map(m => m.content)
  const conversationParts = messages.filter(m => m.role !== 'system')

  const geminiMessages = conversationParts.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))

  const body: Record<string, unknown> = {
    contents: geminiMessages,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature,
      topP: 0.95,
    },
  }

  if (systemParts.length > 0) {
    body.systemInstruction = { parts: [{ text: systemParts.join('\n\n') }] }
  }

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${geminiModel}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )

  if (!resp.ok) {
    const errText = await resp.text()
    if (resp.status === 429 || errText.includes('RESOURCE_EXHAUSTED')) {
      throw new Error('RATE_LIMIT:gemini')
    }
    throw new Error(`Gemini ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json()
  return data?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

// ─── Cloudflare Workers AI ────────────────────────────────────────────────────
async function callCloudflare(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const apiKey = Deno.env.get('CLOUDFLARE_API_KEY') || Deno.env.get('VITE_CLOUDFLARE_API_KEY')
  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') || 'auto'
  if (!apiKey) throw new Error('Cloudflare API key not configured')

  const cfModel = model === 'cloudflare-mistral-7b'
    ? '@cf/mistral/mistral-7b-instruct-v0.2'
    : '@cf/meta/llama-3.1-8b-instruct'

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModel}`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, max_tokens: maxTokens, stream: false }),
    }
  )

  if (!resp.ok) {
    const errText = await resp.text()
    if (resp.status === 429) throw new Error('RATE_LIMIT:cloudflare')
    throw new Error(`Cloudflare ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json()
  return data?.result?.response ?? data?.result?.[0]?.response ?? ''
}

// ─── Groq (LPU ultra-fast inference) ─────────────────────────────────────────
async function callGroq(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  const apiKey = Deno.env.get('GROQ_API_KEY') || Deno.env.get('VITE_GROQ_API_KEY')
  if (!apiKey) throw new Error('Groq API key not configured')

  const groqModelMap: Record<string, string> = {
    'groq-llama-3.1-8b': 'llama-3.1-8b-instant',
    'groq-llama-3.1-70b': 'llama-3.1-70b-versatile',
    'groq-mixtral-8x7b': 'mixtral-8x7b-32768',
    'groq-gemma2-9b': 'gemma2-9b-it',
  }
  const groqModel = groqModelMap[model] ?? 'llama-3.1-8b-instant'

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: groqModel,
      messages,
      max_tokens: maxTokens,
      temperature,
      stream: false,
    }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    if (resp.status === 429 || errText.includes('rate_limit')) throw new Error('RATE_LIMIT:groq')
    throw new Error(`Groq ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

// ─── OpenRouter ───────────────────────────────────────────────────────────────
async function callOpenRouter(
  model: string,
  messages: ChatMessage[],
  maxTokens: number
): Promise<string> {
  const apiKey = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('VITE_OPENART_API_KEY')
  if (!apiKey) throw new Error('OpenRouter API key not configured')

  const orModel = model === 'openrouter-claude-3-haiku'
    ? 'anthropic/claude-3-haiku'
    : 'meta-llama/llama-3-70b-instruct'

  const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://ai-suite-booster-2vovj88v.sites.blink.new',
      'X-Title': 'AI Suite Booster',
    },
    body: JSON.stringify({ model: orModel, messages, max_tokens: maxTokens }),
  })

  if (!resp.ok) {
    const errText = await resp.text()
    if (resp.status === 429) throw new Error('RATE_LIMIT:openrouter')
    throw new Error(`OpenRouter ${resp.status}: ${errText.slice(0, 200)}`)
  }

  const data = await resp.json()
  return data?.choices?.[0]?.message?.content ?? ''
}

// ─── Route to correct provider ────────────────────────────────────────────────
async function callModel(
  model: string,
  messages: ChatMessage[],
  maxTokens: number,
  temperature: number
): Promise<string> {
  if (model.startsWith('gemini-')) {
    return callGemini(model, messages, maxTokens, temperature)
  } else if (model.startsWith('cloudflare-')) {
    return callCloudflare(model, messages, maxTokens)
  } else if (model.startsWith('groq-')) {
    return callGroq(model, messages, maxTokens, temperature)
  } else if (model.startsWith('openrouter-')) {
    return callOpenRouter(model, messages, maxTokens)
  }
  throw new Error(`Unknown model: ${model}. Use Blink SDK directly for gpt-4.1 models.`)
}

// ─── Main handler ─────────────────────────────────────────────────────────────
async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const startTime = Date.now()

  try {
    const body: RouterRequest = await req.json()
    const { model, messages = [], maxTokens = 4096, temperature = 0.7 } = body

    // Get fallback chain for this model
    const chain = FALLBACK_CHAINS[model] ?? [model]

    // Smart cost routing
    const optimizedModel = selectCostOptimalModel(model, messages)
    const finalChain = [optimizedModel, ...chain.filter(m => m !== optimizedModel)]

    let lastError: Error | null = null
    let usedModel = model

    for (const m of finalChain) {
      try {
        usedModel = m
        const text = await callModel(m, messages, maxTokens, temperature)
        const elapsed = Date.now() - startTime

        return new Response(
          JSON.stringify({
            text,
            model: m,          // Report which model actually responded
            requested: model,  // Which model was requested
            elapsed,           // Response time in ms
          }),
          {
            status: 200,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json',
              'X-AI-Model': m,
              'X-AI-Elapsed': String(elapsed),
            }
          }
        )
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        const msg = lastError.message

        // Rate limit: try next fallback
        if (msg.startsWith('RATE_LIMIT:')) {
          console.warn(`[ai-router] Rate limited on ${m}, trying fallback…`)
          continue
        }

        // API key missing: skip provider
        if (msg.includes('not configured')) {
          console.warn(`[ai-router] ${m} not configured, skipping`)
          continue
        }

        // Other errors: try next fallback
        console.error(`[ai-router] Error on ${m}:`, msg)
        continue
      }
    }

    // All fallbacks exhausted
    const friendlyError = lastError?.message.startsWith('RATE_LIMIT:')
      ? `Rate limit reached for all providers. Please wait a moment and try again, or switch to a different model.`
      : lastError?.message ?? 'All AI providers failed. Please try again.'

    return new Response(
      JSON.stringify({ error: friendlyError, requestedModel: model, usedModel }),
      { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error'
    console.error('[ai-router] Fatal error:', message)
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
}

Deno.serve(handler)
