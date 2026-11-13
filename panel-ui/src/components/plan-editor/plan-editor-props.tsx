import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { PlanLayout } from '@/lib/plan-layout'
import type { PlanSeat } from '@/lib/plan-layout'

type Props = {
  title: string
  onTitleChange: (value: string) => void
  layout: PlanLayout
  seat: PlanSeat | null
  onMoveX: () => void
  onMoveZ: () => void
  onRenumberRow: () => void
}

export function PlanEditorProps({
  title,
  onTitleChange,
  layout,
  seat,
  onMoveX,
  onMoveZ,
  onRenumberRow,
}: Props) {
  if (!seat) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">
          Koltuk seçin. Taşıma ve yeniden numaralandırma <strong>uid</strong> korur.
        </p>
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Plan adı</span>
          <Input value={title} onChange={(e) => onTitleChange(e.target.value)} />
        </label>
      </div>
    )
  }

  const cat = layout.categories.find((c) => c.id === seat.categoryId)

  return (
    <div className="flex flex-col gap-4">
      <p className="font-semibold">{seat.label}</p>
      <p className="text-muted-foreground text-xs break-all">uid: {seat.uid}</p>
      <p className="text-muted-foreground text-xs">
        Kategori: {cat?.name ?? '?'}
      </p>
      <p className="text-muted-foreground text-xs tabular-nums">
        x={seat.x.toFixed(2)} z={seat.z.toFixed(2)}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="secondary" size="sm" type="button" onClick={onMoveX}>
          Taşı →
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={onMoveZ}>
          Taşı ↓
        </Button>
        <Button variant="secondary" size="sm" type="button" onClick={onRenumberRow}>
          Sırayı yeniden numarala
        </Button>
      </div>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Plan adı</span>
        <Input value={title} onChange={(e) => onTitleChange(e.target.value)} />
      </label>
    </div>
  )
}
