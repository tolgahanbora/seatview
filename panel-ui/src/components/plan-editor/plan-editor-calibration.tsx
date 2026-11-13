import { Badge } from '@/components/reui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import type { PlanCalibration, PlanLayout } from '@/lib/plan-layout'
import { ensureCalibration } from '@/lib/plan-layout'

type Props = {
  layout: PlanLayout
  onChange: (next: PlanCalibration) => void
}

export function PlanEditorCalibration({ layout, onChange }: Props) {
  const calibration = ensureCalibration(layout)

  const patch = (partial: Partial<PlanCalibration>) => {
    onChange({ ...calibration, ...partial })
  }

  const target = calibration.screenTarget ?? { x: 0, y: 0, z: 0 }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">3D önizleme kalibrasyonu</span>
        {calibration.calibrated ? (
          <Badge variant="success-light">Doğrulandı</Badge>
        ) : (
          <Badge variant="warning-light">Taslak — widget ölçü göstermez</Badge>
        )}
      </div>
      <p className="text-muted-foreground text-xs">
        Seed planı (108) <code className="text-xs">calibrated: false</code> ile gelir; sahada
        ölçüm sonrası işaretleyin.
      </p>
      <label className="flex items-center gap-2 text-sm">
        <Checkbox
          checked={calibration.calibrated}
          onCheckedChange={(checked) => patch({ calibrated: checked === true })}
        />
        <span>Kalibre edildi (widget 3D ölçüleri açar)</span>
      </label>
      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Göz yüksekliği (m)</span>
        <Input
          type="number"
          step="0.01"
          min="0.5"
          max="2.5"
          value={calibration.eyeHeightM}
          onChange={(e) => patch({ eyeHeightM: Number(e.target.value) || DEFAULT_EYE })}
        />
      </label>
      <p className="text-xs font-medium">Perde hedefi (m)</p>
      <div className="grid grid-cols-3 gap-2">
        {(['x', 'y', 'z'] as const).map((axis) => (
          <label key={axis} className="flex flex-col gap-1 text-xs">
            <span className="text-muted-foreground uppercase">{axis}</span>
            <Input
              type="number"
              step="0.01"
              value={target[axis]}
              onChange={(e) =>
                patch({
                  screenTarget: {
                    ...target,
                    [axis]: Number(e.target.value) || 0,
                  },
                })
              }
            />
          </label>
        ))}
      </div>
    </div>
  )
}

const DEFAULT_EYE = 1.14
