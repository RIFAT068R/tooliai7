export type Mode = 'chat' | 'search' | 'image' | 'analyze'

export type MessageRole = 'user' | 'assistant'

export interface Source {
  title: string
  url: string
}

export interface RagSource {
  filename: string
  excerpt: string
  score: number
  documentId?: string
}

export interface Message {
  id: string
  conversationId: string
  userId: string
  role: MessageRole
  content: string
  sources?: Source[]
  ragSources?: RagSource[]
  imageUrl?: string
  fileUrl?: string
  fileName?: string
  createdAt: string
}

export interface Conversation {
  id: string
  userId: string
  title: string
  mode: Mode
  model?: string
  createdAt: string
  updatedAt: string
}

// ─── Chat / Text Models ───────────────────────────────────────────────────────
export type ChatModel =
  | 'gpt-4.1-mini'              // Blink / OpenAI – ultra fast, low cost
  | 'gpt-4.1'                   // Blink / OpenAI – smart, capable
  | 'gemini-2.0-flash'          // Gemini – fast, vision capable
  | 'gemini-1.5-pro'            // Gemini – high quality, long context
  | 'gemini-1.5-flash'          // Gemini – balanced
  | 'cloudflare-llama-3.1-8b'   // Cloudflare Workers AI – free
  | 'cloudflare-mistral-7b'     // Cloudflare Workers AI – balanced
  | 'groq-llama-3.1-8b'         // Groq – ultra-fast inference
  | 'groq-llama-3.1-70b'        // Groq – smart + fast
  | 'groq-mixtral-8x7b'         // Groq – balanced MoE
  | 'openrouter-claude-3-haiku' // OpenRouter – Claude fast
  | 'openrouter-llama-3-70b'    // OpenRouter – Llama large

// ─── Image Generation Models ──────────────────────────────────────────────────
export type ImageModel =
  | 'blink-nano'        // Blink fast (fal-ai/nano-banana)
  | 'blink-nano-pro'    // Blink high quality (fal-ai/nano-banana-pro)
  | 'blink-ultra'       // Blink ultra realism (fal-ai/flux-pro)

// Combined for backwards compat
export type AIModel = ChatModel | ImageModel

export interface ModelOption {
  value: AIModel
  label: string
  desc: string
  badge?: string
  provider: 'blink' | 'gemini' | 'cloudflare' | 'openrouter' | 'groq'
  tier: 'free' | 'paid'
  costPerToken?: number // relative cost, lower = cheaper
}

// ─── Subscription / Plans ─────────────────────────────────────────────────────
export type PlanTier = 'free' | 'pro' | 'max'

export interface Plan {
  id: PlanTier
  name: string
  price: number
  priceId?: string  // Stripe price ID
  limits: {
    messagesPerDay: number
    imagesPerDay: number
    modelsAllowed: string[]
  }
}

export interface UserUsage {
  userId: string
  date: string
  messageCount: number
  imageCount: number
  planTier: PlanTier
}

export interface SuggestionCard {
  icon: string
  title: string
  description: string
  mode: Mode
  prompt: string
}
