import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import {
  apiGet,
  apiOfflineMessage,
  apiPost,
  localToIsoWithIstanbulOffset,
  widgetPreviewUrl,
  type CreatedSession,
  type VenuesResponse,
} from '@/lib/api'

export function NewSessionPage() {
  const navigate = useNavigate()
  const [venues, setVenues] = useState<VenuesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState('')
  const [startsAt, setStartsAt] = useState('')
  const [planVersionId, setPlanVersionId] = useState('')
  const [timezone, setTimezone] = useState('Europe/Istanbul')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      try {
        const data = await apiGet<VenuesResponse>('/venues')
        setVenues(data)
        const venue = data.venues[0]
        const firstPlan = venue?.planVersions[0]
        if (firstPlan) setPlanVersionId(firstPlan.id)
      } catch (err) {
        setError(apiOfflineMessage(err))
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const planOptions =
    venues?.venues.flatMap((venue) =>
      venue.planVersions.map((plan) => ({
        id: plan.id,
        label: `${venue.name} · plan v${plan.version} · ${plan.seatCount ?? '?'} koltuk`,
      })),
    ) ?? []

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setFormError(null)
    const trimmed = title.trim()
    if (!trimmed) {
      setFormError('Seans adı gerekli.')
      return
    }
    if (!planVersionId) {
      setFormError('Plan sürümü seçin.')
      return
    }
    if (!startsAt) {
      setFormError('Başlangıç zamanı gerekli.')
      return
    }
    setSubmitting(true)
    try {
      const created = await apiPost<CreatedSession>('/sessions', {
        title: trimmed,
        startsAt: localToIsoWithIstanbulOffset(startsAt),
        planVersionId,
        timezone: timezone.trim() || 'Europe/Istanbul',
      })
      toast.success(
        `Seans oluşturuldu · ${created.inventoryCount ?? '?'} koltuk · önizleme açılıyor…`,
      )
      window.open(widgetPreviewUrl(created), '_blank', 'noopener')
      navigate('/sessions')
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Seans oluşturulamadı')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">Yeni seans</h1>
        <p className="text-muted-foreground text-sm">
          Test ortamında seans ve envanter tek işlemde açılır.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Bağlantı hatası</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-48 w-full" />
        </div>
      ) : (
        <Card>
          <form onSubmit={(e) => void onSubmit(e)}>
            <CardHeader>
              <CardTitle>Seans bilgileri</CardTitle>
              <CardDescription>Meridian demo verisiyle uyumludur.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {formError ? (
                <p className="text-destructive text-sm" role="alert">
                  {formError}
                </p>
              ) : null}
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Seans adı</span>
                <Input
                  required
                  maxLength={120}
                  placeholder="19:45 · IMAX"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Başlangıç</span>
                <Input
                  required
                  type="datetime-local"
                  value={startsAt}
                  onChange={(e) => setStartsAt(e.target.value)}
                />
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Plan sürümü</span>
                <Select
                  value={planVersionId}
                  onValueChange={(v) => v != null && setPlanVersionId(v)}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Plan seçin" />
                  </SelectTrigger>
                  <SelectContent>
                    {planOptions.map((opt) => (
                      <SelectItem key={opt.id} value={opt.id}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
              <label className="flex flex-col gap-1.5 text-sm">
                <span className="font-medium">Saat dilimi</span>
                <Input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                />
              </label>
            </CardContent>
            <CardFooter className="flex flex-wrap gap-2">
              <Button type="submit" disabled={submitting}>
                Seans oluştur
              </Button>
              <Button variant="secondary" render={<Link to="/sessions" />}>
                İptal
              </Button>
            </CardFooter>
          </form>
        </Card>
      )}
    </section>
  )
}
