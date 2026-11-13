import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { toast } from 'sonner'

import {
  RevisionConflictError,
  apiGet,
  apiPatch,
  apiPost,
  type PlanDraft,
  type PublishPlanResult,
  apiOfflineMessage,
} from '@/lib/api'
import {
  type PlanLayout,
  addMainSection,
  addRowBlock,
  addScreen,
  applyCategoryToRow,
  buildHall48Layout,
  moveSeat,
  renumberRow,
  type PlanCalibration,
} from '@/lib/plan-layout'
import { buildMeridian108Layout } from '@/lib/meridian-108-layout'

type EditorState = {
  draft: PlanDraft | null
  layout: PlanLayout | null
  title: string
  revision: number
  selectedUid: string | null
  history: PlanLayout[]
  historyIndex: number
}

type Action =
  | { type: 'loaded'; draft: PlanDraft }
  | { type: 'set-layout'; layout: PlanLayout; pushHistory?: boolean }
  | { type: 'select'; uid: string | null }
  | { type: 'set-title'; title: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'sync-draft'; draft: PlanDraft }

function cloneLayout(layout: PlanLayout) {
  return structuredClone(layout)
}

function reducer(state: EditorState, action: Action): EditorState {
  switch (action.type) {
    case 'loaded': {
      const layout = cloneLayout(action.draft.layout)
      return {
        draft: action.draft,
        layout,
        title: action.draft.title,
        revision: action.draft.revision,
        selectedUid: null,
        history: [layout],
        historyIndex: 0,
      }
    }
    case 'set-layout': {
      if (!state.layout) return state
      const layout = cloneLayout(action.layout)
      let history = state.history
      let historyIndex = state.historyIndex
      if (action.pushHistory !== false) {
        history = history.slice(0, historyIndex + 1)
        history.push(layout)
        historyIndex = history.length - 1
      }
      return { ...state, layout, history, historyIndex }
    }
    case 'select':
      return { ...state, selectedUid: action.uid }
    case 'set-title':
      return { ...state, title: action.title }
    case 'undo': {
      if (state.historyIndex <= 0 || !state.layout) return state
      const historyIndex = state.historyIndex - 1
      return {
        ...state,
        historyIndex,
        layout: cloneLayout(state.history[historyIndex]),
        selectedUid: null,
      }
    }
    case 'redo': {
      if (state.historyIndex >= state.history.length - 1 || !state.layout) return state
      const historyIndex = state.historyIndex + 1
      return {
        ...state,
        historyIndex,
        layout: cloneLayout(state.history[historyIndex]),
        selectedUid: null,
      }
    }
    case 'sync-draft': {
      const layout = cloneLayout(action.draft.layout)
      return {
        ...state,
        draft: action.draft,
        layout,
        title: action.draft.title,
        revision: action.draft.revision,
        history: [layout],
        historyIndex: 0,
      }
    }
    default:
      return state
  }
}

const initial: EditorState = {
  draft: null,
  layout: null,
  title: '',
  revision: 0,
  selectedUid: null,
  history: [],
  historyIndex: -1,
}

export function usePlanDraftEditor(opts: { venueId?: string; draftId?: string }) {
  const [state, dispatch] = useReducer(reducer, initial)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const loadKey = useRef('')

  const load = useCallback(async () => {
    const key = opts.draftId ?? opts.venueId ?? ''
    if (!key) {
      setError('Salon veya taslak kimliği gerekli.')
      setLoading(false)
      return
    }
    loadKey.current = key
    setLoading(true)
    setError(null)
    try {
      let draft: PlanDraft
      if (opts.draftId) {
        draft = await apiGet<PlanDraft>(`/plan-drafts/${opts.draftId}`)
      } else if (opts.venueId) {
        draft = await apiPost<PlanDraft>(`/venues/${opts.venueId}/plan-drafts`, {
          title: 'Salon planı',
        })
      } else {
        throw new Error('venueId veya draftId gerekli')
      }
      if (loadKey.current !== key) return
      dispatch({ type: 'loaded', draft })
    } catch (err) {
      setError(apiOfflineMessage(err))
    } finally {
      setLoading(false)
    }
  }, [opts.draftId, opts.venueId])

  useEffect(() => {
    void load()
  }, [load])

  const mutateLayout = useCallback(
    (fn: (layout: PlanLayout) => void) => {
      if (!state.layout) return
      const next = cloneLayout(state.layout)
      fn(next)
      dispatch({ type: 'set-layout', layout: next })
    },
    [state.layout],
  )

  const selectedSeat = useMemo(() => {
    if (!state.layout || !state.selectedUid) return null
    return state.layout.seats.find((s) => s.uid === state.selectedUid) ?? null
  }, [state.layout, state.selectedUid])

  const issues = useMemo(() => {
    if (!state.layout) return []
    if (state.layout.seats.length === 0) return [{ message: 'Koltuk ekleyin' }]
    if (!state.layout.screen || !state.layout.sections.length) {
      return [{ message: 'Perde ve bölüm ekleyin' }]
    }
    return []
  }, [state.layout])

  const canPublish =
    !!state.layout &&
    state.layout.seats.length > 0 &&
    !!state.layout.screen &&
    state.layout.sections.length > 0

  const saveDraft = async () => {
    if (!state.draft || !state.layout) return
    setSaving(true)
    try {
      const saved = await apiPatch<PlanDraft>(`/plan-drafts/${state.draft.id}`, {
        title: state.title,
        layout: state.layout,
        expectedRevision: state.revision,
      })
      dispatch({ type: 'sync-draft', draft: saved })
      toast.success(`Taslak kaydedildi · revizyon ${saved.revision}`)
    } catch (err) {
      if (err instanceof RevisionConflictError) {
        toast.error('Başka sekmede kayıt var — sayfayı yenileyin.')
      } else {
        toast.error(err instanceof Error ? err.message : 'Kayıt hatası')
      }
    } finally {
      setSaving(false)
    }
  }

  const publishDraft = async () => {
    if (!state.draft) return
    setSaving(true)
    try {
      const result = await apiPost<PublishPlanResult>(
        `/plan-drafts/${state.draft.id}/publish`,
        { expectedRevision: state.revision },
      )
      dispatch({ type: 'sync-draft', draft: result.draft })
      toast.success(
        `${result.idempotent ? 'Zaten yayınlı · ' : 'Yayınlandı · '}plan v${result.version} · ${result.seatCount} koltuk`,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Yayın hatası')
    } finally {
      setSaving(false)
    }
  }

  return {
    loading,
    error,
    saving,
    draft: state.draft,
    layout: state.layout,
    title: state.title,
    revision: state.revision,
    selectedUid: state.selectedUid,
    selectedSeat,
    issues,
    canPublish,
    canUndo: state.historyIndex > 0,
    canRedo: state.historyIndex < state.history.length - 1,
    setTitle: (title: string) => dispatch({ type: 'set-title', title }),
    selectSeat: (uid: string | null) => dispatch({ type: 'select', uid }),
    undo: () => dispatch({ type: 'undo' }),
    redo: () => dispatch({ type: 'redo' }),
    reload: load,
    saveDraft,
    publishDraft,
    addScreen: () => mutateLayout(addScreen),
    addSection: () => mutateLayout(addMainSection),
    addRow: () => {
      if (!state.layout) return
      if (state.layout.rowBlocks.length >= 4) {
        toast.error('Demo akışı için A–D yeterli; Demo 48 kullanın.')
        return
      }
      const next = String.fromCharCode('A'.charCodeAt(0) + state.layout.rowBlocks.length)
      mutateLayout((layout) => addRowBlock(layout, next))
    },
    buildDemo48: () => {
      dispatch({ type: 'set-layout', layout: buildHall48Layout() })
    },
    buildMeridian108: () => {
      dispatch({ type: 'set-layout', layout: buildMeridian108Layout() })
    },
    setCalibration: (calibration: PlanCalibration) => {
      mutateLayout((layout) => {
        layout.calibration = calibration
      })
    },
    applyVipRowD: () => mutateLayout((layout) => applyCategoryToRow(layout, 'D', 'cat-vip')),
    moveSelected: (dx: number, dz: number) => {
      if (!state.selectedUid) return
      mutateLayout((layout) => {
        const seat = layout.seats.find((s) => s.uid === state.selectedUid)
        if (seat) moveSeat(seat, dx, dz)
      })
    },
    renumberSelectedRow: () => {
      if (!state.selectedUid) return
      mutateLayout((layout) => {
        const seat = layout.seats.find((s) => s.uid === state.selectedUid)
        if (seat) renumberRow(layout, seat.row)
      })
    },
  }
}
