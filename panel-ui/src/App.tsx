import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

import { PanelShell } from '@/components/panel-shell'
import { NewSessionPage } from '@/pages/new-session-page'
import { SessionsPage } from '@/pages/sessions-page'
import { PlanEditorPage } from '@/pages/plan-editor-page'
import { VenuesPage } from '@/pages/venues-page'
import { Toaster } from '@/components/ui/sonner'
import { TooltipProvider } from '@/components/ui/tooltip'

export default function App() {
  return (
    <TooltipProvider>
      <BrowserRouter basename="/panel">
        <Routes>
          <Route element={<PanelShell />}>
            <Route path="/" element={<Navigate to="/sessions" replace />} />
            <Route path="/venues" element={<VenuesPage />} />
            <Route path="/sessions" element={<SessionsPage />} />
            <Route path="/sessions/new" element={<NewSessionPage />} />
            <Route path="/venues/:venueId/editor" element={<PlanEditorPage />} />
            <Route path="/editor/:draftId" element={<PlanEditorPage />} />
            <Route path="*" element={<Navigate to="/sessions" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors closeButton />
    </TooltipProvider>
  )
}
