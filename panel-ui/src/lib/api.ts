const API_BASE =
  import.meta.env.VITE_API_BASE?.replace(/\/$/, '') || '/api-seatview'

export const DEMO_API_KEY = 'demo-meridian-api-key'
export const ENVIRONMENT = 'test'
export const BUSINESS_NAME = 'Meridian Sineması'

export const DEMO_SESSION_SPECS = [
  { title: '19:45 · IMAX', startsAt: '2026-11-10T19:45:00+03:00' },
  { title: '22:15 · IMAX', startsAt: '2026-11-10T22:15:00+03:00' },
] as const

export type PlanVersion = {
  id: string
  version: number
  seatCount?: number
}

export type Venue = {
  id: string
  name: string
  planVersions: PlanVersion[]
}

export type Session = {
  id: string
  title: string
  startsAt: string
  timezone: string
  venueId: string
  venueName?: string | null
  planVersionId: string
  planVersion?: number | null
}

export type VenuesResponse = { venues: Venue[] }
export type SessionsResponse = { sessions: Session[] }

export type CreatedSession = Session & { inventoryCount?: number }

export type PlanDraft = {
  id: string
  venueId: string
  title: string
  revision: number
  layout: import('@/lib/plan-layout').PlanLayout
  canPublish?: boolean
  validationIssues?: { message: string }[]
}

export type PublishPlanResult = {
  idempotent?: boolean
  version: number
  seatCount: number
  draft: PlanDraft
}

export class RevisionConflictError extends Error {
  readonly code = 'REVISION_CONFLICT' as const
  details: unknown
  constructor(details: unknown) {
    super('Revizyon çakışması')
    this.name = 'RevisionConflictError'
    this.details = details
  }
}

function apiHeaders(extra: Record<string, string> = {}) {
  return {
    'X-Business-Api-Key': DEMO_API_KEY,
    'X-Seatview-Environment': ENVIRONMENT,
    ...extra,
  }
}

async function parseError(response: Response) {
  const text = await response.text()
  throw new Error(`${response.status}: ${text}`)
}

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, { headers: apiHeaders() })
  if (!response.ok) await parseError(response)
  return response.json() as Promise<T>
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'PATCH',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (response.status === 409) {
    throw new RevisionConflictError(payload)
  }
  if (!response.ok) {
    const message = Array.isArray((payload as { message?: unknown }).message)
      ? ((payload as { message: string[] }).message).join(', ')
      : (payload as { message?: string }).message || response.statusText
    throw new Error(message)
  }
  return payload as T
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: apiHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    const message = Array.isArray((payload as { message?: unknown }).message)
      ? ((payload as { message: string[] }).message).join(', ')
      : (payload as { message?: string }).message || response.statusText
    throw new Error(message)
  }
  return payload as T
}

export function formatSessionTime(startsAt: string, timezone = 'Europe/Istanbul') {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: timezone,
  }).format(new Date(startsAt))
}

export function widgetPreviewUrl(session: Pick<Session, 'id' | 'title'>) {
  const params = new URLSearchParams({ sessionId: session.id, title: session.title })
  const origin =
    import.meta.env.VITE_WIDGET_ORIGIN?.replace(/\/$/, '') || 'http://127.0.0.1:4173'
  return `${origin}/?${params.toString()}`
}

function widgetOrigin() {
  return import.meta.env.VITE_WIDGET_ORIGIN?.replace(/\/$/, '') || 'http://127.0.0.1:4173'
}

export function draftPreviewUrl(draftId: string) {
  const params = new URLSearchParams({ draftId })
  return `${widgetOrigin()}/?${params.toString()}`
}

export function apiOfflineMessage(error: unknown) {
  const detail = error instanceof Error ? error.message : 'Bilinmeyen hata'
  return `API bağlantısı kurulamadı (${detail}). \`npm run db:up\`, \`npm run api:migrate\` ve \`npm run api:dev\` komutlarını çalıştırın.`
}

export function localToIsoWithIstanbulOffset(datetimeLocal: string) {
  const [datePart, timePart] = datetimeLocal.split('T')
  return `${datePart}T${timePart}:00+03:00`
}
