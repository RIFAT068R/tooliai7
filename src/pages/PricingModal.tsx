import { motion, AnimatePresence } from 'framer-motion'
import { X, Check, Crown, Zap, Sparkles } from 'lucide-react'
import { PLANS } from '../lib/models'
import type { PlanTier } from '../types'

interface PricingModalProps {
  open: boolean
  currentPlan: PlanTier
  onClose: () => void
  onSelectPlan: (planId: PlanTier) => void
}

const PLAN_ICONS: Record<PlanTier, React.ReactNode> = {
  free: <Zap size={20} className="text-muted-foreground" />,
  pro: <Crown size={20} className="text-indigo-500" />,
  max: <Sparkles size={20} className="text-amber-500" />,
}

const PLAN_COLORS: Record<PlanTier, string> = {
  free: 'border-border',
  pro: 'border-indigo-300  ring-2 ring-indigo-100 ',
  max: 'border-amber-300 ',
}

const PLAN_FEATURES: Record<PlanTier, string[]> = {
  free: [
    '20 messages per day',
    '3 image generations per day',
    'Fast models (GPT-4.1 Mini, Gemini Flash, Groq)',
    'Web search (real-time)',
    'File analysis',
    'Voice input / output',
  ],
  pro: [
    '300 messages per day',
    '50 image generations per day',
    'All models including GPT-4.1 & Gemini Pro',
    'High-quality image generation',
    'Priority response times',
    'Everything in Free',
  ],
  max: [
    'Unlimited messages',
    '200 image generations per day',
    'All models, always first access',
    'Highest priority queuing',
    'API access (coming soon)',
    'Everything in Pro',
  ],
}

export function PricingModal({ open, currentPlan, onClose, onSelectPlan }: PricingModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.96, opacity: 0, y: 8 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0, y: 8 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-border">
              <div>
                <h2 className="text-xl font-bold text-foreground">Upgrade your plan</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Get more messages, models, and capabilities</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Plans */}
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {PLANS.map((plan) => {
                const isCurrent = plan.id === currentPlan
                const isPro = plan.id === 'pro'
                const features = PLAN_FEATURES[plan.id]

                return (
                  <div
                    key={plan.id}
                    className={`relative flex flex-col p-5 rounded-2xl border ${PLAN_COLORS[plan.id]} ${isPro ? 'bg-indigo-50/50 ' : 'bg-card'}`}
                  >
                    {isPro && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 bg-indigo-500 text-white text-xs font-semibold rounded-full shadow-sm">
                        Most Popular
                      </div>
                    )}

                    {/* Plan header */}
                    <div className="flex items-center gap-2.5 mb-4">
                      <div className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center">
                        {PLAN_ICONS[plan.id]}
                      </div>
                      <div>
                        <div className="font-semibold text-foreground">{plan.name}</div>
                        <div className="text-2xl font-bold text-foreground">
                          {plan.price === 0 ? 'Free' : `$${plan.price}`}
                          {plan.price > 0 && <span className="text-sm font-normal text-muted-foreground">/mo</span>}
                        </div>
                      </div>
                    </div>

                    {/* Features */}
                    <ul className="space-y-2 flex-1 mb-5">
                      {features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm text-muted-foreground">
                          <Check size={13} className="text-primary mt-0.5 shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>

                    {/* CTA */}
                    <button
                      onClick={() => !isCurrent && onSelectPlan(plan.id)}
                      disabled={isCurrent}
                      className={`w-full py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isCurrent
                          ? 'bg-muted text-muted-foreground cursor-default'
                          : isPro
                          ? 'bg-indigo-500 hover:bg-indigo-600 text-white shadow-sm'
                          : 'bg-muted hover:bg-muted/80 text-foreground border border-border'
                      }`}
                    >
                      {isCurrent ? 'Current plan' : plan.price === 0 ? 'Downgrade' : 'Upgrade'}
                    </button>
                  </div>
                )
              })}
            </div>

            <div className="px-6 pb-5 text-center">
              <p className="text-xs text-muted-foreground">
                Payments powered by Stripe · Cancel anytime · No hidden fees
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
