import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Sparkles, Image, FileSearch, MessageSquare } from 'lucide-react'
import type { Message, Mode, ChatModel, ImageModel } from '../types'
import type { RagDocument } from '../hooks/useDocumentRAG'
import { MessageBubble } from '../components/chat/MessageBubble'
import { TypingIndicator } from '../components/chat/TypingIndicator'
import { InputBar } from '../components/chat/InputBar'
import { useVoice } from '../hooks/useVoice'

interface ChatPageProps {
  conversationId: string
  messages: Message[]
  mode: Mode
  chatModel: ChatModel
  imageModel: ImageModel
  isStreaming: boolean
  isGeneratingImage?: boolean
  streamingContent: string
  onSend: (text: string, file?: File) => void
  onStop?: () => void
  onModeChange: (mode: Mode) => void
  onChatModelChange: (model: ChatModel) => void
  onImageModelChange: (model: ImageModel) => void
  onRegenerate: () => void
  onApplyEdit?: (url: string) => void
  ragDoc?: RagDocument | null
  onClearRagDoc?: () => void
}

const MODE_META: Record<Mode, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  chat: { label: 'AI Chat', icon: <MessageSquare size={12} />, color: 'text-indigo-600', bg: 'bg-indigo-50 border-indigo-200' },
  search: { label: 'Web Search', icon: <Globe size={12} />, color: 'text-emerald-600', bg: 'bg-emerald-50 border-emerald-200' },
  image: { label: 'Image Generator', icon: <Image size={12} />, color: 'text-pink-600', bg: 'bg-pink-50 border-pink-200' },
  analyze: { label: 'File Analyzer', icon: <FileSearch size={12} />, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
}

const GENERATION_STEPS = [
  'Initializing AI engine...',
  'Analyzing your prompt...',
  'Planning visual composition...',
  'Drafting base structure...',
  'Adding artistic details...',
  'Refining textures and lighting...',
  'Polishing final pixels...',
  'Almost ready...'
]

export function ChatPage({
  conversationId, messages, mode,
  chatModel, imageModel,
  isStreaming, isGeneratingImage, streamingContent,
  onSend, onStop, onModeChange, onChatModelChange, onImageModelChange, onRegenerate,
  onApplyEdit, ragDoc, onClearRagDoc,
}: ChatPageProps) {
  const bottomRef = useRef<HTMLDivElement>(null)
  const meta = MODE_META[mode]
  const [generationStep, setGenerationStep] = useState(0)

  const {
    sttStatus,
    startRecording,
    stopRecording,
    cancelRecording,
    isRecording,
    isProcessing,
    interimText,
    finalText,
    ttsStatus,
    speakingMessageId,
    speak,
    stopSpeaking,
  } = useVoice()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, isGeneratingImage])

  useEffect(() => {
    let interval: any
    if (isGeneratingImage) {
      setGenerationStep(0)
      interval = setInterval(() => {
        setGenerationStep(prev => (prev + 1) % GENERATION_STEPS.length)
      }, 1500)
    }
    return () => clearInterval(interval)
  }, [isGeneratingImage])

  const handleVoiceStop = async () => {
    try {
      const result = await stopRecording()
      return result
    } catch { /* handled in hook */ }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Mode badge */}
      <div className="px-3 py-2 border-b border-border shrink-0" style={{ background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(10px)' }}>
        <div className="flex items-center gap-2 max-w-3xl mx-auto">
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${meta.bg} ${meta.color}`}>
            {meta.icon}
            {meta.label}
          </div>
          {mode === 'search' && (
            <span className="text-[11px] text-gray-400">· Live web results included</span>
          )}
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Date separator at top */}
          {messages.length > 0 && (
            <div className="flex items-center gap-3 my-2">
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">
                {new Date(messages[0].createdAt).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
              </span>
              <div className="flex-1 h-px bg-gray-100" />
            </div>
          )}
          {messages.map((msg, idx) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onRegenerate={idx === messages.length - 1 && msg.role === 'assistant' ? onRegenerate : undefined}
              speakingMessageId={speakingMessageId}
              ttsStatus={ttsStatus}
              onSpeak={speak}
              onStopSpeaking={stopSpeaking}
              onApplyEdit={onApplyEdit}
            />
          ))}

          {/* Streaming message */}
          <AnimatePresence>
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  id: 'streaming',
                  conversationId,
                  userId: '',
                  role: 'assistant',
                  content: streamingContent,
                  createdAt: new Date().toISOString(),
                }}
                isStreaming
              />
            )}
            {isStreaming && !streamingContent && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0">
                  <Sparkles size={14} className="text-primary" />
                </div>
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm shadow-sm px-4 py-3">
                  <TypingIndicator />
                </div>
              </motion.div>
            )}
            {isGeneratingImage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex gap-3"
              >
                <div className="w-8 h-8 rounded-full bg-pink-500/15 border border-pink-500/20 flex items-center justify-center shrink-0">
                  <Image size={14} className="text-pink-500" />
                </div>
                <div className="flex flex-col gap-3 max-w-[90%] sm:max-w-[82%] w-full">
                  <div className="bg-card border border-border rounded-2xl rounded-tl-sm shadow-sm px-4 py-3 flex items-center gap-3">
                    <div className="flex flex-col gap-1">
                      <motion.span
                        key={generationStep}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-sm font-medium"
                      >
                        {GENERATION_STEPS[generationStep]}
                      </motion.span>
                      <span className="text-xs text-muted-foreground animate-pulse">This usually takes 5-10 seconds</span>
                    </div>
                  </div>

                  {/* Image skeleton placeholder */}
                  <div className="w-full aspect-square max-w-[85vw] sm:max-w-sm bg-muted rounded-2xl overflow-hidden relative border border-border">
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/60 to-transparent -translate-x-full animate-[shimmer_2s_infinite]" />
                    <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground/40">
                      <div className="relative">
                        <Image size={48} strokeWidth={1} />
                        <motion.div
                          className="absolute -top-1 -right-1"
                          animate={{ rotate: 360 }}
                          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                        >
                          <Sparkles size={16} className="text-pink-400/60" />
                        </motion.div>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Input bar */}
      <div
        className="px-2 sm:px-4 pt-2 shrink-0 bg-background/80 backdrop-blur-sm border-t border-border"
        style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
      >
        <div className="max-w-3xl mx-auto">
          <InputBar
            mode={mode}
            chatModel={chatModel}
            imageModel={imageModel}
            isLoading={isStreaming || !!isGeneratingImage}
            isRecording={isRecording}
            isProcessing={isProcessing}
            interimText={interimText}
            finalText={finalText}
            onSend={onSend}
            onStop={onStop}
            onModeChange={onModeChange}
            onChatModelChange={onChatModelChange}
            onImageModelChange={onImageModelChange}
            onVoiceStart={startRecording}
            onVoiceStop={handleVoiceStop}
            onVoiceCancel={cancelRecording}
            ragDoc={ragDoc}
            onClearRagDoc={onClearRagDoc}
          />
        </div>
      </div>

      {/* STT error toast */}
      <AnimatePresence>
        {sttStatus === 'error' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 bg-destructive text-destructive-foreground text-xs rounded-full shadow-lg z-50"
          >
            Microphone access denied or transcription failed
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
