import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Copy, Check, RefreshCw, Globe, ExternalLink, Sparkles,
  ZoomIn, Download, Wand2, Volume2, VolumeX, Loader2, User, FileText
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { Message, RagSource } from '../../types'
import { cn } from '../../lib/utils'
import { ImageLightbox } from '../ui/ImageLightbox'
import { ImageEditor } from '../ui/ImageEditor'

interface MessageBubbleProps {
  message: Message
  isStreaming?: boolean
  onRegenerate?: () => void
  speakingMessageId?: string | null
  ttsStatus?: 'idle' | 'loading' | 'playing' | 'error'
  onSpeak?: (text: string, messageId: string) => void
  onStopSpeaking?: () => void
  onApplyEdit?: (url: string) => void
}

function SourceCard({ url, title }: { url: string; title: string }) {
  const domain = (() => { try { return new URL(url).hostname.replace('www.', '') } catch { return url } })()
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 bg-muted/60 border border-border rounded-lg hover:border-primary/40 hover:bg-primary/5 transition-all text-xs group"
    >
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=32`}
        className="w-3.5 h-3.5 rounded-sm shrink-0"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
        alt=""
      />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-foreground truncate">{title || domain}</div>
        <div className="text-muted-foreground truncate text-[10px]">{domain}</div>
      </div>
      <ExternalLink size={11} className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
    </a>
  )
}

function RagSourceCard({ source }: { source: RagSource }) {
  const scorePercent = Math.round(source.score * 100)
  const excerpt = source.excerpt.length > 120
    ? source.excerpt.slice(0, 120) + '…'
    : source.excerpt

  return (
    <div className="flex items-start gap-2 px-3 py-2 bg-amber-50/60 border border-amber-200/70 rounded-lg text-xs">
      <FileText size={12} className="text-amber-500 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-amber-800 truncate">{source.filename}</div>
        <div className="text-amber-700/70 text-[10px] mt-0.5 leading-relaxed">{excerpt}</div>
      </div>
      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-600 shrink-0 whitespace-nowrap">
        {scorePercent}% match
      </span>
    </div>
  )
}

export function MessageBubble({
  message, isStreaming, onRegenerate,
  speakingMessageId, ttsStatus, onSpeak, onStopSpeaking,
  onApplyEdit,
}: MessageBubbleProps) {
  const [copied, setCopied] = useState(false)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [editorOpen, setEditorOpen] = useState(false)

  const isUser = message.role === 'user'
  const isThisSpeaking = speakingMessageId === message.id
  const isTtsLoading = isThisSpeaking && ttsStatus === 'loading'

  const handleDownload = async (url: string) => {
    try {
      const response = await fetch(url)
      const blob = await response.blob()
      const ext = url.split('.').pop()?.split('?')[0] || 'png'
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `ai-image-${Date.now()}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    } catch {
      window.open(url, '_blank')
    }
  }

  const copy = async () => {
    await navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleSpeakClick = () => {
    if (isThisSpeaking) onStopSpeaking?.()
    else onSpeak?.(message.content, message.id)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex gap-3', isUser ? 'justify-end' : 'justify-start')}
    >
      {/* AI avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
          <Sparkles size={14} className="text-primary" />
        </div>
      )}

      <div className={cn('max-w-[88%] sm:max-w-[82%] min-w-0 flex flex-col gap-2', isUser ? 'items-end' : 'items-start')}>

        {/* Web search sources */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
              <Globe size={11} className="text-primary" />
              <span>Sources from the web</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
              {message.sources.slice(0, 4).map((src, i) => (
                <SourceCard key={i} url={src.url} title={src.title} />
              ))}
            </div>
          </div>
        )}

        {/* RAG document sources */}
        {!isUser && message.ragSources && message.ragSources.length > 0 && (
          <div className="w-full">
            <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground">
              <FileText size={11} className="text-amber-500" />
              <span>Sources from document</span>
            </div>
            <div className="space-y-1.5">
              {message.ragSources.slice(0, 3).map((src, i) => (
                <RagSourceCard key={i} source={src} />
              ))}
            </div>
          </div>
        )}

        {/* Image */}
        {message.imageUrl && (
          <div className="flex flex-col gap-2">
            <div
              className="relative group rounded-2xl overflow-hidden border border-border shadow-md cursor-pointer"
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={message.imageUrl}
                alt="Generated"
                className="max-w-full w-auto max-h-60 sm:max-h-80 object-contain transition-transform duration-300 group-hover:scale-[1.01]"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-200 flex items-center justify-center">
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl text-sm font-medium shadow-lg">
                    <ZoomIn size={14} />
                    View full size
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setEditorOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 border border-primary/30 transition-all"
              >
                <Wand2 size={12} /> Edit Image
              </button>
              <button
                onClick={() => handleDownload(message.imageUrl!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted border border-border transition-all"
              >
                <Download size={12} /> Download
              </button>
            </div>
          </div>
        )}

        {/* File attachment */}
        {message.fileUrl && message.fileName && (
          <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-xl border border-border text-xs text-muted-foreground">
            <span className="font-medium truncate max-w-48">{message.fileName}</span>
          </div>
        )}

        {/* Text content */}
        {message.content && (
          <div
            className={cn(
              'rounded-2xl px-4 py-3 text-sm',
              isUser
                ? 'bg-primary text-primary-foreground rounded-tr-sm shadow-sm'
                : 'bg-card border border-border text-foreground rounded-tl-sm shadow-sm'
            )}
          >
            {isUser ? (
              <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
            ) : (
              <div className="ai-prose">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code({ className, children, ...props }) {
                      const isBlock = className?.includes('language-')
                      if (isBlock) {
                        return (
                          <div className="relative my-3">
                            <pre className="bg-[hsl(220,15%,10%)] text-[hsl(210,12%,88%)] rounded-xl p-4 overflow-x-auto text-[11px] sm:text-xs font-mono">
                              <code className={className} {...props}>{children}</code>
                            </pre>
                          </div>
                        )
                      }
                      return (
                        <code className="bg-muted text-primary px-1.5 py-0.5 rounded text-[0.82em] font-mono" {...props}>
                          {children}
                        </code>
                      )
                    },
                  }}
                >
                  {message.content}
                </ReactMarkdown>
                {isStreaming && (
                  <motion.span
                    className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle streaming-cursor"
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.65, repeat: Infinity }}
                  />
                )}
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        {!isUser && !isStreaming && message.content && (
          <div className="flex items-center gap-0.5 flex-wrap gap-y-1">
            <button
              onClick={copy}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              {copied ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
              {copied ? 'Copied' : 'Copy'}
            </button>

            {onSpeak && (
              <button
                onClick={handleSpeakClick}
                disabled={isTtsLoading}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-lg text-xs transition-colors',
                  isThisSpeaking
                    ? 'text-primary hover:bg-primary/10'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                  isTtsLoading && 'opacity-60 cursor-not-allowed'
                )}
              >
                {isTtsLoading ? <Loader2 size={11} className="animate-spin" /> :
                  isThisSpeaking ? <VolumeX size={11} /> : <Volume2 size={11} />}
                {isTtsLoading ? 'Loading…' : isThisSpeaking ? 'Stop' : 'Speak'}
              </button>
            )}

            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <RefreshCw size={11} />
                Regenerate
              </button>
            )}
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-muted border border-border flex items-center justify-center shrink-0 mt-0.5">
          <User size={14} className="text-muted-foreground" />
        </div>
      )}

      {/* Lightbox & Editor */}
      <AnimatePresence>
        {lightboxOpen && message.imageUrl && (
          <ImageLightbox url={message.imageUrl} onClose={() => setLightboxOpen(false)} />
        )}
        {editorOpen && message.imageUrl && (
          <ImageEditor
            url={message.imageUrl}
            onClose={() => setEditorOpen(false)}
            onApplyResult={(newUrl) => {
              onApplyEdit?.(newUrl)
              setEditorOpen(false)
            }}
          />
        )}
      </AnimatePresence>
    </motion.div>
  )
}
