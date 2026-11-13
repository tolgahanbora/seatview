import { categoryColor, type PlanLayout } from '@/lib/plan-layout'

type Props = {
  layout: PlanLayout
  selectedUid: string | null
  onSelectSeat: (uid: string) => void
}

export function PlanEditorCanvas({ layout, selectedUid, onSelectSeat }: Props) {
  const screen = layout.screen ? (
    <div className="editor-screen">PERDE / SAHNE</div>
  ) : (
    <div className="editor-screen editor-screen-missing">Perde eklenmedi</div>
  )

  if (!layout.seats.length) {
    return (
      <div className="flex flex-col gap-3">
        {screen}
        <p className="text-muted-foreground text-center text-sm">
          <strong>Meridian 108 (seed)</strong> veya Demo 48 ile başlayın; seed planı A–I × 12
          koltuktur.
        </p>
      </div>
    )
  }

  const rows = [...new Set(layout.seats.map((s) => s.row))].sort()

  return (
    <div className="flex flex-col gap-3">
      {screen}
      {rows.map((row) => {
        const seats = layout.seats.filter((s) => s.row === row)
        const left = seats.filter((s) => s.column <= 6).sort((a, b) => a.column - b.column)
        const right = seats.filter((s) => s.column >= 7).sort((a, b) => a.column - b.column)
        return (
          <div key={row} className="editor-grid" aria-label={`Sıra ${row}`}>
            {left.map((seat) => (
              <SeatButton
                key={seat.uid}
                seat={seat}
                color={categoryColor(layout, seat.categoryId)}
                selected={seat.uid === selectedUid}
                onSelect={onSelectSeat}
              />
            ))}
            <span className="editor-aisle" aria-label="Koridor" />
            {right.map((seat) => (
              <SeatButton
                key={seat.uid}
                seat={seat}
                color={categoryColor(layout, seat.categoryId)}
                selected={seat.uid === selectedUid}
                onSelect={onSelectSeat}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}

function SeatButton({
  seat,
  color,
  selected,
  onSelect,
}: {
  seat: { uid: string; label: string }
  color: string
  selected: boolean
  onSelect: (uid: string) => void
}) {
  return (
    <button
      type="button"
      className="editor-seat"
      data-selected={selected}
      style={{ background: color }}
      title={`uid ${seat.uid}`}
      onClick={() => onSelect(seat.uid)}
    >
      {seat.label}
    </button>
  )
}
