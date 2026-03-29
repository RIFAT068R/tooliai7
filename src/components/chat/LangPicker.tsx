import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Languages, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../../lib/utils'

export const LANGUAGES = [
  { code: 'auto', label: 'Auto (no translation)', flag: '🌐' },
  { code: 'English', label: 'English', flag: '🇺🇸' },
  { code: 'Spanish', label: 'Spanish', flag: '🇪🇸' },
  { code: 'French', label: 'French', flag: '🇫🇷' },
  { code: 'German', label: 'German', flag: '🇩🇪' },
  { code: 'Italian', label: 'Italian', flag: '🇮🇹' },
  { code: 'Portuguese', label: 'Portuguese', flag: '🇧🇷' },
  { code: 'Dutch', label: 'Dutch', flag: '🇳🇱' },
  { code: 'Russian', label: 'Russian', flag: '🇷🇺' },
  { code: 'Chinese (Simplified)', label: 'Chinese (Simplified)', flag: '🇨🇳' },
  { code: 'Chinese (Traditional)', label: 'Chinese (Traditional)', flag: '🇹🇼' },
  { code: 'Japanese', label: 'Japanese', flag: '🇯🇵' },
  { code: 'Korean', label: 'Korean', flag: '🇰🇷' },
  { code: 'Arabic', label: 'Arabic', flag: '🇸🇦' },
  { code: 'Hindi', label: 'Hindi', flag: '🇮🇳' },
  { code: 'Turkish', label: 'Turkish', flag: '🇹🇷' },
  { code: 'Polish', label: 'Polish', flag: '🇵🇱' },
  { code: 'Swedish', label: 'Swedish', flag: '🇸🇪' },
  { code: 'Norwegian', label: 'Norwegian', flag: '🇳🇴' },
  { code: 'Danish', label: 'Danish', flag: '🇩🇰' },
  { code: 'Finnish', label: 'Finnish', flag: '🇫🇮' },
  { code: 'Greek', label: 'Greek', flag: '🇬🇷' },
  { code: 'Hebrew', label: 'Hebrew', flag: '🇮🇱' },
  { code: 'Thai', label: 'Thai', flag: '🇹🇭' },
  { code: 'Vietnamese', label: 'Vietnamese', flag: '🇻🇳' },
  { code: 'Indonesian', label: 'Indonesian', flag: '🇮🇩' },
  { code: 'Malay', label: 'Malay', flag: '🇲🇾' },
  { code: 'Ukrainian', label: 'Ukrainian', flag: '🇺🇦' },
  { code: 'Czech', label: 'Czech', flag: '🇨🇿' },
  { code: 'Romanian', label: 'Romanian', flag: '🇷🇴' },
]

interface LangPickerProps {
  value: string
  onChange: (lang: string) => void
  disabled?: boolean
}

export function LangPicker({ value, onChange, disabled }: LangPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const active = LANGUAGES.find(l => l.code === value) ?? LANGUAGES[0]
  const isTranslating = value !== 'auto'

  const filtered = search.trim()
    ? LANGUAGES.filter(l => l.label.toLowerCase().includes(search.toLowerCase()))
    : LANGUAGES

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Focus search when opened
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50)
    else setSearch('')
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => !disabled && setOpen(v => !v)}
        disabled={disabled}
        title={isTranslating ? `Translate to ${active.label}` : 'Voice translation'}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-semibold transition-all duration-150 touch-manipulation',
          isTranslating
            ? 'bg-violet-100 text-violet-700 hover:bg-violet-150'
            : 'text-gray-400 hover:text-violet-600',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
        style={{ background: isTranslating ? undefined : 'rgba(0,0,0,0.05)' }}
      >
        {isTranslating ? (
          <>
            <span className="text-[13px] leading-none">{active.flag}</span>
            <span className="hidden sm:inline max-w-[60px] truncate">{active.label}</span>
            <ChevronDown size={9} className="opacity-60" />
          </>
        ) : (
          <>
            <Languages size={12} />
            <span className="hidden sm:inline">Translate</span>
            <ChevronDown size={9} className="opacity-60" />
          </>
        )}
      </button>

      {/* Clear badge when active */}
      {isTranslating && !open && (
        <button
          onClick={e => { e.stopPropagation(); onChange('auto') }}
          className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-violet-500 text-white flex items-center justify-center hover:bg-violet-600 transition-colors"
          title="Remove translation"
        >
          <X size={7} />
        </button>
      )}

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -4 }}
              transition={{ duration: 0.12 }}
              className="absolute bottom-full left-0 mb-2 w-56 bg-white border border-gray-100 rounded-2xl shadow-lg z-20 overflow-hidden"
            >
              {/* Header */}
              <div className="px-3 pt-3 pb-2 border-b border-gray-50">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">
                  Translate speech to
                </p>
                <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-gray-50">
                  <Languages size={11} className="text-gray-400 shrink-0" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Search language…"
                    className="flex-1 text-[11px] bg-transparent outline-none text-gray-700 placeholder-gray-400"
                  />
                </div>
              </div>

              {/* Language list */}
              <div className="max-h-56 overflow-y-auto py-1">
                {filtered.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => { onChange(lang.code); setOpen(false) }}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-xs transition-colors text-left',
                      value === lang.code
                        ? 'bg-violet-50 text-violet-700 font-semibold'
                        : 'hover:bg-gray-50 text-gray-600'
                    )}
                  >
                    <span className="text-[14px] w-5 text-center shrink-0">{lang.flag}</span>
                    <span className="flex-1 truncate">{lang.label}</span>
                    {value === lang.code && (
                      <div className="w-1.5 h-1.5 rounded-full bg-violet-500 shrink-0" />
                    )}
                  </button>
                ))}
                {filtered.length === 0 && (
                  <p className="text-[11px] text-gray-400 text-center py-4">No languages found</p>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
