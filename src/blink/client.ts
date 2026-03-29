import { createClient } from '@blinkdotnew/sdk'

export const blink = createClient({
  projectId: import.meta.env.VITE_BLINK_PROJECT_ID || 'tooli-ai-suite-1n0o4p8f',
  publishableKey: import.meta.env.VITE_BLINK_PUBLISHABLE_KEY || 'blnk_pk_LXJk8wWfCBxC3NhIGmFQQ63toiwNR9RF',
  auth: { mode: 'managed' },
})
