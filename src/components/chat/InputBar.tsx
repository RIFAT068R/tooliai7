import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Paperclip, Mic, Loader2, Image, Globe,
  MessageSquare, FileSearch, ChevronDown, ChevronUp, Zap, X, Square,
  Grid3X3, Plus, FileText, AlertCircle, CheckCircle2, Settings2
} from 'lucide-react'
import type { Mode, ChatModel, ImageModel } from '../../types'
import type { RagDocument } from '../../hooks/useDocumentRAG'
import { CHAT_MODELS, IMAGE_MODELS, PROVIDER_COLORS } from '../../lib/models'
import { cn } from '../../lib/utils'
import type { TranscribeResult } from '../../hooks/useVoice'

const IMAGE_STYLES = ['Photorealistic', 'Anime', 'Oil Painting', 'Digital Art', 'Sketch', 'Watercolor', 'Cinematic', '3D Render'] as const
const ASPECT_RATIOS = ['1:1', '16:9', '9:16', '4:3'] as const

function buildEnhancedPrompt(text: string, negativePrompt: string, selectedStyle: string, aspectRatio: string): string {
  let enhanced = text.trim()
  if (selectedStyle) enhanced += `, ${selectedStyle} style`
  if (aspectRatio !== '1:1') enhanced += `, ${aspectRatio} aspect ratio`
  if (negativePrompt.trim()) enhanced += ` -- avoid: ${negativePrompt.trim()}`
  return enhanced
}

interface InputBarProps {
  mode: Mode
  chatModel: ChatModel
  imageModel: ImageModel
  isLoading: boolean
  isRecording?: boolean
  isProcessing?: boolean
  placeholder?: string
  onSend: (text: string, file?: File) => void
  onStop?: () => void
  onModeChange: (mode: Mode) => void
  onChatModelChange: (model: ChatModel) => void
  onImageModelChange: (model: ImageModel) => void
  onVoiceStart?: () => void
  onVoiceStop?: () => Promise<TranscribeResult | void>
  onVoiceCancel?: () => void
  onVoiceTranscript?: (text: string) => void
  interimText?: string
  finalText?: string
  ragDoc?: RagDocument | null
  onClearRagDoc?: () => void
}

const MODE_CONFIG: Record<Mode, { icon: React.ReactNode; label: string; placeholder: string; color: string; bg: string }> = {
  chat: { icon: <MessageSquare size={12} />, label: 'Chat', placeholder: 'Ask me anything…', color: 'text-indigo-600', bg: 'bg-indigo-50' },
  search: { icon: <Globe size={12} />, label: 'Web Search', placeholder: 'Search the web…', color: 'text-emerald-600', bg: 'bg-emerald-50' },
  image: { icon: <Image size={12} />, label: 'Image Gen', placeholder: 'Describe an image to create…', color: 'text-pink-600', bg: 'bg-pink-50' },
  analyze: { icon: <FileSearch size={12} />, label: 'Analyze', placeholder: 'Attach a file and ask anything…', color: 'text-amber-600', bg: 'bg-amber-50' },
}

export function InputBar({
  mode, chatModel, imageModel,
  isLoading, isRecording, isProcessing,
  onSend, onStop, onModeChange, onChatModelChange, onImageModelChange,
  onVoiceStart, onVoiceStop, onVoiceCancel,
  interimText = '', finalText = '',
  ragDoc, onClearRagDoc,
}: InputBarProps) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [showModelMenu, setShowModelMenu] = useState(false)
  const [showModeMenu, setShowModeMenu] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Voice recording timer
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isRecording) {
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds(s => s + 1)
      }, 1000)
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [isRecording])

  // Advanced image generation options (local state)
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [negativePrompt, setNegativePrompt] = useState('')
  const [selectedStyle, setSelectedStyle] = useState('')
  const [aspectRatio, setAspectRatio] = useState('1:1')

  const isImageMode = mode === 'image'
  const currentMode = MODE_CONFIG[mode]

  const activeModel = isImageMode
    ? IMAGE_MODELS.find(m => m.value === imageModel)
    : CHAT_MODELS.find(m => m.value === chatModel)

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if ((!trimmed && !file) || isLoading) return
    const finalText = isImageMode && (negativePrompt.trim() || selectedStyle || aspectRatio !== '1:1')
      ? buildEnhancedPrompt(trimmed, negativePrompt, selectedStyle, aspectRatio)
      : trimmed
    onSend(finalText, file ?? undefined)
    setText('')
    setFile(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, file, isLoading, onSend, isImageMode, negativePrompt, selectedStyle, aspectRatio])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 180) + 'px'
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) setFile(f)
  }

  const handleVoiceClick = async () => {
    if (isRecording) {
      try {
        const result = await onVoiceStop?.()
        if (result && typeof result === 'object' && 'text' in result) {
          const insertText = result.text?.trim() ?? ''
          if (insertText) {
            setText(prev => prev ? `${prev} ${insertText}` : insertText)
            setTimeout(() => {
              if (textareaRef.current) {
                textareaRef.current.style.height = 'auto'
                textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 180) + 'px'
                textareaRef.current.focus()
              }
            }, 50)
          }
        }
      } catch {
      }
    } else {
      onVoiceStart?.()
    }
  }

  const formatRecordingTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  const canSend = !!(text.trim() || file)

  return (
    <div className="relative">
      {/* File preview + RAG doc status */}
      <AnimatePresence>
        {file && (
          <motion.div
            key="file-preview"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className="mb-2 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-200 text-[11px]"
          >
            <Paperclip size={12} className="text-gray-400 shrink-0" />
            <span className="truncate flex-1 text-gray-700 text-[11px]">{file.name}</span>
            <span className="text-gray-400 shrink-0">{(file.size / 1024).toFixed(0)}KB</span>
            <button
              onClick={() => setFile(null)}
              className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={12} />
            </button>
          </motion.div>
        )}

        {/* RAG doc status pill — shown when a doc is loaded in analyze mode */}
        {mode === 'analyze' && ragDoc && (
          <motion.div
            key="rag-doc-status"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            className={cn(
              'mb-2 flex items-center gap-2 px-3 py-2 rounded-xl border text-[11px]',
              ragDoc.status === 'ready'
                ? 'bg-emerald-50 border-emerald-200'
                : ragDoc.status === 'error'
                  ? 'bg-red-50 border-red-200'
                  : 'bg-amber-50 border-amber-200'
            )}
          >
            {/* Icon */}
            {ragDoc.status === 'ready' ? (
              <CheckCircle2 size={12} className="text-emerald-500 shrink-0" />
            ) : ragDoc.status === 'error' ? (
              <AlertCircle size={12} className="text-red-500 shrink-0" />
            ) : (
              <Loader2 size={12} className="text-amber-500 shrink-0 animate-spin" />
            )}

            {/* Label */}
            <FileText size={11} className={cn(
              'shrink-0',
              ragDoc.status === 'ready' ? 'text-emerald-600'
                : ragDoc.status === 'error' ? 'text-red-500'
                  : 'text-amber-600'
            )} />
            <span className={cn(
              'truncate flex-1 text-[11px] font-medium',
              ragDoc.status === 'ready' ? 'text-emerald-700'
                : ragDoc.status === 'error' ? 'text-red-600'
                  : 'text-amber-700'
            )}>
              {ragDoc.status === 'ready'
                ? ragDoc.filename
                : ragDoc.progressMessage ?? ragDoc.filename}
            </span>

            {/* Chunk count badge for ready docs */}
            {ragDoc.status === 'ready' && ragDoc.chunkCount && (
              <span className="text-[10px] text-emerald-500 shrink-0">
                {ragDoc.chunkCount} chunks
              </span>
            )}

            {/* Clear button — only when ready or error */}
            {(ragDoc.status === 'ready' || ragDoc.status === 'error') && onClearRagDoc && (
              <button
                onClick={onClearRagDoc}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
                title="Clear document"
              >
                <X size={12} />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input card */}
      <div
        className="relative rounded-2xl transition-all duration-200"
        style={{
          background: '#ffffff',
          border: '1px solid rgba(0,0,0,0.09)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.07)',
        }}
        onFocus={() => {
          const el = document.activeElement?.closest('.relative') as HTMLElement
          if (el) el.style.boxShadow = '0 2px 16px rgba(79,70,229,0.12)'
        }}
      >
        {/* Live real-time transcript preview */}
        <AnimatePresence>
          {isRecording && (finalText || interimText) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              <div className="px-4 pt-3 pb-1 flex items-start gap-2">
                {/* Pulsing mic dot */}
                <motion.div
                  className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0 mt-1.5"
                  animate={{ opacity: [1, 0.3, 1] }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <p className="text-[13px] leading-relaxed text-gray-700 flex-1 min-w-0">
                  {/* Committed final text */}
                  {finalText && (
                    <span>{finalText}</span>
                  )}
                  {/* Interim (partial) text — grey and italic */}
                  {interimText && (
                    <span className="text-gray-400 italic">{interimText}</span>
                  )}
                </p>
              </div>
              <div className="mx-4 mb-1 h-px bg-gray-100" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextareaChange}
          onKeyDown={handleKeyDown}
          placeholder={currentMode.placeholder}
          rows={1}
          disabled={isLoading && !onStop}
          className="w-full px-4 pt-4 pb-2 text-sm bg-transparent resize-none focus:outline-none text-gray-800 leading-relaxed min-h-[52px]"
          style={{
            maxHeight: '180px',
            fontSize: '14px',
            color: '#111827',
          }}
        />
        <style>{`textarea::placeholder { color: rgba(0,0,0,0.35); font-size: 14px; }`}</style>

        {/* Advanced image options panel */}
        <AnimatePresence>
          {isImageMode && showAdvanced && (
            <motion.div
              key="advanced-panel"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden"
            >
              <div className="px-4 py-3 border-t border-gray-100 space-y-3">

                {/* Negative prompt */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Negative Prompt
                  </label>
                  <textarea
                    value={negativePrompt}
                    onChange={e => setNegativePrompt(e.target.value)}
                    placeholder="Things to avoid: blurry, distorted, watermark..."
                    rows={1}
                    className="w-full px-3 py-2 text-[12px] rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-pink-200 focus:border-pink-300 resize-none text-gray-700 placeholder:text-gray-300 transition-all"
                    style={{ maxHeight: '72px' }}
                    onInput={e => {
                      const el = e.currentTarget
                      el.style.height = 'auto'
                      el.style.height = Math.min(el.scrollHeight, 72) + 'px'
                    }}
                  />
                </div>

                {/* Style selection */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Style
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {IMAGE_STYLES.map(style => (
                      <button
                        key={style}
                        onClick={() => setSelectedStyle(prev => prev === style ? '' : style)}
                        className={cn(
                          'px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all duration-150 active:scale-95',
                          selectedStyle === style
                            ? 'bg-pink-500 text-white border-pink-500 shadow-sm shadow-pink-200'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50'
                        )}
                      >
                        {style}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Aspect ratio */}
                <div>
                  <label className="block text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">
                    Aspect Ratio
                  </label>
                  <div className="flex gap-1.5">
                    {ASPECT_RATIOS.map(ratio => (
                      <button
                        key={ratio}
                        onClick={() => setAspectRatio(ratio)}
                        className={cn(
                          'px-3 py-1 rounded-lg text-[11px] font-semibold border transition-all duration-150 active:scale-95',
                          aspectRatio === ratio
                            ? 'bg-pink-500 text-white border-pink-500 shadow-sm shadow-pink-200'
                            : 'bg-white text-gray-500 border-gray-200 hover:border-pink-300 hover:text-pink-600 hover:bg-pink-50'
                        )}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom toolbar */}
        <div className="flex items-center justify-between flex-wrap px-3 pb-3 pt-1 gap-2">

          {/* Left tools */}
          <div className="flex items-center gap-1.5 flex-wrap gap-y-1.5">
            {/* Attach file button */}
            {(mode === 'analyze' || mode === 'chat') && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/*,.pdf,.txt,.md,.csv,.json,.docx"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-7 h-7 rounded-full flex items-center justify-center transition-all duration-150 touch-manipulation"
                  style={{ background: 'rgba(0,0,0,0.05)', color: 'rgba(0,0,0,0.45)' }}
                  title="Attach file"
                  onMouseEnter={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.09)'}
                  onMouseLeave={e => (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.05)'}
                >
                  <Plus size={13} />
                </button>
              </>
            )}

            {/* Mode picker */}
            <div className="relative">
              <button
                onClick={() => { setShowModeMenu(v => !v); setShowModelMenu(false) }}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150',
                  currentMode.bg, currentMode.color
                )}
              >
                {currentMode.icon}
                <span className="hidden sm:inline">{currentMode.label}</span>
                <ChevronDown size={9} className="opacity-60" />
              </button>
              <AnimatePresence>
                {showModeMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowModeMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 mb-2 w-44 bg-white border border-gray-100 rounded-2xl shadow-lg z-20 overflow-hidden py-1"
                    >
                      {Object.entries(MODE_CONFIG).map(([key, cfg]) => (
                        <button
                          key={key}
                          onClick={() => { onModeChange(key as Mode); setShowModeMenu(false) }}
                          className={cn(
                            'w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs transition-colors text-left',
                            mode === key ? `${cfg.bg} ${cfg.color} font-semibold` : 'hover:bg-gray-50 text-gray-600'
                          )}
                        >
                          <span className={mode === key ? cfg.color : 'text-gray-400'}>{cfg.icon}</span>
                          {cfg.label}
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Model picker */}
            <div className="relative">
              <button
                onClick={() => { setShowModelMenu(v => !v); setShowModeMenu(false) }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-medium bg-gray-100 text-gray-600 hover:bg-gray-150 transition-colors"
                style={{ background: 'rgba(0,0,0,0.05)' }}
              >
                <Zap size={10} className="text-indigo-500" />
                <span className="max-w-[60px] sm:max-w-[90px] truncate">{activeModel?.label ?? 'Model'}</span>
                <ChevronDown size={9} className="opacity-50" />
              </button>
              <AnimatePresence>
                {showModelMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowModelMenu(false)} />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full left-0 mb-2 w-60 bg-white border border-gray-100 rounded-2xl shadow-lg z-20 overflow-hidden"
                    >
                      <div className="px-3.5 pt-3 pb-1.5">
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                          {isImageMode ? 'Image Models' : 'Chat Models'}
                        </p>
                      </div>
                      <div className="px-2 pb-2 max-h-60 overflow-y-auto space-y-0.5">
                        {(isImageMode ? IMAGE_MODELS : CHAT_MODELS).map((m) => {
                          const isActive = isImageMode ? imageModel === m.value : chatModel === m.value
                          return (
                            <button
                              key={m.value}
                              onClick={() => {
                                if (isImageMode) onImageModelChange(m.value as ImageModel)
                                else onChatModelChange(m.value as ChatModel)
                                setShowModelMenu(false)
                              }}
                              className={cn(
                                'w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl transition-colors text-left',
                                isActive ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-gray-50 text-gray-600'
                              )}
                            >
                              <div className="flex-1 min-w-0">
                                <div className="text-xs font-medium truncate">{m.label}</div>
                                <div className="text-[10px] text-gray-400">{m.desc}</div>
                              </div>
                              <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-md shrink-0', PROVIDER_COLORS[m.provider])}>
                                {m.badge}
                              </span>
                              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                            </button>
                          )
                        })}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Advanced options toggle — image mode only */}
            {isImageMode && (
              <button
                onClick={() => setShowAdvanced(v => !v)}
                title="Advanced image options"
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150',
                  showAdvanced
                    ? 'bg-pink-100 text-pink-600'
                    : 'text-gray-400 hover:text-pink-500',
                )}
                style={{ background: showAdvanced ? undefined : 'rgba(0,0,0,0.05)' }}
              >
                <Settings2 size={11} />
                <span className="hidden sm:inline">Advanced</span>
                {showAdvanced
                  ? <ChevronUp size={9} className="opacity-60" />
                  : <ChevronDown size={9} className="opacity-60" />
                }
              </button>
            )}
          </div>

          {/* Right side: mic + send */}
          <div className="flex items-center gap-1.5 shrink-0">
            {/* Mic button — always visible, right side */}
            {onVoiceStart && (
              <div className="relative">
                {isRecording && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{ background: 'rgba(239,68,68,0.15)' }}
                      animate={{ scale: [1, 1.6, 1], opacity: [0.8, 0, 0.8] }}
                      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full pointer-events-none"
                      style={{ background: 'rgba(239,68,68,0.1)' }}
                      animate={{ scale: [1, 2.2, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
                    />
                  </>
                )}
                <button
                  onClick={handleVoiceClick}
                  disabled={isProcessing}
                  className={cn(
                    'relative w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 touch-manipulation z-10',
                    isRecording
                      ? 'text-red-500 shadow-sm shadow-red-200'
                      : 'text-gray-400 hover:text-indigo-500',
                    isProcessing && 'opacity-60 cursor-not-allowed'
                  )}
                  style={{ background: isRecording ? 'rgba(254,202,202,1)' : 'rgba(0,0,0,0.05)' }}
                  title={isRecording ? 'Stop & transcribe' : 'Voice input'}
                >
                  {isProcessing
                    ? <Loader2 size={14} className="animate-spin" />
                    : isRecording
                      ? <Square size={12} fill="currentColor" />
                      : <Mic size={14} />
                  }
                </button>
              </div>
            )}

            {/* Recording status inline — hidden on xs to avoid overflow */}
            {isRecording && (
              <div className="hidden sm:flex items-center gap-1 overflow-hidden">
                <div className="flex items-center gap-0.5">
                  {[...Array(5)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 h-3 bg-red-400 rounded-full"
                      animate={{ height: [2, 6, 2] }}
                      transition={{ duration: 0.6, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
                    />
                  ))}
                </div>
                <span className="text-[11px] font-mono font-semibold text-red-500 tabular-nums whitespace-nowrap">
                  {formatRecordingTime(recordingSeconds)}
                </span>
                {onVoiceCancel && (
                  <button
                    onClick={onVoiceCancel}
                    className="w-5 h-5 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                    style={{ background: 'rgba(0,0,0,0.05)' }}
                    title="Cancel recording"
                  >
                    <X size={10} />
                  </button>
                )}
              </div>
            )}
            {isProcessing && (
              <div className="hidden sm:flex items-center gap-1">
                <Loader2 size={11} className="animate-spin text-indigo-500" />
                <span className="text-[11px] text-indigo-500 font-medium whitespace-nowrap">
                  Transcribing…
                </span>
              </div>
            )}

            {/* Send / Stop button */}
            <button
              onClick={isLoading && onStop ? onStop : handleSend}
              disabled={isLoading && !onStop ? true : !isLoading && !canSend}
              className={cn(
                'w-9 h-9 rounded-full flex items-center justify-center transition-all duration-200 shrink-0 touch-manipulation',
                (isLoading && onStop) || canSend
                  ? 'text-white scale-100 hover:scale-105 active:scale-95'
                  : 'bg-gray-100 text-gray-300 cursor-not-allowed'
              )}
              style={
                (isLoading && onStop) || canSend
                  ? { background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', boxShadow: '0 2px 8px rgba(79,70,229,0.35)' }
                  : undefined
              }
            >
              {isLoading ? (
                onStop ? <Square size={13} fill="currentColor" /> : <Loader2 size={15} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}