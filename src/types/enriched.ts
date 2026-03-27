import type { Anmeldungen, TeilnehmerAnmeldung, Veranstaltungen } from './app';

export type EnrichedVeranstaltungen = Veranstaltungen & {
  veranstaltungsort_refName: string;
  referenten_refName: string;
};

export type EnrichedTeilnehmerAnmeldung = TeilnehmerAnmeldung & {
  ta_veranstaltungName: string;
};

export type EnrichedAnmeldungen = Anmeldungen & {
  anm_veranstaltungName: string;
  anm_teilnehmerName: string;
};
