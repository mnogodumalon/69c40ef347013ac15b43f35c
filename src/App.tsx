import { lazy, Suspense } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import VeranstaltungsortPage from '@/pages/VeranstaltungsortPage';
import ReferentenPage from '@/pages/ReferentenPage';
import VeranstaltungenPage from '@/pages/VeranstaltungenPage';
import TeilnehmerPage from '@/pages/TeilnehmerPage';
import AnmeldungenPage from '@/pages/AnmeldungenPage';
import TeilnehmerAnmeldungPage from '@/pages/TeilnehmerAnmeldungPage';

const EventSetupPage = lazy(() => import('@/pages/intents/EventSetupPage'));
const BatchRegistrationPage = lazy(() => import('@/pages/intents/BatchRegistrationPage'));

export default function App() {
  return (
    <HashRouter>
      <ActionsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="veranstaltungsort" element={<VeranstaltungsortPage />} />
            <Route path="referenten" element={<ReferentenPage />} />
            <Route path="veranstaltungen" element={<VeranstaltungenPage />} />
            <Route path="teilnehmer" element={<TeilnehmerPage />} />
            <Route path="anmeldungen" element={<AnmeldungenPage />} />
            <Route path="teilnehmer-anmeldung" element={<TeilnehmerAnmeldungPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="intents/event-setup" element={<Suspense fallback={null}><EventSetupPage /></Suspense>} />
            <Route path="intents/batch-registration" element={<Suspense fallback={null}><BatchRegistrationPage /></Suspense>} />
          </Route>
        </Routes>
      </ActionsProvider>
    </HashRouter>
  );
}
