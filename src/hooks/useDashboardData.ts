import { useState, useEffect, useMemo, useCallback } from 'react';
import type { Veranstaltungen, TeilnehmerAnmeldung, Teilnehmer, Veranstaltungsort, Referenten, Anmeldungen } from '@/types/app';
import { LivingAppsService } from '@/services/livingAppsService';

export function useDashboardData() {
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [teilnehmerAnmeldung, setTeilnehmerAnmeldung] = useState<TeilnehmerAnmeldung[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [veranstaltungsort, setVeranstaltungsort] = useState<Veranstaltungsort[]>([]);
  const [referenten, setReferenten] = useState<Referenten[]>([]);
  const [anmeldungen, setAnmeldungen] = useState<Anmeldungen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [veranstaltungenData, teilnehmerAnmeldungData, teilnehmerData, veranstaltungsortData, referentenData, anmeldungenData] = await Promise.all([
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getTeilnehmerAnmeldung(),
        LivingAppsService.getTeilnehmer(),
        LivingAppsService.getVeranstaltungsort(),
        LivingAppsService.getReferenten(),
        LivingAppsService.getAnmeldungen(),
      ]);
      setVeranstaltungen(veranstaltungenData);
      setTeilnehmerAnmeldung(teilnehmerAnmeldungData);
      setTeilnehmer(teilnehmerData);
      setVeranstaltungsort(veranstaltungsortData);
      setReferenten(referentenData);
      setAnmeldungen(anmeldungenData);
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
        const [veranstaltungenData, teilnehmerAnmeldungData, teilnehmerData, veranstaltungsortData, referentenData, anmeldungenData] = await Promise.all([
          LivingAppsService.getVeranstaltungen(),
          LivingAppsService.getTeilnehmerAnmeldung(),
          LivingAppsService.getTeilnehmer(),
          LivingAppsService.getVeranstaltungsort(),
          LivingAppsService.getReferenten(),
          LivingAppsService.getAnmeldungen(),
        ]);
        setVeranstaltungen(veranstaltungenData);
        setTeilnehmerAnmeldung(teilnehmerAnmeldungData);
        setTeilnehmer(teilnehmerData);
        setVeranstaltungsort(veranstaltungsortData);
        setReferenten(referentenData);
        setAnmeldungen(anmeldungenData);
      } catch {
        // silently ignore — stale data is better than no data
      }
    }
    function handleRefresh() { void silentRefresh(); }
    window.addEventListener('dashboard-refresh', handleRefresh);
    return () => window.removeEventListener('dashboard-refresh', handleRefresh);
  }, []);

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

  return { veranstaltungen, setVeranstaltungen, teilnehmerAnmeldung, setTeilnehmerAnmeldung, teilnehmer, setTeilnehmer, veranstaltungsort, setVeranstaltungsort, referenten, setReferenten, anmeldungen, setAnmeldungen, loading, error, fetchAll, veranstaltungenMap, teilnehmerMap, veranstaltungsortMap, referentenMap };
}