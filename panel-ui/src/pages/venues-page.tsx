import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useTable } from '@tanstack/react-table'

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
  apiGet,
  apiOfflineMessage,
  type Venue,
  type VenuesResponse,
} from '@/lib/api'

type VenueRow = {
  id: string
  name: string
  plans: string
  venue: Venue
}

export function VenuesPage() {
  const [rows, setRows] = useState<VenueRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await apiGet<VenuesResponse>('/venues')
      setRows(
        data.venues.map((venue) => ({
          id: venue.id,
          name: venue.name,
          plans: venue.planVersions.length
            ? venue.planVersions
                .map((p) => `v${p.version} · ${p.seatCount ?? '?'} koltuk`)
                .join(', ')
            : 'Yayın yok',
          venue,
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

  const columns = useMemo<ColumnDef<DataGridFeatures, VenueRow>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Salon',
        cell: (info) => info.getValue() as string,
      },
      {
        accessorKey: 'plans',
        header: 'Yayınlanmış planlar',
        cell: (info) => (
          <span className="text-muted-foreground">{info.getValue() as string}</span>
        ),
      },
      {
        id: 'editor',
        header: 'Editör',
        cell: ({ row }) => (
          <Button
            variant="link"
            size="sm"
            render={<Link to={`/venues/${row.original.id}/editor`} />}
          >
            Plan editörü ↗
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
        <h1 className="text-lg font-semibold tracking-tight">Salonlar</h1>
        <p className="text-muted-foreground text-sm">
          Yayınlanmış plan sürümleri ve koltuk sayıları. Seed&apos;de{' '}
          <strong>Salon 03</strong> plan v1 = 108 koltuk (Meridian demo).
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
          <CardHeader>
            <CardTitle>Salon bulunamadı</CardTitle>
            <CardDescription>
              Yayınlanmış salon yok. API seed çalıştırın.
            </CardDescription>
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
            <Button render={<Link to="/sessions/new" />}>
              Bu salonda seans oluştur
            </Button>
          </div>
        </>
      ) : null}
    </section>
  )
}
