import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Globe, Image, FileSearch, MessageSquare, ArrowRight, Crown, Zap } from 'lucide-react'
import type { Mode, ChatModel, ImageModel, PlanTier } from '../types'
import { InputBar } from '../components/chat/InputBar'
import { DEFAULT_CHAT_MODEL, DEFAULT_IMAGE_MODEL, PLANS } from '../lib/models'
import { useVoice } from '../hooks/useVoice'

interface HomePageProps {
  user: { id: string; email: string; displayName?: string } | null
  mode: Mode
  chatModel: ChatModel
  imageModel: ImageModel
  planTier: PlanTier
  messageCount: number
  imageCount: number
  isLoading: boolean
  onSend: (text: string, file?: File) => void
  onModeChange: (mode: Mode) => void
  onChatModelChange: (model: ChatModel) => void
  onImageModelChange: (model: ImageModel) => void
  onUpgrade: () => void
}

const FEATURE_CARDS = [
  {
    category: 'SEARCH',
    categoryColor: 'text-emerald-600',
    icon: <Globe size={22} className="text-emerald-600" />,
    iconBg: 'bg-emerald-50',
    title: 'Search the web',
    desc: 'Real-time answers with live sources',
    mode: 'search' as Mode,
    prompt: 'What are the latest AI breakthroughs in 2025?',
    border: 'hover:border-emerald-200',
  },
  {
    category: 'CREATIVITY',
    categoryColor: 'text-pink-600',
    icon: <Image size={22} className="text-pink-600" />,
    iconBg: 'bg-pink-50',
    title: 'Generate images',
    desc: 'Create stunning visuals with AI art models',
    mode: 'image' as Mode,
    prompt: 'A cinematic photo of a neon-lit Tokyo street at night, raining',
    border: 'hover:border-pink-200',
  },
  {
    category: 'ANALYSIS',
    categoryColor: 'text-amber-600',
    icon: <FileSearch size={22} className="text-amber-600" />,
    iconBg: 'bg-amber-50',
    title: 'Analyze documents',
    desc: 'Upload files and extract key insights',
    mode: 'analyze' as Mode,
    prompt: 'Summarize and extract the key points from this document',
    border: 'hover:border-amber-200',
  },
  {
    category: 'PRODUCTIVITY',
    categoryColor: 'text-indigo-600',
    icon: <MessageSquare size={22} className="text-indigo-600" />,
    iconBg: 'bg-indigo-50',
    title: 'Write & code',
    desc: 'Draft emails, essays, and generate code',
    mode: 'chat' as Mode,
    prompt: 'Write a compelling LinkedIn post about the importance of continuous learning in tech',
    border: 'hover:border-indigo-200',
  },
]

export function HomePage({
  user, mode, chatModel, imageModel, planTier,
  messageCount, imageCount, isLoading,
  onSend, onModeChange, onChatModelChange, onImageModelChange, onUpgrade
}: HomePageProps) {
  const name = user?.displayName || user?.email?.split('@')[0] || null
  const plan = PLANS.find(p => p.id === planTier) ?? PLANS[0]

  // ── Mouse-move parallax ────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null)
  const rawX = useMotionValue(0)
  const rawY = useMotionValue(0)

  // Three spring layers with different stiffness = different "depths"
  // Layer 1 (closest) — snappiest
  const x1 = useSpring(useTransform(rawX, v => v * 28), { stiffness: 55, damping: 22 })
  const y1 = useSpring(useTransform(rawY, v => v * 28), { stiffness: 55, damping: 22 })
  // Layer 2 (mid)
  const x2 = useSpring(useTransform(rawX, v => v * 18), { stiffness: 30, damping: 20 })
  const y2 = useSpring(useTransform(rawY, v => v * 18), { stiffness: 30, damping: 20 })
  // Layer 3 (furthest) — laziest
  const x3 = useSpring(useTransform(rawX, v => v * 10), { stiffness: 16, damping: 18 })
  const y3 = useSpring(useTransform(rawY, v => v * 10), { stiffness: 16, damping: 18 })

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const cx = rect.left + rect.width / 2
      const cy = rect.top + rect.height / 2
      rawX.set((e.clientX - cx) / (rect.width / 2))
      rawY.set((e.clientY - cy) / (rect.height / 2))
    }
    window.addEventListener('mousemove', handleMove)
    return () => window.removeEventListener('mousemove', handleMove)
  }, [rawX, rawY])

  const { startRecording, stopRecording, cancelRecording, isRecording, isProcessing, interimText, finalText } = useVoice()

  const handleVoiceStop = async () => {
    try {
      const result = await stopRecording()
      return result
    } catch { /* handled in hook */ }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center justify-center min-h-full px-4 py-10 max-w-2xl mx-auto w-full overflow-hidden"
    >
      {/* ── Parallax background orbs ─────────────────────────────────────────
          Three layers, each moving at a different speed relative to the cursor.
          Autonomous breathing animation layered on top for always-alive feel.   */}

      {/* Layer 3 – furthest / slowest: large violet blob, top-left */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 520, height: 520,
          top: '-22%', left: '-20%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.11) 0%, transparent 68%)',
          x: x3, y: y3,
        }}
        animate={{ scale: [1, 1.07, 1], opacity: [0.65, 1, 0.65] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Layer 3 – furthest: soft teal blob, bottom-right */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 420, height: 420,
          bottom: '-14%', right: '-16%',
          background: 'radial-gradient(circle, rgba(13,148,136,0.09) 0%, transparent 68%)',
          x: x3, y: y3,
        }}
        animate={{ scale: [1, 1.09, 1], opacity: [0.55, 0.9, 0.55] }}
        transition={{ duration: 11, repeat: Infinity, ease: 'easeInOut', delay: 2.5 }}
      />

      {/* Layer 2 – mid: warm amber blob, bottom-left */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 260, height: 260,
          bottom: '10%', left: '2%',
          background: 'radial-gradient(circle, rgba(251,191,36,0.08) 0%, transparent 68%)',
          x: x2, y: y2,
        }}
        animate={{ scale: [1, 1.11, 1], opacity: [0.45, 0.8, 0.45] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
      />

      {/* Layer 1 – closest / fastest: small pink accent, top-right */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 200, height: 200,
          top: '5%', right: '6%',
          background: 'radial-gradient(circle, rgba(236,72,153,0.09) 0%, transparent 68%)',
          x: x1, y: y1,
        }}
        animate={{ scale: [1, 1.14, 1], opacity: [0.5, 0.9, 0.5] }}
        transition={{ duration: 7, repeat: Infinity, ease: 'easeInOut', delay: 0.8 }}
      />

      {/* Layer 1 – closest: tiny indigo dot, mid-left — adds fine-grain depth */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute rounded-full"
        style={{
          width: 110, height: 110,
          top: '38%', left: '8%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.10) 0%, transparent 68%)',
          x: x1, y: y1,
        }}
        animate={{ scale: [1, 1.18, 1], opacity: [0.4, 0.75, 0.4] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 3.2 }}
      />

      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <div className="relative z-10 text-center mb-8">
        {/* Logo — spring scale + fade up */}
        <motion.div
          className="flex items-center justify-center mb-5"
          initial={{ opacity: 0, scale: 0.72, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.65, ease: [0.34, 1.46, 0.64, 1] }}
        >
          <motion.img
            src="/logo.png"
            alt="TooliAi"
            className="w-20 h-20 rounded-2xl object-cover"
            style={{ boxShadow: '0 0 0 6px rgba(139,92,246,0.08), 0 4px 24px rgba(139,92,246,0.22)' }}
            whileHover={{ scale: 1.06, rotate: -2 }}
            transition={{ type: 'spring', stiffness: 320, damping: 18 }}
          />
        </motion.div>

        {/* Headline — slides up slightly later */}
        <motion.h1
          className="text-2xl sm:text-[32px] font-bold tracking-tight text-gray-900 mb-2 leading-tight"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
        >
          Hey, I'm{' '}
          <motion.span
            style={{ background: 'linear-gradient(135deg, #4F46E5, #0D9488)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.28, ease: [0.16, 1, 0.3, 1] }}
          >
            TooliAi
          </motion.span>
          .
        </motion.h1>

        {/* Subtitle — last to appear */}
        <motion.p
          className="text-[15px] text-gray-500 leading-relaxed"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
        >
          {name ? `Welcome back, ${name}. ` : ''}
          I'm your AI assistant. Ask me anything.
        </motion.p>
      </div>

      {/* Usage stats for free tier */}
      {planTier === 'free' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.34 }}
          className="relative z-10 w-full mb-5"
        >
          <div
            className="flex items-center flex-wrap gap-3 gap-y-2 px-4 py-3 rounded-2xl"
            style={{ background: '#fff', border: '1px solid rgba(0,0,0,0.07)', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Zap size={12} className="text-indigo-500" />
              <span>{messageCount}/{plan.limits.messagesPerDay} messages</span>
            </div>
            <div className="h-3 w-px bg-gray-200" />
            <div className="flex items-center gap-1.5 text-xs text-gray-500">
              <Image size={12} className="text-pink-500" />
              <span>{imageCount}/{plan.limits.imagesPerDay} images</span>
            </div>
            <button
              onClick={onUpgrade}
              className="ml-auto flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors"
            >
              <Crown size={11} />
              Upgrade
              <ArrowRight size={10} />
            </button>
          </div>
        </motion.div>
      )}

      {/* Feature cards 2×2 grid */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.42 }}
        className="relative z-10 grid grid-cols-1 sm:grid-cols-2 gap-3 w-full mb-7"
      >
        {FEATURE_CARDS.map(({ category, categoryColor, icon, iconBg, title, desc, mode: cardMode, prompt, border }, i) => (
          <motion.button
            key={title}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.44 + i * 0.06 }}
            whileHover={{ scale: 1.02, y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { onModeChange(cardMode); onSend(prompt) }}
            className={`flex flex-col items-start gap-2.5 p-3 sm:p-4 rounded-2xl text-left border transition-all duration-200 min-h-[100px] sm:min-h-[130px] ${border}`}
            style={{
              background: '#ffffff',
              border: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            }}
            onMouseEnter={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.boxShadow = '0 6px 20px rgba(0,0,0,0.09)'
            }}
            onMouseLeave={e => {
              const el = e.currentTarget as HTMLButtonElement
              el.style.boxShadow = '0 1px 4px rgba(0,0,0,0.05)'
            }}
          >
            <span className={`text-[9px] font-bold tracking-[0.12em] uppercase ${categoryColor} opacity-70`}>
              {category}
            </span>
            <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center`}>
              {icon}
            </div>
            <div>
              <div className="font-semibold text-[13px] text-gray-900 mb-0.5 leading-tight">{title}</div>
              <div className="text-[11px] text-gray-400 leading-snug">{desc}</div>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* Input bar */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.58 }}
        className="relative z-10 w-full"
      >
        <InputBar
          mode={mode}
          chatModel={chatModel ?? DEFAULT_CHAT_MODEL}
          imageModel={imageModel ?? DEFAULT_IMAGE_MODEL}
          isLoading={isLoading}
          isRecording={isRecording}
          isProcessing={isProcessing}
          interimText={interimText}
          finalText={finalText}
          onSend={onSend}
          onModeChange={onModeChange}
          onChatModelChange={onChatModelChange}
          onImageModelChange={onImageModelChange}
          onVoiceStart={startRecording}
          onVoiceStop={handleVoiceStop}
          onVoiceCancel={cancelRecording}
        />
        {!user ? (
          <p className="text-center text-[11px] text-gray-400 mt-3 px-2">
            <span
              className="text-indigo-600 cursor-pointer hover:underline font-medium"
              onClick={() => onSend('')}
            >
              Sign in
            </span>
            {' '}to save your chats · GPT-4.1 · Gemini · Groq
          </p>
        ) : (
          <p className="text-center text-[10px] text-gray-300 mt-3 px-2">
            TooliAi · GPT-4.1 · Gemini · Groq · Cloudflare AI
          </p>
        )}
      </motion.div>
    </div>
  )
}
