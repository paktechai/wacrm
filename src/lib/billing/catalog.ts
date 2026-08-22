export const SBYT_FEATURES = {
  whatsappMessaging: 'whatsapp_messaging',
  contacts: 'contacts',
  pipelines: 'pipelines',
  broadcasts: 'broadcasts',
  automations: 'automations',
  flows: 'flows',
  aiAssistant: 'ai_assistant',
  api: 'api',
  team: 'team',
} as const

export const SBYT_METRICS = {
  messagesSent: 'messages_sent',
  broadcastRecipients: 'broadcast_recipients',
  aiRequests: 'ai_requests',
  apiRequests: 'api_requests',
  contacts: 'contacts',
  teamMembers: 'team_members',
  whatsappNumbers: 'whatsapp_numbers',
} as const

export type SbytFeature = (typeof SBYT_FEATURES)[keyof typeof SBYT_FEATURES]
export type SbytMetric = (typeof SBYT_METRICS)[keyof typeof SBYT_METRICS]
