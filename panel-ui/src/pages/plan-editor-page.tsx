import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { PlanEditorCalibration } from '@/components/plan-editor/plan-editor-calibration'
import { PlanEditorCanvas } from '@/components/plan-editor/plan-editor-canvas'
import { PlanEditorProps } from '@/components/plan-editor/plan-editor-props'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/reui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePlanDraftEditor } from '@/hooks/use-plan-draft-editor'
import { apiGet, draftPreviewUrl, type VenuesResponse } from '@/lib/api'
import '@/styles/plan-editor.css'

export function PlanEditorPage() {
  const { venueId, draftId } = useParams<{ venueId?: string; draftId?: string }>()
  const navigate = useNavigate()
  const editor = usePlanDraftEditor({ venueId, draftId })
  const [venueLabel, setVenueLabel] = useState<string | null>(null)

  useEffect(() => {
    if (venueId && editor.draft?.id && !draftId) {
      navigate(`/editor/${editor.draft.id}`, { replace: true })
    }
  }, [venueId, draftId, editor.draft?.id, navigate])

  useEffect(() => {
    const id = editor.draft?.venueId
    if (!id) {
      setVenueLabel(null)
      return
    }
    void apiGet<VenuesResponse>('/venues').then((data) => {
      const venue = data.venues.find((v) => v.id === id)
      setVenueLabel(venue ? `${venue.name} (${id})` : id)
    })
  }, [editor.draft?.venueId])

  if (editor.loading) {
    return (
      <section className="flex flex-col gap-6">
        <Skeleton className="h-96 w-full" />
      </section>
    )
  }

  if (editor.error) {
    return (
      <section className="flex flex-col gap-6">
        <Alert variant="destructive">
          <AlertTitle>Editör açılamadı</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <span>{editor.error}</span>
            <Button variant="secondary" size="sm" onClick={() => void editor.reload()}>
              Yeniden dene
            </Button>
          </AlertDescription>
        </Alert>
      </section>
    )
  }

  if (!editor.layout || !editor.draft) {
    return null
  }

  return (
    <section className="flex flex-col gap-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold tracking-tight">{editor.title}</h1>
          <p className="text-muted-foreground text-sm tabular-nums">
            Taslak revizyon {editor.revision} · {editor.layout.seats.length} koltuk
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" render={<Link to="/venues" />}>
            ← Salonlar
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={!editor.canUndo}
            onClick={editor.undo}
          >
            Geri al
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            disabled={!editor.canRedo}
            onClick={editor.redo}
          >
            İleri al
          </Button>
          <Button
            size="sm"
            type="button"
            disabled={editor.saving}
            onClick={() => void editor.saveDraft()}
          >
            Kaydet
          </Button>
          <Button
            variant="secondary"
            size="sm"
            type="button"
            onClick={() => {
              window.open(draftPreviewUrl(editor.draft!.id), '_blank', 'noopener')
            }}
          >
            Önizleme ↗
          </Button>
          <Button
            size="sm"
            type="button"
            disabled={!editor.canPublish || editor.saving}
            onClick={() => void editor.publishDraft()}
          >
            Yayınla
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="flex flex-wrap gap-2 pt-6">
          <Button variant="secondary" size="sm" type="button" onClick={editor.addScreen}>
            + Perde
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={editor.addSection}>
            + Bölüm
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={editor.addRow}>
            + Sıra (6+6)
          </Button>
          <Button size="sm" type="button" onClick={editor.buildDemo48}>
            Demo 48 (A–D)
          </Button>
          <Button size="sm" type="button" onClick={editor.buildMeridian108}>
            Meridian 108 (seed)
          </Button>
          <Button variant="secondary" size="sm" type="button" onClick={editor.applyVipRowD}>
            D → VIP
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kalibrasyon</CardTitle>
        </CardHeader>
        <CardContent>
          <PlanEditorCalibration
            layout={editor.layout}
            onChange={editor.setCalibration}
          />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="editor-canvas-wrap">
          <PlanEditorCanvas
            layout={editor.layout}
            selectedUid={editor.selectedUid}
            onSelectSeat={(uid) => editor.selectSeat(uid)}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Özellikler</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <PlanEditorProps
              title={editor.title}
              onTitleChange={editor.setTitle}
              layout={editor.layout}
              seat={editor.selectedSeat}
              onMoveX={() => editor.moveSelected(0.1, 0)}
              onMoveZ={() => editor.moveSelected(0, 0.1)}
              onRenumberRow={editor.renumberSelectedRow}
            />
            {editor.issues.length > 0 ? (
              <p className="text-xs font-medium">Uyarılar</p>
            ) : null}
            <ul className="text-destructive flex list-disc flex-col gap-1 pl-4 text-xs">
              {editor.issues.map((issue) => (
                <li key={issue.message}>{issue.message}</li>
              ))}
            </ul>
            {venueLabel ? (
              <Badge variant="info-light" className="w-fit max-w-full truncate">
                Salon: {venueLabel}
              </Badge>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <p className="text-muted-foreground text-xs">
        Taslak kimliği:{' '}
        <button
          type="button"
          className="text-primary hover:underline"
          onClick={() => navigate(`/editor/${editor.draft!.id}`)}
        >
          {editor.draft.id}
        </button>
      </p>
    </section>
  )
}
