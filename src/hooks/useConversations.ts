import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { blink } from '../blink/client'
import { generateId } from '../lib/utils'
import type { Conversation, Message, Mode, Source, PlanTier } from '../types'
import { PLANS } from '../lib/models'

// Edge function URL (deployed ai-router). Empty string = not deployed yet.
// When deployed, replace with the actual URL from blink_deploy_function output.
const AI_ROUTER_URL = ''  // e.g. 'https://fn-ai-router-xxxx.blink.new'

/** Models that can use blink.ai.streamText directly */
function isBlinkNativeModel(model: string): boolean {
  return model.startsWith('gpt-')
}

// ─── Conversations ────────────────────────────────────────────────────────────

export function useConversations(userId: string | undefined) {
  const qc = useQueryClient()

  const { data: conversations = [], isLoading } = useQuery({
    queryKey: ['conversations', userId],
    queryFn: async () => {
      if (!userId) return []
      const rows = await blink.db.conversations.list({
        where: { userId },
        orderBy: { updatedAt: 'desc' },
        limit: 50,
      })
      return rows as Conversation[]
    },
    enabled: !!userId,
  })

  const createConversation = useMutation({
    mutationFn: async ({ title, mode, model }: { title: string; mode: Mode; model?: string }) => {
      const now = new Date().toISOString()
      const conv = await blink.db.conversations.create({
        id: generateId(),
        userId: userId!,
        title,
        mode,
        model: model ?? null,
        createdAt: now,
        updatedAt: now,
      })
      return conv as Conversation
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', userId] }),
  })

  const deleteConversation = useMutation({
    mutationFn: async (id: string) => {
      // Also delete associated messages
      const msgs = await blink.db.messages.list({ where: { conversationId: id } })
      for (const m of msgs) {
        await blink.db.messages.delete(m.id as string)
      }
      await blink.db.conversations.delete(id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', userId] }),
  })

  const updateConversationTitle = useMutation({
    mutationFn: async ({ id, title }: { id: string; title: string }) => {
      await blink.db.conversations.update(id, { title, updatedAt: new Date().toISOString() })
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations', userId] }),
  })

  return { conversations, isLoading, createConversation, deleteConversation, updateConversationTitle }
}

// ─── Messages ─────────────────────────────────────────────────────────────────

export function useMessages(conversationId: string | null, userId: string | undefined) {
  const qc = useQueryClient()

  const { data: messages = [], isLoading } = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => {
      if (!conversationId || !userId) return []
      const rows = await blink.db.messages.list({
        where: { conversationId },
        orderBy: { createdAt: 'asc' },
      })
      return rows.map((r: Record<string, unknown>) => ({
        ...r,
        sources: r.sources ? JSON.parse(r.sources as string) : undefined,
      })) as Message[]
    },
    enabled: !!conversationId && !!userId,
  })

  const addMessage = useCallback(
    async (msg: Omit<Message, 'id' | 'createdAt'>) => {
      const newMsg: Message = {
        ...msg,
        id: generateId(),
        createdAt: new Date().toISOString(),
      }
      await blink.db.messages.create({
        id: newMsg.id,
        conversationId: newMsg.conversationId,
        userId: newMsg.userId,
        role: newMsg.role,
        content: newMsg.content,
        imageUrl: newMsg.imageUrl ?? null,
        fileUrl: newMsg.fileUrl ?? null,
        fileName: newMsg.fileName ?? null,
        sources: newMsg.sources ? JSON.stringify(newMsg.sources) : null,
        createdAt: newMsg.createdAt,
      })
      qc.invalidateQueries({ queryKey: ['messages', conversationId] })
      return newMsg
    },
    [conversationId, qc]
  )

  return { messages, isLoading, addMessage }
}

// ─── Streaming Chat ───────────────────────────────────────────────────────────

export function useStreamingChat() {
  const [streamingContent, setStreamingContent] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)
  const [sources, setSources] = useState<Source[]>([])

  const streamMessage = useCallback(
    async (
      messages: Array<{ role: string; content: string }>,
      model: string,
      useWebSearch: boolean
    ): Promise<{ content: string; sources: Source[] }> => {
      setIsStreaming(true)
      setStreamingContent('')
      setSources([])

      let fullContent = ''
      let finalSources: Source[] = []

      try {
        // ── Web search: always use blink.ai.generateText with search:true ──
        if (useWebSearch) {
          // Use a Blink-native model for web search (has search capability)
          const searchModel = isBlinkNativeModel(model) ? model : 'gpt-4.1-mini'
          const { text, sources: apiSources } = await blink.ai.generateText({
            model: searchModel,
            messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
            search: true,
            maxTokens: 4096,
          })

          // Simulate streaming for search results
          const words = text.split(' ')
          for (let i = 0; i < words.length; i++) {
            fullContent += (i === 0 ? '' : ' ') + words[i]
            setStreamingContent(fullContent)
            if (i % 6 === 0) await new Promise(r => setTimeout(r, 20))
          }

          if (apiSources && Array.isArray(apiSources)) {
            finalSources = (apiSources as Array<{ title?: string; url: string }>).map((s) => ({
              title: s.title || (() => { try { return new URL(s.url).hostname.replace('www.', '') } catch { return s.url } })(),
              url: s.url,
            }))
          }

        // ── Blink-native models: use real streaming ────────────────────────
        } else if (isBlinkNativeModel(model)) {
          await blink.ai.streamText(
            {
              model,
              messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
              maxTokens: 4096,
            },
            (chunk) => {
              fullContent += chunk
              setStreamingContent(fullContent)
            }
          )

        // ── Non-Blink models: try edge function router, fall back to gpt-4.1-mini ──
        } else if (AI_ROUTER_URL) {
          const resp = await fetch(AI_ROUTER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ model, messages, maxTokens: 4096 }),
          })
          if (!resp.ok) {
            const err = await resp.json().catch(() => ({ error: `Router error ${resp.status}` }))
            throw new Error(err.error || `Router error ${resp.status}`)
          }
          const { text } = await resp.json()
          // Simulate streaming
          const words = (text as string).split(' ')
          for (let i = 0; i < words.length; i++) {
            fullContent += (i === 0 ? '' : ' ') + words[i]
            setStreamingContent(fullContent)
            if (i % 6 === 0) await new Promise(r => setTimeout(r, 15))
          }

        // ── Fallback: non-Blink model + no router → use gpt-4.1-mini ────────
        } else {
          // Router not deployed — fall back to gpt-4.1-mini seamlessly
          await blink.ai.streamText(
            {
              model: 'gpt-4.1-mini',
              messages: messages as Array<{ role: 'user' | 'assistant' | 'system'; content: string }>,
              maxTokens: 4096,
            },
            (chunk) => {
              fullContent += chunk
              setStreamingContent(fullContent)
            }
          )
        }

        setSources(finalSources)
        return { content: fullContent, sources: finalSources }
      } finally {
        setIsStreaming(false)
        setStreamingContent('')
      }
    },
    []
  )

  return { streamingContent, isStreaming, isGeneratingImage, setIsGeneratingImage, sources, streamMessage, setStreamingContent }
}

// ─── Usage Tracking ───────────────────────────────────────────────────────────

// Blink SDK returns snake_case from DB — normalize to camelCase
function normalizeUsageRow(row: Record<string, unknown>) {
  return {
    id: (row.id ?? '') as string,
    messageCount: Number(row.message_count ?? row.messageCount ?? 0),
    imageCount: Number(row.image_count ?? row.imageCount ?? 0),
    planTier: (row.plan_tier ?? row.planTier ?? 'free') as string,
  }
}

export function useUsage(userId: string | undefined) {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const { data: usage } = useQuery({
    queryKey: ['usage', userId, today],
    queryFn: async () => {
      if (!userId) return null
      const rows = await blink.db.userUsage.list({
        where: { userId, date: today },
        limit: 1,
      })
      if (!rows[0]) return null
      return normalizeUsageRow(rows[0] as Record<string, unknown>)
    },
    enabled: !!userId,
    staleTime: 0, // Always refetch to get fresh counts
  })

  const { data: subscription } = useQuery({
    queryKey: ['subscription', userId],
    queryFn: async () => {
      if (!userId) return null
      const rows = await blink.db.subscriptions.list({
        where: { userId },
        limit: 1,
      })
      if (!rows[0]) return null
      const row = rows[0] as Record<string, unknown>
      return {
        planTier: (row.plan_tier ?? row.planTier ?? 'free') as string,
        status: (row.status ?? 'active') as string,
      }
    },
    enabled: !!userId,
  })

  const planTier = (subscription?.planTier ?? 'free') as PlanTier
  const plan = PLANS.find(p => p.id === planTier) ?? PLANS[0]
  const messageCount = usage?.messageCount ?? 0
  const imageCount = usage?.imageCount ?? 0
  const canSendMessage = messageCount < plan.limits.messagesPerDay
  const canGenerateImage = imageCount < plan.limits.imagesPerDay

  // Returns the LATEST counts directly from DB (bypasses stale cache)
  const fetchCurrentCounts = async () => {
    if (!userId) return { messageCount: 0, imageCount: 0 }
    const rows = await blink.db.userUsage.list({ where: { userId, date: today }, limit: 1 })
    if (!rows[0]) return { messageCount: 0, imageCount: 0 }
    const row = normalizeUsageRow(rows[0] as Record<string, unknown>)
    return { messageCount: row.messageCount, imageCount: row.imageCount }
  }

  const incrementUsage = useMutation({
    mutationFn: async (type: 'message' | 'image') => {
      if (!userId) return
      const existing = await blink.db.userUsage.list({ where: { userId, date: today }, limit: 1 })
      if (existing.length > 0) {
        const row = normalizeUsageRow(existing[0] as Record<string, unknown>)
        await blink.db.userUsage.update(row.id, {
          messageCount: type === 'message' ? row.messageCount + 1 : row.messageCount,
          imageCount: type === 'image' ? row.imageCount + 1 : row.imageCount,
        })
      } else {
        await blink.db.userUsage.create({
          id: generateId(),
          userId,
          date: today,
          messageCount: type === 'message' ? 1 : 0,
          imageCount: type === 'image' ? 1 : 0,
          planTier,
        })
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['usage', userId, today] }),
  })

  return {
    planTier,
    plan,
    messageCount,
    imageCount,
    canSendMessage,
    canGenerateImage,
    incrementUsage,
    fetchCurrentCounts,
  }
}