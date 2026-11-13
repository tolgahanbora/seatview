import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useTable } from '@tanstack/react-table'
import { toast } from 'sonner'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  DataGrid,
  DataGridContainer,
  dataGridFeatures,
  type DataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import {
  DEMO_SESSION_SPECS,
  apiGet,
  apiOfflineMessage,
  apiPost,
  formatSessionTime,
  widgetPreviewUrl,
  type Session,
  type SessionsResponse,
  type VenuesResponse,
} from '@/lib/api'

type SessionRow = {
  id: string
  title: string
  startsAt: string
  venue: string
  plan: string
  preview: string
}

export function SessionsPage() {
  const [rows, setRows] = useState<SessionRow[]>([])
  const [venuesLoaded, setVenuesLoaded] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [venueMeta, setVenueMeta] = useState<VenuesResponse | null>(null)
  const [creatingDemo, setCreatingDemo] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const venues = await apiGet<VenuesResponse>('/venues')
      setVenueMeta(venues)
      setVenuesLoaded(true)

      const venueById = new Map(venues.venues.map((v) => [v.id, v.name]))
      const planById = new Map<string, number>()
      for (const venue of venues.venues) {
        for (const plan of venue.planVersions) {
          planById.set(plan.id, plan.version)
        }
      }

      const data = await apiGet<SessionsResponse>('/sessions')
      setRows(
        data.sessions.map((session: Session) => ({
          id: session.id,
          title: session.title,
          startsAt: formatSessionTime(session.startsAt, session.timezone),
          venue: session.venueName ?? venueById.get(session.venueId) ?? session.venueId,
          plan: `v${session.planVersion ?? planById.get(session.planVersionId) ?? '?'}`,
          preview: widgetPreviewUrl(session),
        })),
      )
    } catch (err) {
      setError(apiOfflineMessage(err))
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const createDemoSessions = async () => {
    if (!venueMeta?.venues[0]) {
      toast.error('Önce salon seed edilmeli.')
      return
    }
    const venue = venueMeta.venues[0]
    const planV1 = venue.planVersions.find((p) => p.version === 1)
    if (!planV1) {
      toast.error('v1 plan sürümü bulunamadı.')
      return
    }
    setCreatingDemo(true)
    try {
      const existing = await apiGet<SessionsResponse>('/sessions')
      const titles = new Set(existing.sessions.map((s) => s.title))
      let created = 0
      for (const spec of DEMO_SESSION_SPECS) {
        if (titles.has(spec.title)) continue
        await apiPost('/sessions', {
          title: spec.title,
          startsAt: spec.startsAt,
          planVersionId: planV1.id,
          timezone: 'Europe/Istanbul',
        })
        created += 1
      }
      if (created === 0) toast.message('19:45 ve 22:15 seansları zaten listede.')
      else toast.success(`${created} demo seans oluşturuldu.`)
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Demo seanslar oluşturulamadı')
    } finally {
      setCreatingDemo(false)
    }
  }

  const columns = useMemo<ColumnDef<DataGridFeatures, SessionRow>[]>(
    () => [
      { accessorKey: 'title', header: 'Ad' },
      { accessorKey: 'startsAt', header: 'Başlangıç' },
      { accessorKey: 'venue', header: 'Salon' },
      {
        accessorKey: 'plan',
        header: 'Plan',
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() as string}</span>
        ),
      },
      {
        id: 'preview',
        header: 'Widget',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            render={
              <a href={row.original.preview} target="_blank" rel="noopener noreferrer" />
            }
          >
            Önizleme ↗
          </Button>
        ),
        enableSorting: false,
      },
    ],
    [],
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.id,
  })

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-0.5">
        <h1 className="text-lg font-semibold tracking-tight">Seanslar</h1>
        <p className="text-muted-foreground text-sm">
          Widget önizlemesi doğru <code className="text-xs">sessionId</code> ile açılır.
        </p>
      </header>

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Bağlantı hatası</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{error}</span>
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex flex-col gap-3">
          <Skeleton className="h-10 w-full max-w-md" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : null}

      {!loading && !error && rows.length === 0 ? (
        <Card>
          <CardHeader className="gap-3">
            <CardTitle>Henüz seans yok</CardTitle>
            <CardDescription>
              Demo seanslarını oluşturun veya yeni seans ekleyin.
            </CardDescription>
            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                variant="secondary"
                disabled={creatingDemo || !venuesLoaded}
                onClick={() => void createDemoSessions()}
              >
                Meridian demo seansları (19:45 & 22:15)
              </Button>
              <Button render={<Link to="/sessions/new" />}>Yeni seans</Button>
            </div>
          </CardHeader>
        </Card>
      ) : null}

      {!loading && !error && rows.length > 0 ? (
        <>
          <DataGrid table={table} recordCount={rows.length}>
            <div className="flex w-full flex-col gap-3">
              <DataGridContainer>
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </DataGridContainer>
              <DataGridPagination />
            </div>
          </DataGrid>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              disabled={creatingDemo}
              onClick={() => void createDemoSessions()}
            >
              Meridian demo seansları (19:45 & 22:15)
            </Button>
            <Button render={<Link to="/sessions/new" />}>Yeni seans</Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
