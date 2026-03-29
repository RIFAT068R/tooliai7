import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Menu, Sparkles } from 'lucide-react'
import { Toaster, toast } from 'react-hot-toast'

import { Sidebar } from './components/layout/Sidebar'
import { HomePage } from './pages/HomePage'
import { ChatPage } from './pages/ChatPage'
import { PricingModal } from './pages/PricingModal'

import { useAuth } from './hooks/useAuth'
import { useConversations, useStreamingChat, useUsage } from './hooks/useConversations'
import { useDocumentRAG } from './hooks/useDocumentRAG'
import type { RagDocument } from './hooks/useDocumentRAG'

import { blink } from './blink/client'
import { generateId } from './lib/utils'
import { getSmartModel, DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL } from './lib/models'

import type { Mode, ChatModel, ImageModel, Message, PlanTier, RagSource } from './types'

export default function App() {
  // ── Auth ──────────────────────────────────────────────────────────────────
  const { user, isLoading: authLoading, login, logout } = useAuth()

  // ── UI State ──────────────────────────────────────────────────────────────
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const [pricingOpen, setPricingOpen] = useState(false)

  // ── Chat State ────────────────────────────────────────────────────────────
  const [mode, setMode] = useState<Mode>('chat')
  const [chatModel, setChatModel] = useState<ChatModel>(DEFAULT_CHAT_MODEL)
  const [imageModel] = useState<ImageModel>(DEFAULT_IMAGE_MODEL)
  const [activeConvId, setActiveConvId] = useState<string | null>(null)

  // Single source of truth for ALL messages shown in the current chat.
  // We manage this locally and persist to DB asynchronously.
  // This avoids any React Query cache lag / stale state issues.
  const [localMessages, setLocalMessages] = useState<Message[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // ── Data Hooks ────────────────────────────────────────────────────────────
  const { conversations, createConversation, deleteConversation } = useConversations(user?.id)
  const { streamingContent, isStreaming, isGeneratingImage, setIsGeneratingImage, streamMessage } = useStreamingChat()
  const { planTier, plan, messageCount, imageCount, canSendMessage, canGenerateImage, incrementUsage, fetchCurrentCounts } = useUsage(user?.id)
  const { activeDoc, ingestFile, queryDocument, clearDocument } = useDocumentRAG(user?.id)

  const isInChat = localMessages.length > 0

  // ── Helpers ───────────────────────────────────────────────────────────────

  const appendMessage = useCallback((msg: Message) => {
    setLocalMessages(prev => [...prev, msg])
  }, [])

  const persistMessage = useCallback(async (msg: Message, convId: string) => {
    try {
      await blink.db.messages.create({
        id: msg.id,
        conversationId: convId,
        userId: msg.userId,
        role: msg.role,
        content: msg.content,
        imageUrl: msg.imageUrl ?? null,
        fileUrl: msg.fileUrl ?? null,
        fileName: msg.fileName ?? null,
        sources: msg.sources ? JSON.stringify(msg.sources) : null,
        createdAt: msg.createdAt,
      })
    } catch {
      // DB persist failure is non-fatal — messages still show locally
    }
  }, [])

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleNewChat = useCallback(() => {
    setActiveConvId(null)
    setLocalMessages([])
    setMobileSidebarOpen(false)
  }, [])

  const handleSelectConv = useCallback(async (id: string) => {
    setActiveConvId(id)
    setLocalMessages([]) // Clear while loading
    setMobileSidebarOpen(false)

    // Load messages from DB for this conversation
    try {
      const rows = await blink.db.messages.list({
        where: { conversationId: id },
        orderBy: { createdAt: 'asc' },
      })
      const msgs = rows.map((r: Record<string, unknown>) => ({
        ...r,
        sources: r.sources ? JSON.parse(r.sources as string) : undefined,
      })) as Message[]
      setLocalMessages(msgs)
    } catch {
      setLocalMessages([])
    }
  }, [])

  const handleDeleteConv = useCallback(async (id: string) => {
    await deleteConversation.mutateAsync(id)
    if (activeConvId === id) {
      setActiveConvId(null)
      setLocalMessages([])
    }
    toast.success('Conversation deleted')
  }, [activeConvId, deleteConversation])

  const handleModeChange = useCallback((newMode: Mode) => {
    setMode(newMode)
  }, [])

  const handleStop = useCallback(() => {
    abortRef.current?.abort()
  }, [])

  const handleUpgradePlan = useCallback(async (planId: PlanTier) => {
    if (planId === 'free') {
      setPricingOpen(false)
      return
    }
    toast('Stripe checkout coming soon', { icon: '→' })
    setPricingOpen(false)
  }, [])

  const handleApplyEdit = useCallback(async (imageUrl: string) => {
    if (!user) return
    
    const userId = user.id
    const now = new Date().toISOString()
    const convId = activeConvId ?? 'pending'

    const aiMsg: Message = {
      id: generateId(),
      conversationId: convId,
      userId,
      role: 'assistant',
      content: '✨ Here is your edited image:',
      imageUrl,
      createdAt: now,
    }
    appendMessage(aiMsg)
    if (activeConvId) await persistMessage(aiMsg, activeConvId)
  }, [user, activeConvId, appendMessage, persistMessage])

  const handleSend = useCallback(async (text: string, file?: File) => {
    if (!text.trim() && !file) return

    // ── Auth gate ────────────────────────────────────────────────────────
    if (!user) {
      login()
      return
    }

    // ── Usage limits — fetch fresh counts from DB to avoid stale cache ───
    const freshCounts = await fetchCurrentCounts()
    if (mode === 'image' && freshCounts.imageCount >= plan.limits.imagesPerDay) {
      toast.error(`Image limit reached (${plan.limits.imagesPerDay}/day). Upgrade for more.`)
      setPricingOpen(true)
      return
    }
    if (mode !== 'image' && freshCounts.messageCount >= plan.limits.messagesPerDay) {
      toast.error(`Message limit reached (${plan.limits.messagesPerDay}/day). Upgrade for more.`)
      setPricingOpen(true)
      return
    }

    const effectiveChatModel: ChatModel = plan.limits.modelsAllowed.includes(chatModel)
      ? chatModel as ChatModel
      : 'gpt-4.1-mini'

    const userId = user.id
    const now = new Date().toISOString()

    // ── Build user message and add to local state immediately ─────────────
    const userMsg: Message = {
      id: generateId(),
      conversationId: activeConvId ?? 'pending',
      userId,
      role: 'user',
      content: text,
      fileName: file?.name,
      createdAt: now,
    }
    appendMessage(userMsg)
    // Increment AFTER the limit check passes
    incrementUsage.mutate(mode === 'image' ? 'image' : 'message')

    // ── Image generation ──────────────────────────────────────────────────
    if (mode === 'image') {
      setIsGeneratingImage(true)
      const blinkImageModel = imageModel === 'blink-ultra'
        ? 'fal-ai/flux-pro'
        : imageModel === 'blink-nano-pro'
          ? 'fal-ai/nano-banana-pro'
          : 'fal-ai/nano-banana'

      const imagePrompt = imageModel === 'blink-ultra'
        ? `${text}, highly detailed photorealistic masterpiece, 8k resolution, cinematic lighting, realistic textures, sharp focus`
        : text

      let convId = activeConvId
      if (!convId) {
        try {
          const conv = await createConversation.mutateAsync({ title: text.slice(0, 50), mode, model: imageModel })
          convId = conv.id
          setActiveConvId(convId)
          await persistMessage({ ...userMsg, conversationId: convId }, convId)
        } catch { /* continue */ }
      }

      try {
        const { data } = await blink.ai.generateImage({ prompt: imagePrompt, model: blinkImageModel })
        const imageUrl = data?.[0]?.url ?? ''
        const aiMsg: Message = {
          id: generateId(),
          conversationId: convId ?? 'pending',
          userId,
          role: 'assistant',
          content: imageUrl ? '✨ Here is your generated image:' : '❌ Image generation failed.',
          imageUrl,
          createdAt: new Date().toISOString(),
        }
        appendMessage(aiMsg)
        if (convId) await persistMessage(aiMsg, convId)
      } catch (err) {
        const errMsg: Message = {
          id: generateId(),
          conversationId: convId ?? 'pending',
          userId,
          role: 'assistant',
          content: `❌ Image generation failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
          createdAt: new Date().toISOString(),
        }
        appendMessage(errMsg)
        if (convId) await persistMessage(errMsg, convId)
      } finally {
        setIsGeneratingImage(false)
      }
      return
    }

    // ── Text / Chat / Search / Analyze ───────────────────────────────────

    // ── Analyze mode: RAG flow ────────────────────────────────────────────
    if (mode === 'analyze' && (file || activeDoc)) {
      // Create DB conversation on first message
      let convId = activeConvId
      if (!convId) {
        try {
          const conv = await createConversation.mutateAsync({ title: text.slice(0, 60), mode, model: 'gemini-rag' })
          convId = conv.id
          setActiveConvId(convId)
          await persistMessage({ ...userMsg, conversationId: convId, fileName: file?.name }, convId)
          setLocalMessages(prev => prev.map(m => ({ ...m, conversationId: convId! })))
        } catch { /* continue without DB */ }
      }

      // If a new file is attached, ingest it first
      if (file) {
        const processingId = generateId()
        const processingMsg: Message = {
          id: processingId,
          conversationId: convId ?? 'pending',
          userId,
          role: 'assistant',
          content: `📄 Ingesting **${file.name}** into knowledge base…`,
          createdAt: new Date().toISOString(),
        }
        appendMessage(processingMsg)

        let ingestedDoc: RagDocument | null = null
        try {
          ingestedDoc = await ingestFile(file)
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : 'Ingestion failed'
          toast.error(errMsg)
          // Replace processing message with error
          setLocalMessages(prev => prev.map(m =>
            m.id === processingId
              ? { ...m, content: `❌ Failed to ingest document: ${errMsg}` }
              : m
          ))
          return
        }

        if (!ingestedDoc || ingestedDoc.status !== 'ready') {
          setLocalMessages(prev => prev.map(m =>
            m.id === processingId
              ? { ...m, content: '❌ Document processing did not complete. Please try again.' }
              : m
          ))
          return
        }

        // Update processing message to show success
        setLocalMessages(prev => prev.map(m =>
          m.id === processingId
            ? { ...m, content: `✅ **${file.name}** ingested (${ingestedDoc!.chunkCount ?? '?'} chunks). Querying…` }
            : m
        ))
      }

      // Now stream the RAG answer
      const ragAnswerId = generateId()
      const ragPlaceholder: Message = {
        id: ragAnswerId,
        conversationId: convId ?? 'pending',
        userId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
      }
      appendMessage(ragPlaceholder)

      try {
        let streamedContent = ''
        const { answer, sources: ragSources } = await queryDocument(
          text,
          (delta) => {
            streamedContent += delta
            setLocalMessages(prev => prev.map(m =>
              m.id === ragAnswerId ? { ...m, content: streamedContent } : m
            ))
          },
        )

        const finalRagMsg: Message = {
          id: ragAnswerId,
          conversationId: convId ?? 'pending',
          userId,
          role: 'assistant',
          content: answer || streamedContent,
          ragSources: ragSources.length > 0 ? (ragSources as RagSource[]) : undefined,
          createdAt: new Date().toISOString(),
        }
        setLocalMessages(prev => prev.map(m => m.id === ragAnswerId ? finalRagMsg : m))
        if (convId) await persistMessage(finalRagMsg, convId)

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'RAG query failed'
        toast.error(msg)
        setLocalMessages(prev => prev.map(m =>
          m.id === ragAnswerId
            ? { ...m, content: `❌ ${msg}` }
            : m
        ))
      }
      return
    }

    // File upload (for non-analyze modes)
    let fileUrl: string | undefined
    if (file) {
      try {
        const ext = file.name.split('.').pop() ?? 'bin'
        const { publicUrl } = await blink.storage.upload(file, `uploads/${userId}/${generateId()}.${ext}`)
        fileUrl = publicUrl
      } catch {
        toast.error('File upload failed')
      }
    }

    // Model routing
    const resolvedModel = (effectiveChatModel === DEFAULT_CHAT_MODEL && mode === 'chat')
      ? getSmartModel(text, mode)
      : effectiveChatModel

    // Build history from localMessages (always up-to-date, no stale closure issue)
    // We read from the ref-equivalent by using setLocalMessages with a callback below
    // But here we need the current value — capture it synchronously before setState
    // localMessages is captured from the closure at call time, which is correct here
    // because we just appended userMsg synchronously via appendMessage above.
    // However React batches state updates, so localMessages doesn't include userMsg yet.
    // Solution: build history from localMessages (pre-append snapshot) + userMsg manually.
    const historyMsgs = localMessages
      .filter(m => m.role === 'user' || m.role === 'assistant')
      .slice(-12)
      .map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.imageUrl ? '[Image generated]' : m.fileUrl ? `[File: ${m.fileName}] ${m.content}` : m.content,
      }))

    const currentContent = fileUrl ? `[File attached: ${file?.name}]\n\n${text}` : text
    const allMessages = [
      { role: 'system' as const, content: buildSystemPrompt(mode, !!fileUrl) },
      ...historyMsgs,
      { role: 'user' as const, content: currentContent },
    ]

    // Create DB conversation on first message
    let convId = activeConvId
    if (!convId) {
      try {
        const conv = await createConversation.mutateAsync({ title: text.slice(0, 60), mode, model: resolvedModel })
        convId = conv.id
        setActiveConvId(convId)
        await persistMessage({ ...userMsg, conversationId: convId, fileUrl }, convId)
        // Update conversationId on all existing local messages
        setLocalMessages(prev => prev.map(m => ({ ...m, conversationId: convId! })))
      } catch { /* continue without DB */ }
    }

    // Stream response
    try {
      abortRef.current = new AbortController()
      const { content, sources } = await streamMessage(allMessages, resolvedModel, mode === 'search')

      if (!content && !sources.length) {
        throw new Error('No response received. The model may be temporarily unavailable.')
      }

      const aiMsg: Message = {
        id: generateId(),
        conversationId: convId ?? 'pending',
        userId,
        role: 'assistant',
        content,
        sources: sources.length > 0 ? sources : undefined,
        createdAt: new Date().toISOString(),
      }
      appendMessage(aiMsg)
      if (convId) await persistMessage(aiMsg, convId)

    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'

      if (msg.includes('AbortError') || msg.includes('aborted') || msg.includes('abort')) return

      if (msg.includes('401') || msg.includes('Unauthorized') || msg.includes('unauthorized')) {
        toast.error('Session expired. Please sign in again.')
        login()
        return
      }

      const friendlyMsg = (msg.includes('rate') || msg.includes('quota') || msg.includes('429'))
        ? 'Rate limit reached. Please wait a moment or switch to a different model.'
        : msg

      toast.error(friendlyMsg)

      const errMsg: Message = {
        id: generateId(),
        conversationId: convId ?? 'pending',
        userId,
        role: 'assistant',
        content: `❌ ${friendlyMsg}`,
        createdAt: new Date().toISOString(),
      }
      appendMessage(errMsg)
      if (convId) await persistMessage(errMsg, convId)
    }
  }, [
    user, login, mode, chatModel, imageModel, activeConvId, localMessages,
    plan, fetchCurrentCounts, activeDoc,
    appendMessage, persistMessage, createConversation, streamMessage, incrementUsage,
    ingestFile, queryDocument,
  ])

  const handleRegenerate = useCallback(async () => {
    const lastUser = [...localMessages].reverse().find(m => m.role === 'user')
    if (lastUser) await handleSend(lastUser.content)
  }, [localMessages, handleSend])

  // ── Loading screen ────────────────────────────────────────────────────────
  if (authLoading) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: '#FAFAFA' }}>
        <style>{`
          @keyframes logoFloat {
            0%, 100% { transform: translateY(0px) scale(1); }
            50% { transform: translateY(-8px) scale(1.04); }
          }
          @keyframes ringPulse1 {
            0% { transform: scale(1); opacity: 0.35; }
            70% { transform: scale(1.9); opacity: 0; }
            100% { transform: scale(1.9); opacity: 0; }
          }
          @keyframes ringPulse2 {
            0% { transform: scale(1); opacity: 0.2; }
            70% { transform: scale(2.5); opacity: 0; }
            100% { transform: scale(2.5); opacity: 0; }
          }
          @keyframes shimmerBar {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(400%); }
          }
          @keyframes fadeUp {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .logo-float { animation: logoFloat 2.6s ease-in-out infinite; }
          .ring1 { animation: ringPulse1 2.2s ease-out infinite; }
          .ring2 { animation: ringPulse2 2.2s ease-out 0.5s infinite; }
          .shimmer-bar { animation: shimmerBar 1.6s ease-in-out infinite; }
          .fade-up { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) both; }
          .fade-up-delay { animation: fadeUp 0.6s cubic-bezier(0.16,1,0.3,1) 0.15s both; }
        `}</style>
        <div className="flex flex-col items-center gap-6">
          {/* Logo with rings */}
          <div className="relative flex items-center justify-center w-24 h-24">
            {/* Outer ring */}
            <div className="ring2 absolute inset-0 rounded-2xl"
              style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.18) 0%, transparent 70%)' }} />
            {/* Inner ring */}
            <div className="ring1 absolute inset-0 rounded-2xl"
              style={{ background: 'radial-gradient(circle, rgba(139,92,246,0.25) 0%, transparent 70%)' }} />
            {/* Logo */}
            <div className="logo-float relative z-10">
              <img
                src="/logo.png"
                alt="TooliAi"
                className="w-20 h-20 rounded-2xl object-cover"
                style={{
                  boxShadow: '0 8px 32px rgba(99,102,241,0.28), 0 2px 8px rgba(0,0,0,0.10)',
                }}
              />
            </div>
          </div>

          {/* Text */}
          <div className="flex flex-col items-center gap-2">
            <span className="fade-up font-bold text-[17px] text-gray-900 tracking-tight">TooliAi Suite</span>

            {/* Shimmer progress bar */}
            <div className="fade-up-delay relative w-32 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(0,0,0,0.07)' }}>
              <div className="shimmer-bar absolute top-0 left-0 h-full w-1/3 rounded-full"
                style={{ background: 'linear-gradient(90deg, transparent, rgba(99,102,241,0.7), transparent)' }} />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Toaster
        position="top-center"
        containerStyle={{ top: '56px' }}
        toastOptions={{
          style: {
            background: '#ffffff',
            color: '#111111',
            border: '1px solid rgba(0,0,0,0.08)',
            borderRadius: '14px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.08)',
            fontSize: '13px',
          },
        }}
      />

      {/* Desktop sidebar */}
      <div className="hidden lg:block shrink-0">
        <Sidebar
          conversations={conversations}
          activeConvId={activeConvId}
          activeMode={mode}
          user={user}
          planTier={planTier}
          onNewChat={handleNewChat}
          onSelectConv={handleSelectConv}
          onDeleteConv={handleDeleteConv}
          onSelectMode={handleModeChange}
          onLogin={login}
          onLogout={logout}
          onUpgrade={() => setPricingOpen(true)}
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(c => !c)}
        />
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileSidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-30 lg:hidden"
              style={{ background: 'rgba(0,0,0,0.2)', backdropFilter: 'blur(4px)' }}
              onClick={() => setMobileSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 z-40 lg:hidden h-full"
            >
              <Sidebar
                conversations={conversations}
                activeConvId={activeConvId}
                activeMode={mode}
                user={user}
                planTier={planTier}
                onNewChat={handleNewChat}
                onSelectConv={handleSelectConv}
                onDeleteConv={handleDeleteConv}
                onSelectMode={handleModeChange}
                onLogin={login}
                onLogout={logout}
                onUpgrade={() => { setPricingOpen(true); setMobileSidebarOpen(false) }}
                collapsed={false}
                onToggleCollapse={() => setMobileSidebarOpen(false)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 h-screen">
        {/* Top header bar — shown on all screens */}
        <div
          className="flex items-center h-14 px-4 shrink-0"
          style={{
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            borderBottom: '1px solid rgba(0,0,0,0.07)',
          }}
        >
          {/* Mobile menu button */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="p-2 rounded-xl transition-colors lg:hidden mr-1"
            style={{ color: 'rgba(0,0,0,0.45)' }}
            onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'}
            onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'transparent'}
          >
            <Menu size={17} />
          </button>

          {/* Mobile logo */}
          <div className="flex items-center gap-2 lg:hidden">
            <img src="/logo.png" alt="TooliAi" className="w-7 h-7 rounded-xl object-cover" />
            <span className="font-semibold text-sm text-gray-900 tracking-tight">TooliAi</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Page title — desktop */}
          <div className="hidden lg:flex items-center gap-2 text-sm text-gray-500">
            <span className="font-medium text-gray-800">{isInChat ? 'Conversation' : 'New Chat'}</span>
          </div>

          <div className="flex-1" />

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {isInChat && (
              <button
                onClick={handleNewChat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-150"
                style={{ background: 'rgba(0,0,0,0.04)', color: 'rgba(0,0,0,0.55)' }}
                onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.07)'}
                onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'}
              >
                <Sparkles size={12} />
                New Chat
              </button>
            )}
          </div>
        </div>

        {/* Page content — stable key so it never unmounts mid-conversation */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {!isInChat ? (
            <motion.div
              key="home"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full overflow-y-auto flex items-center"
            >
              <HomePage
                user={user}
                mode={mode}
                chatModel={chatModel}
                imageModel={imageModel}
                planTier={planTier}
                messageCount={messageCount}
                imageCount={imageCount}
                isLoading={isStreaming || isGeneratingImage}
                onSend={handleSend}
                onModeChange={handleModeChange}
                onChatModelChange={setChatModel}
                onImageModelChange={() => {}}
                onUpgrade={() => setPricingOpen(true)}
              />
            </motion.div>
          ) : (
            <motion.div
              key="chat"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="h-full"
            >
              <ChatPage
                conversationId={activeConvId ?? 'pending'}
                messages={localMessages}
                mode={mode}
                chatModel={chatModel}
                imageModel={imageModel}
                isStreaming={isStreaming}
                isGeneratingImage={isGeneratingImage}
                streamingContent={streamingContent}
                onSend={handleSend}
                onStop={handleStop}
                onModeChange={handleModeChange}
                onChatModelChange={setChatModel}
                onImageModelChange={() => {}}
                onRegenerate={handleRegenerate}
                onApplyEdit={handleApplyEdit}
                ragDoc={activeDoc}
                onClearRagDoc={clearDocument}
              />
            </motion.div>
          )}
        </div>
      </div>

      {/* Pricing modal */}
      <PricingModal
        open={pricingOpen}
        currentPlan={planTier}
        onClose={() => setPricingOpen(false)}
        onSelectPlan={handleUpgradePlan}
      />
    </div>
  )
}

// ─── System prompt builder ────────────────────────────────────────────────────
function buildSystemPrompt(mode: Mode, hasFile: boolean): string {
  const base = `You are AI Suite, a helpful, knowledgeable, and concise AI assistant.
You provide accurate, well-structured responses using Markdown formatting where appropriate.
Keep responses focused and practical. Use code blocks for code. Use tables when comparing options.`

  const modePrompts: Record<Mode, string> = {
    chat: base,
    search: `${base}
You have access to real-time web search results. Always cite your sources.
Provide current, accurate information with source links when available.`,
    image: base,
    analyze: `${base}
The user has uploaded a file for analysis.${hasFile ? ' A file has been attached to this conversation.' : ''}
Extract key information, summarize content, identify patterns, and answer questions about the document.
Be thorough but concise in your analysis.`,
  }

  return modePrompts[mode]
}
