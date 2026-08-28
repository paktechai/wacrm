export const WOVA8_FEATURES = {
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

export const WOVA8_METRICS = {
  messagesSent: 'messages_sent',
  broadcastRecipients: 'broadcast_recipients',
  aiRequests: 'ai_requests',
  apiRequests: 'api_requests',
  contacts: 'contacts',
  teamMembers: 'team_members',
  whatsappNumbers: 'whatsapp_numbers',
} as const

export type Wova8Feature = (typeof WOVA8_FEATURES)[keyof typeof WOVA8_FEATURES]
export type Wova8Metric = (typeof WOVA8_METRICS)[keyof typeof WOVA8_METRICS]

/** @deprecated Temporary source-compatibility aliases for deployed extensions. */
export const SBYT_FEATURES = WOVA8_FEATURES
/** @deprecated Temporary source-compatibility aliases for deployed extensions. */
export const SBYT_METRICS = WOVA8_METRICS
/** @deprecated Use Wova8Feature. */
export type SbytFeature = Wova8Feature
/** @deprecated Use Wova8Metric. */
export type SbytMetric = Wova8Metric
