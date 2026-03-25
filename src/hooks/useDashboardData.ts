import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Veranstaltungsort, Referenten, Veranstaltungen, Teilnehmer, Anmeldungen, TeilnehmerAnmeldung } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [veranstaltungsort, setVeranstaltungsort] = useState<Veranstaltungsort[]>([]);
  const [referenten, setReferenten] = useState<Referenten[]>([]);
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [anmeldungen, setAnmeldungen] = useState<Anmeldungen[]>([]);
  const [teilnehmerAnmeldung, setTeilnehmerAnmeldung] = useState<TeilnehmerAnmeldung[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [veranstaltungsortData, referentenData, veranstaltungenData, teilnehmerData, anmeldungenData, teilnehmerAnmeldungData] = await Promise.all([
        LivingAppsService.getVeranstaltungsort(),
        LivingAppsService.getReferenten(),
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getTeilnehmer(),
        LivingAppsService.getAnmeldungen(),
        LivingAppsService.getTeilnehmerAnmeldung(),
      ]);
      setVeranstaltungsort(veranstaltungsortData);
      setReferenten(referentenData);
      setVeranstaltungen(veranstaltungenData);
      setTeilnehmer(teilnehmerData);
      setAnmeldungen(anmeldungenData);
      setTeilnehmerAnmeldung(teilnehmerAnmeldungData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Silent background refresh (no loading state change → no flicker)
  useEffect(() => {
    async function silentRefresh() {
      try {
        const [veranstaltungsortData, referentenData, veranstaltungenData, teilnehmerData, anmeldungenData, teilnehmerAnmeldungData] = await Promise.all([
          LivingAppsService.getVeranstaltungsort(),
          LivingAppsService.getReferenten(),
          LivingAppsService.getVeranstaltungen(),
          LivingAppsService.getTeilnehmer(),
          LivingAppsService.getAnmeldungen(),
          LivingAppsService.getTeilnehmerAnmeldung(),
        ]);
        setVeranstaltungsort(veranstaltungsortData);
        setReferenten(referentenData);
        setVeranstaltungen(veranstaltungenData);
        setTeilnehmer(teilnehmerData);
        setAnmeldungen(anmeldungenData);
        setTeilnehmerAnmeldung(teilnehmerAnmeldungData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

  const veranstaltungsortMap = useMemo(() => {
    const m = new Map<string, Veranstaltungsort>();
    veranstaltungsort.forEach(r => m.set(r.record_id, r));
    return m;
  }, [veranstaltungsort]);

  const referentenMap = useMemo(() => {
    const m = new Map<string, Referenten>();
    referenten.forEach(r => m.set(r.record_id, r));
    return m;
  }, [referenten]);

  const veranstaltungenMap = useMemo(() => {
    const m = new Map<string, Veranstaltungen>();
    veranstaltungen.forEach(r => m.set(r.record_id, r));
    return m;
  }, [veranstaltungen]);

  const teilnehmerMap = useMemo(() => {
    const m = new Map<string, Teilnehmer>();
    teilnehmer.forEach(r => m.set(r.record_id, r));
    return m;
  }, [teilnehmer]);

  return { veranstaltungsort, setVeranstaltungsort, referenten, setReferenten, veranstaltungen, setVeranstaltungen, teilnehmer, setTeilnehmer, anmeldungen, setAnmeldungen, teilnehmerAnmeldung, setTeilnehmerAnmeldung, loading, error, fetchAll, veranstaltungsortMap, referentenMap, veranstaltungenMap, teilnehmerMap };
}