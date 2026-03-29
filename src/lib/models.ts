import type { AIModel, ChatModel, ImageModel, ModelOption, Plan } from '../types'

export const CHAT_MODELS: ModelOption[] = [
  {
    value: 'gpt-4.1-mini',
    label: 'GPT-4.1 Mini',
    desc: 'Ultra-fast, great for most tasks',
    badge: 'OpenAI',
    provider: 'blink',
    tier: 'free',
    costPerToken: 1,
  },
  {
    value: 'gpt-4.1',
    label: 'GPT-4.1',
    desc: 'Best reasoning & quality',
    badge: 'OpenAI',
    provider: 'blink',
    tier: 'pro',
    costPerToken: 8,
  },
  {
    value: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    desc: 'Fast multimodal model',
    badge: 'Gemini',
    provider: 'gemini',
    tier: 'free',
    costPerToken: 1,
  },
  {
    value: 'gemini-1.5-pro',
    label: 'Gemini 1.5 Pro',
    desc: 'Long context, complex tasks',
    badge: 'Gemini',
    provider: 'gemini',
    tier: 'pro',
    costPerToken: 7,
  },
  {
    value: 'gemini-1.5-flash',
    label: 'Gemini 1.5 Flash',
    desc: 'Balanced speed & quality',
    badge: 'Gemini',
    provider: 'gemini',
    tier: 'free',
    costPerToken: 2,
  },
  {
    value: 'groq-llama-3.1-8b',
    label: 'Llama 3.1 8B',
    desc: '⚡ Ultra-fast via Groq',
    badge: 'Groq',
    provider: 'groq',
    tier: 'free',
    costPerToken: 1,
  },
  {
    value: 'groq-llama-3.1-70b',
    label: 'Llama 3.1 70B',
    desc: 'Powerful open-source model',
    badge: 'Groq',
    provider: 'groq',
    tier: 'free',
    costPerToken: 2,
  },
  {
    value: 'groq-mixtral-8x7b',
    label: 'Mixtral 8x7B',
    desc: 'Balanced mixture-of-experts',
    badge: 'Groq',
    provider: 'groq',
    tier: 'free',
    costPerToken: 2,
  },
  {
    value: 'cloudflare-llama-3.1-8b',
    label: 'Llama 3.1 8B',
    desc: 'Free Cloudflare inference',
    badge: 'Cloudflare',
    provider: 'cloudflare',
    tier: 'free',
    costPerToken: 0,
  },
  {
    value: 'cloudflare-mistral-7b',
    label: 'Mistral 7B',
    desc: 'Free Cloudflare inference',
    badge: 'Cloudflare',
    provider: 'cloudflare',
    tier: 'free',
    costPerToken: 0,
  },
  {
    value: 'openrouter-claude-3-haiku',
    label: 'Claude 3 Haiku',
    desc: 'Fast Claude model',
    badge: 'Anthropic',
    provider: 'openrouter',
    tier: 'pro',
    costPerToken: 3,
  },
  {
    value: 'openrouter-llama-3-70b',
    label: 'Llama 3 70B',
    desc: 'Large open-source model',
    badge: 'Meta',
    provider: 'openrouter',
    tier: 'free',
    costPerToken: 2,
  },
]

export const IMAGE_MODELS: ModelOption[] = [
  {
    value: 'blink-nano',
    label: 'Fast Generate',
    desc: 'Quick image generation',
    badge: 'Blink',
    provider: 'blink',
    tier: 'free',
    costPerToken: 5,
  },
  {
    value: 'blink-nano-pro',
    label: 'Quality Generate',
    desc: 'High fidelity output',
    badge: 'Blink',
    provider: 'blink',
    tier: 'pro',
    costPerToken: 15,
  },
  {
    value: 'blink-ultra',
    label: 'Ultra Realistic',
    desc: 'Stunning textures & 4K quality',
    badge: 'New',
    provider: 'blink',
    tier: 'pro',
    costPerToken: 35,
  },
]

export const PROVIDER_COLORS: Record<ModelOption['provider'], string> = {
  blink: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
  gemini: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  cloudflare: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  openrouter: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  groq: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
}

// ─── Smart Model Routing ──────────────────────────────────────────────────────
// Automatically suggests the best model for a given task
export function getSmartModel(prompt: string, mode: string): ChatModel {
  const lower = prompt.toLowerCase()

  // Code tasks → GPT-4.1 or Groq for speed
  if (mode === 'chat' && (lower.includes('code') || lower.includes('function') || lower.includes('debug') || lower.includes('script'))) {
    return 'gpt-4.1-mini'
  }

  // Long analysis → Gemini for context window
  if (prompt.length > 2000 || lower.includes('analyze') || lower.includes('summarize') || lower.includes('document')) {
    return 'gemini-1.5-flash'
  }

  // Quick factual → Groq for speed
  if (prompt.length < 100 && (lower.includes('what') || lower.includes('who') || lower.includes('when') || lower.includes('how many'))) {
    return 'groq-llama-3.1-8b'
  }

  // Default: GPT-4.1 Mini (fast + capable)
  return 'gpt-4.1-mini'
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    name: 'Free',
    price: 0,
    limits: {
      messagesPerDay: 20,
      imagesPerDay: 3,
      modelsAllowed: ['gpt-4.1-mini', 'gemini-2.0-flash', 'gemini-1.5-flash', 'groq-llama-3.1-8b', 'groq-llama-3.1-70b', 'groq-mixtral-8x7b', 'cloudflare-llama-3.1-8b', 'cloudflare-mistral-7b', 'openrouter-llama-3-70b', 'blink-nano'],
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 12,
    priceId: 'price_pro_monthly', // Replace with real Stripe price ID
    limits: {
      messagesPerDay: 300,
      imagesPerDay: 50,
      modelsAllowed: ['gpt-4.1-mini', 'gpt-4.1', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'groq-llama-3.1-8b', 'groq-llama-3.1-70b', 'groq-mixtral-8x7b', 'cloudflare-llama-3.1-8b', 'cloudflare-mistral-7b', 'openrouter-claude-3-haiku', 'openrouter-llama-3-70b', 'blink-nano', 'blink-nano-pro', 'blink-ultra'],
    },
  },
  {
    id: 'max',
    name: 'Max',
    price: 29,
    priceId: 'price_max_monthly', // Replace with real Stripe price ID
    limits: {
      messagesPerDay: 9999,
      imagesPerDay: 200,
      modelsAllowed: ['gpt-4.1-mini', 'gpt-4.1', 'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash', 'groq-llama-3.1-8b', 'groq-llama-3.1-70b', 'groq-mixtral-8x7b', 'cloudflare-llama-3.1-8b', 'cloudflare-mistral-7b', 'openrouter-claude-3-haiku', 'openrouter-llama-3-70b', 'blink-nano', 'blink-nano-pro', 'blink-ultra'],
    },
  },
]

export function isChatModel(model: AIModel): model is ChatModel {
  return CHAT_MODELS.some(m => m.value === model)
}

export function isImageModel(model: AIModel): model is ImageModel {
  return IMAGE_MODELS.some(m => m.value === model)
}

export function getChatModelLabel(model: ChatModel): string {
  return CHAT_MODELS.find(m => m.value === model)?.label ?? model
}

export function getImageModelLabel(model: ImageModel): string {
  return IMAGE_MODELS.find(m => m.value === model)?.label ?? model
}

export const DEFAULT_CHAT_MODEL: ChatModel = 'gpt-4.1-mini'
export const DEFAULT_IMAGE_MODEL: ImageModel = 'blink-nano'