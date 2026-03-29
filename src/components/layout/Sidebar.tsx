import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare, Image, FileSearch, Plus, Trash2,
  Globe, LogOut, LogIn, Crown, Zap, Sparkles, Bot
} from 'lucide-react'
import type { Conversation, Mode, PlanTier } from '../../types'
import { cn } from '../../lib/utils'

interface SidebarProps {
  conversations: Conversation[]
  activeConvId: string | null
  activeMode: Mode
  user: { id: string; email: string; displayName?: string } | null
  planTier: PlanTier
  onNewChat: () => void
  onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void
  onSelectMode: (mode: Mode) => void
  onLogin: () => void
  onLogout: () => void
  onUpgrade: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

const PLAN_BADGE: Record<PlanTier, { label: string; icon: React.ReactNode; cls: string }> = {
  free: { label: 'Free', icon: <Zap size={10} />, cls: 'bg-gray-100 text-gray-500' },
  pro: { label: 'Pro', icon: <Crown size={10} />, cls: 'bg-indigo-50 text-indigo-600' },
  max: { label: 'Max', icon: <Crown size={10} />, cls: 'bg-amber-50 text-amber-600' },
}

function groupConversations(conversations: Conversation[]) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const weekAgo = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000)

  const today: Conversation[] = []
  const pastWeek: Conversation[] = []
  const older: Conversation[] = []

  for (const c of conversations) {
    const d = new Date(c.createdAt || '')
    if (d >= todayStart) today.push(c)
    else if (d >= weekAgo) pastWeek.push(c)
    else older.push(c)
  }
  return { today, pastWeek, older }
}

export function Sidebar({
  conversations, activeConvId, user, planTier,
  onNewChat, onSelectConv, onDeleteConv,
  onLogin, onLogout, onUpgrade, collapsed,
}: SidebarProps) {
  const [hoveredConvId, setHoveredConvId] = useState<string | null>(null)
  const plan = PLAN_BADGE[planTier]
  const userInitial = (user?.displayName || user?.email || 'U')[0].toUpperCase()
  const { today, pastWeek, older } = groupConversations(conversations)

  if (collapsed) {
    return (
      <motion.div
        initial={{ width: 200 }}
        animate={{ width: 56 }}
        transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
        className="relative h-screen flex flex-col items-center py-4 gap-3 shrink-0 overflow-hidden"
        style={{
          background: '#FFFFFF',
          borderRight: '1px solid rgba(0,0,0,0.07)',
        }}
      >
        <img src="/logo.png" alt="TooliAi" className="w-8 h-8 rounded-xl object-cover" />
        <button
          onClick={onNewChat}
          className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm hover:bg-indigo-700 transition-colors"
          title="New Chat"
        >
          <Plus size={16} />
        </button>
        <div className="flex-1" />
        {user ? (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center text-white text-[11px] font-semibold shadow-sm">
            {userInitial}
          </div>
        ) : (
          <button onClick={onLogin} title="Sign in" className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors text-gray-400">
            <LogIn size={16} />
          </button>
        )}
      </motion.div>
    )
  }

  return (
    <motion.div
      animate={{ width: 220 }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      className="relative h-screen flex flex-col shrink-0 overflow-hidden"
      style={{
        background: '#FFFFFF',
        borderRight: '1px solid rgba(0,0,0,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 h-14 shrink-0">
        <img src="/logo.png" alt="TooliAi" className="w-7 h-7 rounded-xl object-cover" />
        <span className="font-semibold text-[14px] text-gray-900 tracking-tight">TooliAi</span>
      </div>

      {/* New Chat */}
      <div className="px-3 pb-3 shrink-0">
        <button
          onClick={onNewChat}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-[13px] font-medium text-white transition-all duration-150"
          style={{
            background: 'linear-gradient(135deg, #4F46E5, #7C3AED)',
            boxShadow: '0 1px 8px rgba(79,70,229,0.3)',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.92')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          <Plus size={14} />
          <span>New Chat</span>
        </button>
      </div>

      <div className="h-px mx-3 shrink-0" style={{ background: 'rgba(0,0,0,0.06)' }} />

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto px-2 py-2 custom-scrollbar">
        {conversations.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Bot size={24} className="mx-auto mb-2 text-gray-300" />
            <p className="text-[11px] text-gray-400">No conversations yet</p>
            <p className="text-[10px] text-gray-300 mt-0.5">Start a new chat above</p>
          </div>
        ) : (
          <>
            {today.length > 0 && (
              <div className="mb-1">
                <p className="text-[10px] font-semibold tracking-[0.1em] uppercase px-2 mb-1.5" style={{ color: 'rgba(0,0,0,0.3)' }}>
                  Today
                </p>
                <ConvList
                  items={today}
                  activeConvId={activeConvId}
                  hoveredConvId={hoveredConvId}
                  setHoveredConvId={setHoveredConvId}
                  onSelectConv={onSelectConv}
                  onDeleteConv={onDeleteConv}
                />
              </div>
            )}

            {pastWeek.length > 0 && (
              <div className="mb-1">
                <p className="text-[10px] font-semibold tracking-[0.1em] uppercase px-2 mb-1.5 mt-2" style={{ color: 'rgba(0,0,0,0.3)' }}>
                  Past 7 Days
                </p>
                <ConvList
                  items={pastWeek}
                  activeConvId={activeConvId}
                  hoveredConvId={hoveredConvId}
                  setHoveredConvId={setHoveredConvId}
                  onSelectConv={onSelectConv}
                  onDeleteConv={onDeleteConv}
                />
              </div>
            )}

            {older.length > 0 && (
              <div className="mb-1">
                <p className="text-[10px] font-semibold tracking-[0.1em] uppercase px-2 mb-1.5 mt-2" style={{ color: 'rgba(0,0,0,0.3)' }}>
                  Older
                </p>
                <ConvList
                  items={older}
                  activeConvId={activeConvId}
                  hoveredConvId={hoveredConvId}
                  setHoveredConvId={setHoveredConvId}
                  onSelectConv={onSelectConv}
                  onDeleteConv={onDeleteConv}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Upgrade (free tier) */}
      {planTier === 'free' && (
        <div className="px-3 pb-2 shrink-0">
          <button
            onClick={onUpgrade}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[12px] font-semibold text-white transition-all"
            style={{
              background: 'linear-gradient(135deg, #f59e0b, #f97316)',
              boxShadow: '0 1px 6px rgba(245,158,11,0.25)',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            <Crown size={12} />
            Upgrade to Pro
            <span className="ml-auto">→</span>
          </button>
        </div>
      )}

      {/* User section */}
      <div className="shrink-0 px-3 py-3" style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        {user ? (
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-400 flex items-center justify-center shrink-0 text-[12px] font-semibold text-white shadow-sm">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-semibold text-gray-800 truncate leading-tight">
                {user.displayName || user.email?.split('@')[0]}
              </div>
              <div className="text-[10px] text-gray-400 truncate leading-tight">{user.email}</div>
            </div>
            <button
              onClick={onLogout}
              className="p-1.5 rounded-lg transition-colors shrink-0"
              title="Sign out"
              style={{ color: 'rgba(0,0,0,0.25)' }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.04)'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.6)'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.25)'
              }}
            >
              <LogOut size={13} />
            </button>
          </div>
        ) : (
          <button
            onClick={onLogin}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-[13px] font-medium hover:bg-gray-50 transition-colors"
            style={{ color: 'rgba(0,0,0,0.45)' }}
          >
            <LogIn size={14} />
            Sign in
          </button>
        )}
      </div>
    </motion.div>
  )
}

function ConvList({
  items,
  activeConvId,
  hoveredConvId,
  setHoveredConvId,
  onSelectConv,
  onDeleteConv,
}: {
  items: Conversation[]
  activeConvId: string | null
  hoveredConvId: string | null
  setHoveredConvId: (id: string | null) => void
  onSelectConv: (id: string) => void
  onDeleteConv: (id: string) => void
}) {
  return (
    <div className="space-y-0.5">
      {items.map((conv) => {
        const isActive = activeConvId === conv.id
        return (
          <div
            key={conv.id}
            onMouseEnter={() => setHoveredConvId(conv.id)}
            onMouseLeave={() => setHoveredConvId(null)}
            onClick={() => onSelectConv(conv.id)}
            className={cn(
              'relative group flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-xl cursor-pointer transition-all duration-150 min-h-[40px]',
              isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
            )}
          >
            {/* Active indicator */}
            {isActive && (
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 bg-indigo-500 rounded-r-full" />
            )}

            <span
              className={cn(
                'text-[12.5px] truncate flex-1 leading-relaxed',
                isActive ? 'font-medium text-indigo-700' : 'text-gray-600'
              )}
            >
              {conv.title}
            </span>

            <AnimatePresence>
              {hoveredConvId === conv.id && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.1 }}
                  onClick={(e) => { e.stopPropagation(); onDeleteConv(conv.id) }}
                  className="shrink-0 w-5 h-5 flex items-center justify-center rounded-md transition-colors"
                  style={{ color: 'rgba(0,0,0,0.25)' }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.7)'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
                    ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(0,0,0,0.25)'
                  }}
                >
                  <Trash2 size={11} />
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}
