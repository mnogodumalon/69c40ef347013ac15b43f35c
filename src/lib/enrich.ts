import type { EnrichedAnmeldungen, EnrichedTeilnehmerAnmeldung, EnrichedVeranstaltungen } from '@/types/enriched';
import type { Anmeldungen, Referenten, Teilnehmer, TeilnehmerAnmeldung, Veranstaltungen, Veranstaltungsort } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function resolveDisplay(url: unknown, map: Map<string, any>, ...fields: string[]): string {
  if (!url) return '';
  const id = extractRecordId(url);
  if (!id) return '';
  const r = map.get(id);
  if (!r) return '';
  return fields.map(f => String(r.fields[f] ?? '')).join(' ').trim();
}

interface VeranstaltungenMaps {
  veranstaltungsortMap: Map<string, Veranstaltungsort>;
  referentenMap: Map<string, Referenten>;
}

export function enrichVeranstaltungen(
  veranstaltungen: Veranstaltungen[],
  maps: VeranstaltungenMaps
): EnrichedVeranstaltungen[] {
  return veranstaltungen.map(r => ({
    ...r,
    veranstaltungsort_refName: resolveDisplay(r.fields.veranstaltungsort_ref, maps.veranstaltungsortMap, 'ort_name'),
    referenten_refName: resolveDisplay(r.fields.referenten_ref, maps.referentenMap, 'ref_vorname'),
  }));
}

interface AnmeldungenMaps {
  veranstaltungenMap: Map<string, Veranstaltungen>;
  teilnehmerMap: Map<string, Teilnehmer>;
}

export function enrichAnmeldungen(
  anmeldungen: Anmeldungen[],
  maps: AnmeldungenMaps
): EnrichedAnmeldungen[] {
  return anmeldungen.map(r => ({
    ...r,
    anm_veranstaltungName: resolveDisplay(r.fields.anm_veranstaltung, maps.veranstaltungenMap, 'event_titel'),
    anm_teilnehmerName: resolveDisplay(r.fields.anm_teilnehmer, maps.teilnehmerMap, 'tn_vorname'),
  }));
}

interface TeilnehmerAnmeldungMaps {
  veranstaltungenMap: Map<string, Veranstaltungen>;
}

export function enrichTeilnehmerAnmeldung(
  teilnehmerAnmeldung: TeilnehmerAnmeldung[],
  maps: TeilnehmerAnmeldungMaps
): EnrichedTeilnehmerAnmeldung[] {
  return teilnehmerAnmeldung.map(r => ({
    ...r,
    ta_veranstaltungName: resolveDisplay(r.fields.ta_veranstaltung, maps.veranstaltungenMap, 'event_titel'),
  }));
}
