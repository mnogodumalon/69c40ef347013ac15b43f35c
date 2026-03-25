// AUTOMATICALLY GENERATED TYPES - DO NOT EDIT

export type LookupValue = { key: string; label: string };
export type GeoLocation = { lat: number; long: number; info?: string };

export interface Veranstaltungsort {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    ort_name?: string;
    strasse?: string;
    hausnummer?: string;
    plz?: string;
    stadt?: string;
    land?: string;
    geo_ort?: GeoLocation; // { lat, long, info }
    kapazitaet?: number;
    notizen_ort?: string;
  };
}

export interface Referenten {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    ref_vorname?: string;
    ref_nachname?: string;
    ref_email?: string;
    ref_telefon?: string;
    ref_fachgebiet?: string;
    ref_biografie?: string;
    ref_foto?: string;
    ref_webseite?: string;
  };
}

export interface Veranstaltungen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    event_titel?: string;
    event_beschreibung?: string;
    event_kategorie?: LookupValue;
    event_status?: LookupValue;
    event_start?: string; // Format: YYYY-MM-DD oder ISO String
    event_ende?: string; // Format: YYYY-MM-DD oder ISO String
    event_max_teilnehmer?: number;
    veranstaltungsort_ref?: string; // applookup -> URL zu 'Veranstaltungsort' Record
    referenten_ref?: string; // applookup -> URL zu 'Referenten' Record
    event_bild?: string;
    event_notizen?: string;
  };
}

export interface Teilnehmer {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    tn_vorname?: string;
    tn_nachname?: string;
    tn_email?: string;
    tn_telefon?: string;
    tn_ernaehrung?: LookupValue[];
    tn_notizen?: string;
  };
}

export interface Anmeldungen {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    anm_veranstaltung?: string; // applookup -> URL zu 'Veranstaltungen' Record
    anm_teilnehmer?: string; // applookup -> URL zu 'Teilnehmer' Record
    anm_datum?: string; // Format: YYYY-MM-DD oder ISO String
    anm_status?: LookupValue;
    anm_notizen?: string;
  };
}

export interface TeilnehmerAnmeldung {
  record_id: string;
  createdat: string;
  updatedat: string | null;
  fields: {
    ta_veranstaltung?: string; // applookup -> URL zu 'Veranstaltungen' Record
    ta_vorname?: string;
    ta_nachname?: string;
    ta_email?: string;
    ta_telefon?: string;
    ta_ernaehrung?: LookupValue[];
    ta_notizen?: string;
  };
}

export const APP_IDS = {
  VERANSTALTUNGSORT: '69c40ebc8c550314b139b89d',
  REFERENTEN: '69c40eca8952a961b0ebc8c2',
  VERANSTALTUNGEN: '69c40eca182caae214eb183f',
  TEILNEHMER: '69c40ecbe70eb034258a3776',
  ANMELDUNGEN: '69c40ecbd9510645d8034890',
  TEILNEHMER_ANMELDUNG: '69c40ecc3a4966b30529982f',
} as const;


export const LOOKUP_OPTIONS: Record<string, Record<string, {key: string, label: string}[]>> = {
  'veranstaltungen': {
    event_kategorie: [{ key: "konferenz", label: "Konferenz" }, { key: "workshop", label: "Workshop" }, { key: "seminar", label: "Seminar" }, { key: "networking", label: "Networking" }, { key: "messe", label: "Messe" }, { key: "sonstiges", label: "Sonstiges" }],
    event_status: [{ key: "geplant", label: "Geplant" }, { key: "bestaetigt", label: "Bestätigt" }, { key: "abgesagt", label: "Abgesagt" }, { key: "abgeschlossen", label: "Abgeschlossen" }],
  },
  'teilnehmer': {
    tn_ernaehrung: [{ key: "vegetarisch", label: "Vegetarisch" }, { key: "vegan", label: "Vegan" }, { key: "glutenfrei", label: "Glutenfrei" }, { key: "laktosefrei", label: "Laktosefrei" }, { key: "keine", label: "Keine" }],
  },
  'anmeldungen': {
    anm_status: [{ key: "ausstehend", label: "Ausstehend" }, { key: "bestaetigt", label: "Bestätigt" }, { key: "storniert", label: "Storniert" }, { key: "warteliste", label: "Warteliste" }],
  },
  'teilnehmer_anmeldung': {
    ta_ernaehrung: [{ key: "vegetarisch", label: "Vegetarisch" }, { key: "vegan", label: "Vegan" }, { key: "glutenfrei", label: "Glutenfrei" }, { key: "laktosefrei", label: "Laktosefrei" }, { key: "keine", label: "Keine" }],
  },
};

export const FIELD_TYPES: Record<string, Record<string, string>> = {
  'veranstaltungsort': {
    'ort_name': 'string/text',
    'strasse': 'string/text',
    'hausnummer': 'string/text',
    'plz': 'string/text',
    'stadt': 'string/text',
    'land': 'string/text',
    'geo_ort': 'geo',
    'kapazitaet': 'number',
    'notizen_ort': 'string/textarea',
  },
  'referenten': {
    'ref_vorname': 'string/text',
    'ref_nachname': 'string/text',
    'ref_email': 'string/email',
    'ref_telefon': 'string/tel',
    'ref_fachgebiet': 'string/text',
    'ref_biografie': 'string/textarea',
    'ref_foto': 'file',
    'ref_webseite': 'string/url',
  },
  'veranstaltungen': {
    'event_titel': 'string/text',
    'event_beschreibung': 'string/textarea',
    'event_kategorie': 'lookup/select',
    'event_status': 'lookup/radio',
    'event_start': 'date/datetimeminute',
    'event_ende': 'date/datetimeminute',
    'event_max_teilnehmer': 'number',
    'veranstaltungsort_ref': 'applookup/select',
    'referenten_ref': 'applookup/select',
    'event_bild': 'file',
    'event_notizen': 'string/textarea',
  },
  'teilnehmer': {
    'tn_vorname': 'string/text',
    'tn_nachname': 'string/text',
    'tn_email': 'string/email',
    'tn_telefon': 'string/tel',
    'tn_ernaehrung': 'multiplelookup/checkbox',
    'tn_notizen': 'string/textarea',
  },
  'anmeldungen': {
    'anm_veranstaltung': 'applookup/select',
    'anm_teilnehmer': 'applookup/select',
    'anm_datum': 'date/date',
    'anm_status': 'lookup/radio',
    'anm_notizen': 'string/textarea',
  },
  'teilnehmer_anmeldung': {
    'ta_veranstaltung': 'applookup/select',
    'ta_vorname': 'string/text',
    'ta_nachname': 'string/text',
    'ta_email': 'string/email',
    'ta_telefon': 'string/tel',
    'ta_ernaehrung': 'multiplelookup/checkbox',
    'ta_notizen': 'string/textarea',
  },
};

type StripLookup<T> = {
  [K in keyof T]: T[K] extends LookupValue | undefined ? string | LookupValue | undefined
    : T[K] extends LookupValue[] | undefined ? string[] | LookupValue[] | undefined
    : T[K];
};

// Helper Types for creating new records (lookup fields as plain strings for API)
export type CreateVeranstaltungsort = StripLookup<Veranstaltungsort['fields']>;
export type CreateReferenten = StripLookup<Referenten['fields']>;
export type CreateVeranstaltungen = StripLookup<Veranstaltungen['fields']>;
export type CreateTeilnehmer = StripLookup<Teilnehmer['fields']>;
export type CreateAnmeldungen = StripLookup<Anmeldungen['fields']>;
export type CreateTeilnehmerAnmeldung = StripLookup<TeilnehmerAnmeldung['fields']>;