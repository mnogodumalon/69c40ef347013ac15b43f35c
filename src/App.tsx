import { HashRouter, Routes, Route } from 'react-router-dom';
import { ActionsProvider } from '@/context/ActionsContext';
import { Layout } from '@/components/Layout';
import DashboardOverview from '@/pages/DashboardOverview';
import AdminPage from '@/pages/AdminPage';
import VeranstaltungenPage from '@/pages/VeranstaltungenPage';
import TeilnehmerAnmeldungPage from '@/pages/TeilnehmerAnmeldungPage';
import TeilnehmerPage from '@/pages/TeilnehmerPage';
import VeranstaltungsortPage from '@/pages/VeranstaltungsortPage';
import ReferentenPage from '@/pages/ReferentenPage';
import AnmeldungenPage from '@/pages/AnmeldungenPage';
import VeranstaltungEinrichtenPage from '@/pages/intents/VeranstaltungEinrichtenPage';
import TeilnehmerAnmeldenPage from '@/pages/intents/TeilnehmerAnmeldenPage';
import AnmeldungenVerwaltenPage from '@/pages/intents/AnmeldungenVerwaltenPage';

export default function App() {
  return (
    <HashRouter>
      <ActionsProvider>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<DashboardOverview />} />
            <Route path="veranstaltungen" element={<VeranstaltungenPage />} />
            <Route path="teilnehmer-anmeldung" element={<TeilnehmerAnmeldungPage />} />
            <Route path="teilnehmer" element={<TeilnehmerPage />} />
            <Route path="veranstaltungsort" element={<VeranstaltungsortPage />} />
            <Route path="referenten" element={<ReferentenPage />} />
            <Route path="anmeldungen" element={<AnmeldungenPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="intents/veranstaltung-einrichten" element={<VeranstaltungEinrichtenPage />} />
            <Route path="intents/teilnehmer-anmelden" element={<TeilnehmerAnmeldenPage />} />
            <Route path="intents/anmeldungen-verwalten" element={<AnmeldungenVerwaltenPage />} />
          </Route>
        </Routes>
      </ActionsProvider>
    </HashRouter>
  );
}
