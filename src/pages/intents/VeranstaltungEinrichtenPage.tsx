import { useState, useEffect, useCallback } from 'react';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { VeranstaltungsortDialog } from '@/components/dialogs/VeranstaltungsortDialog';
import { ReferentenDialog } from '@/components/dialogs/ReferentenDialog';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Veranstaltungen, Veranstaltungsort, Referenten } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import {
  IconCalendar,
  IconMapPin,
  IconMicrophone,
  IconCheck,
  IconRefresh,
  IconUsers,
  IconArrowRight,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Event wählen' },
  { label: 'Ort zuweisen' },
  { label: 'Referent zuweisen' },
  { label: 'Zusammenfassung' },
];

export default function VeranstaltungEinrichtenPage() {
  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<Veranstaltungen | null>(null);
  const [selectedOrt, setSelectedOrt] = useState<Veranstaltungsort | null>(null);
  const [selectedRef, setSelectedRef] = useState<Referenten | null>(null);
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [veranstaltungsort, setVeranstaltungsort] = useState<Veranstaltungsort[]>([]);
  const [referenten, setReferenten] = useState<Referenten[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [ortDialogOpen, setOrtDialogOpen] = useState(false);
  const [refDialogOpen, setRefDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    try {
      const [v, o, r] = await Promise.all([
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getVeranstaltungsort(),
        LivingAppsService.getReferenten(),
      ]);
      setVeranstaltungen(v);
      setVeranstaltungsort(o);
      setReferenten(r);
      return { v, o, r };
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
      return null;
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchAll().then((result) => {
      if (result) {
        // Deep-link: read ?eventId= from hash URL
        const hashSearch = window.location.hash.split('?')[1] ?? '';
        const params = new URLSearchParams(hashSearch);
        const eventId = params.get('eventId');
        if (eventId) {
          const found = result.v.find((ev) => ev.record_id === eventId);
          if (found) {
            setSelectedEvent(found);
            setStep(2);
          }
        }
      }
      setLoading(false);
    });
  }, [fetchAll]);

  const handleSelectEvent = (id: string) => {
    const ev = veranstaltungen.find((e) => e.record_id === id);
    if (ev) {
      setSelectedEvent(ev);
      setSelectedOrt(null);
      setSelectedRef(null);
      setStep(2);
    }
  };

  const handleSelectOrt = async (id: string) => {
    const ort = veranstaltungsort.find((o) => o.record_id === id);
    if (!ort || !selectedEvent) return;
    setSaving(true);
    try {
      await LivingAppsService.updateVeranstaltungenEntry(selectedEvent.record_id, {
        veranstaltungsort_ref: createRecordUrl(APP_IDS.VERANSTALTUNGSORT, ort.record_id),
      });
      setSelectedOrt(ort);
      const result = await fetchAll();
      if (result) {
        const refreshed = result.v.find((e) => e.record_id === selectedEvent.record_id);
        if (refreshed) setSelectedEvent(refreshed);
      }
      setStep(3);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleSelectRef = async (id: string) => {
    const ref = referenten.find((r) => r.record_id === id);
    if (!ref || !selectedEvent) return;
    setSaving(true);
    try {
      await LivingAppsService.updateVeranstaltungenEntry(selectedEvent.record_id, {
        referenten_ref: createRecordUrl(APP_IDS.REFERENTEN, ref.record_id),
      });
      setSelectedRef(ref);
      const result = await fetchAll();
      if (result) {
        const refreshed = result.v.find((e) => e.record_id === selectedEvent.record_id);
        if (refreshed) setSelectedEvent(refreshed);
      }
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedEvent(null);
    setSelectedOrt(null);
    setSelectedRef(null);
    setStep(1);
  };

  // Build ort/ref name maps for step 1 display
  const ortMap = new Map(veranstaltungsort.map((o) => [o.record_id, o]));
  const refMap = new Map(referenten.map((r) => [r.record_id, r]));

  // Resolve currently assigned venue and speaker for the selected event
  const currentOrtId = selectedEvent ? extractRecordId(selectedEvent.fields.veranstaltungsort_ref) : null;
  const currentRefId = selectedEvent ? extractRecordId(selectedEvent.fields.referenten_ref) : null;
  const currentOrt = currentOrtId ? ortMap.get(currentOrtId) ?? null : null;
  const currentRef = currentRefId ? refMap.get(currentRefId) ?? null : null;

  return (
    <IntentWizardShell
      title="Veranstaltung einrichten"
      subtitle="Weise einem Event einen Veranstaltungsort und einen Referenten zu."
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setLoading(true); fetchAll().then(() => setLoading(false)); }}
    >
      {/* Step 1: Event wählen */}
      {step === 1 && (
        <div className="space-y-4">
          <EntitySelectStep
            items={veranstaltungen.map((ev) => {
              const ortId = extractRecordId(ev.fields.veranstaltungsort_ref);
              const refId = extractRecordId(ev.fields.referenten_ref);
              const evOrt = ortId ? ortMap.get(ortId) : undefined;
              const evRef = refId ? refMap.get(refId) : undefined;
              const ortName = evOrt?.fields.ort_name ?? '—';
              const refName = evRef
                ? [evRef.fields.ref_vorname, evRef.fields.ref_nachname].filter(Boolean).join(' ') || '—'
                : '—';
              const subtitleParts: string[] = [];
              if (ev.fields.event_start) subtitleParts.push(formatDate(ev.fields.event_start));
              if (ev.fields.event_kategorie?.label) subtitleParts.push(ev.fields.event_kategorie.label);
              return {
                id: ev.record_id,
                title: ev.fields.event_titel ?? '(Kein Titel)',
                subtitle: subtitleParts.join(' · ') || undefined,
                status: ev.fields.event_status,
                stats: [
                  { label: 'Ort', value: ortName },
                  { label: 'Referent', value: refName },
                ],
                icon: <IconCalendar size={18} className="text-primary" />,
              };
            })}
            onSelect={handleSelectEvent}
            searchPlaceholder="Event suchen..."
            emptyIcon={<IconCalendar size={32} />}
            emptyText="Keine Veranstaltungen gefunden."
            createLabel="Neue Veranstaltung anlegen"
            onCreateNew={() => setEventDialogOpen(true)}
            createDialog={
              <VeranstaltungenDialog
                open={eventDialogOpen}
                onClose={() => setEventDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createVeranstaltungenEntry(fields);
                  const result = await fetchAll();
                  if (result) {
                    // Auto-select newly created event (last in list)
                    const newest = result.v[result.v.length - 1];
                    if (newest) {
                      setSelectedEvent(newest);
                      setStep(2);
                    }
                  }
                  setEventDialogOpen(false);
                }}
                veranstaltungsortList={veranstaltungsort}
                referentenList={referenten}
                enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
              />
            }
          />
        </div>
      )}

      {/* Step 2: Ort zuweisen */}
      {step === 2 && selectedEvent && (
        <div className="space-y-4">
          {/* Context card */}
          <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconCalendar size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {selectedEvent.fields.event_titel ?? '(Kein Titel)'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {selectedEvent.fields.event_kategorie && (
                  <span className="text-xs text-muted-foreground">
                    {selectedEvent.fields.event_kategorie.label}
                  </span>
                )}
                {selectedEvent.fields.event_status && (
                  <StatusBadge
                    statusKey={selectedEvent.fields.event_status.key}
                    label={selectedEvent.fields.event_status.label}
                  />
                )}
                {selectedEvent.fields.event_start && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(selectedEvent.fields.event_start)}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Wähle einen Veranstaltungsort für dieses Event aus.
          </p>

          {saving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconRefresh size={16} className="animate-spin" />
              Speichere...
            </div>
          )}

          <EntitySelectStep
            items={veranstaltungsort.map((ort) => {
              const isCurrentOrt = ort.record_id === currentOrtId;
              const addressParts = [
                ort.fields.strasse,
                ort.fields.hausnummer,
                ort.fields.plz ? ', ' + ort.fields.plz : undefined,
                ort.fields.stadt,
              ].filter(Boolean);
              return {
                id: ort.record_id,
                title: isCurrentOrt
                  ? (ort.fields.ort_name ?? '(Kein Name)') + ' ✓'
                  : (ort.fields.ort_name ?? '(Kein Name)'),
                subtitle: addressParts.join(' ') || undefined,
                stats: [{ label: 'Kapazität', value: ort.fields.kapazitaet ? String(ort.fields.kapazitaet) : '—' }],
                icon: <IconMapPin size={18} className={isCurrentOrt ? 'text-green-600' : 'text-primary'} />,
              };
            })}
            onSelect={handleSelectOrt}
            searchPlaceholder="Ort suchen..."
            emptyIcon={<IconMapPin size={32} />}
            emptyText="Keine Veranstaltungsorte gefunden."
            createLabel="Neuen Ort anlegen"
            onCreateNew={() => setOrtDialogOpen(true)}
            createDialog={
              <VeranstaltungsortDialog
                open={ortDialogOpen}
                onClose={() => setOrtDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createVeranstaltungsortEntry(fields);
                  const result = await fetchAll();
                  if (result) {
                    const newest = result.o[result.o.length - 1];
                    if (newest) await handleSelectOrt(newest.record_id);
                  }
                  setOrtDialogOpen(false);
                }}
                enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungsort']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungsort']}
              />
            }
          />

          {selectedOrt && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <IconCheck size={15} />
              <span>Ausgewählt: <strong>{selectedOrt.fields.ort_name}</strong></span>
            </div>
          )}

          {currentOrt && !selectedOrt && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <IconMapPin size={15} />
              <span>Aktuell zugewiesen: <strong>{currentOrt.fields.ort_name}</strong></span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(1)}>
              Zurück
            </Button>
            {currentOrt && (
              <Button variant="ghost" onClick={() => { setSelectedOrt(currentOrt); setStep(3); }}>
                Aktuellen Ort behalten
                <IconArrowRight size={16} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Referent zuweisen */}
      {step === 3 && selectedEvent && (
        <div className="space-y-4">
          {/* Context card */}
          <div className="rounded-xl border bg-card p-4 flex flex-wrap items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconCalendar size={18} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate">
                {selectedEvent.fields.event_titel ?? '(Kein Titel)'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-0.5">
                {selectedOrt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <IconMapPin size={12} />
                    {selectedOrt.fields.ort_name}
                  </span>
                )}
                {currentOrt && !selectedOrt && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <IconMapPin size={12} />
                    {currentOrt.fields.ort_name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Wähle einen Referenten für dieses Event aus.
          </p>

          {saving && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <IconRefresh size={16} className="animate-spin" />
              Speichere...
            </div>
          )}

          <EntitySelectStep
            items={referenten.map((ref) => {
              const isCurrentRef = ref.record_id === currentRefId;
              const fullName = [ref.fields.ref_vorname, ref.fields.ref_nachname].filter(Boolean).join(' ');
              return {
                id: ref.record_id,
                title: isCurrentRef ? (fullName || '(Kein Name)') + ' ✓' : (fullName || '(Kein Name)'),
                subtitle: ref.fields.ref_fachgebiet ?? ref.fields.ref_email ?? undefined,
                stats: [{ label: 'Webseite', value: ref.fields.ref_webseite ? '✓' : '—' }],
                icon: <IconMicrophone size={18} className={isCurrentRef ? 'text-green-600' : 'text-primary'} />,
              };
            })}
            onSelect={handleSelectRef}
            searchPlaceholder="Referenten suchen..."
            emptyIcon={<IconMicrophone size={32} />}
            emptyText="Keine Referenten gefunden."
            createLabel="Neuen Referenten anlegen"
            onCreateNew={() => setRefDialogOpen(true)}
            createDialog={
              <ReferentenDialog
                open={refDialogOpen}
                onClose={() => setRefDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createReferentenEntry(fields);
                  const result = await fetchAll();
                  if (result) {
                    const newest = result.r[result.r.length - 1];
                    if (newest) await handleSelectRef(newest.record_id);
                  }
                  setRefDialogOpen(false);
                }}
                enablePhotoScan={AI_PHOTO_SCAN['Referenten']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Referenten']}
              />
            }
          />

          {selectedRef && (
            <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">
              <IconCheck size={15} />
              <span>
                Ausgewählt: <strong>
                  {[selectedRef.fields.ref_vorname, selectedRef.fields.ref_nachname].filter(Boolean).join(' ')}
                </strong>
                {selectedRef.fields.ref_fachgebiet && (
                  <span className="text-green-600 ml-1">· {selectedRef.fields.ref_fachgebiet}</span>
                )}
              </span>
            </div>
          )}

          {currentRef && !selectedRef && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/40 rounded-lg px-3 py-2">
              <IconMicrophone size={15} />
              <span>
                Aktuell zugewiesen: <strong>
                  {[currentRef.fields.ref_vorname, currentRef.fields.ref_nachname].filter(Boolean).join(' ')}
                </strong>
              </span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              Zurück
            </Button>
            {currentRef && (
              <Button variant="ghost" onClick={() => { setSelectedRef(currentRef); setStep(4); }}>
                Aktuellen Referenten behalten
                <IconArrowRight size={16} className="ml-1" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Step 4: Zusammenfassung */}
      {step === 4 && selectedEvent && (
        <div className="space-y-4">
          {/* Success header */}
          <div className="rounded-xl border bg-green-50 border-green-200 p-5 flex items-start gap-4 overflow-hidden">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
              <IconCheck size={20} className="text-green-600" stroke={2.5} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-green-700">Veranstaltung erfolgreich eingerichtet</p>
              <h2 className="text-xl font-bold text-foreground mt-1 truncate">
                {selectedEvent.fields.event_titel ?? '(Kein Titel)'}
              </h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {selectedEvent.fields.event_kategorie && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border bg-blue-100 text-blue-700 border-blue-200">
                    {selectedEvent.fields.event_kategorie.label}
                  </span>
                )}
                {selectedEvent.fields.event_status && (
                  <StatusBadge
                    statusKey={selectedEvent.fields.event_status.key}
                    label={selectedEvent.fields.event_status.label}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Details grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Datum */}
            <div className="rounded-xl border bg-card p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <IconCalendar size={16} className="text-muted-foreground shrink-0" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Zeitraum</p>
              </div>
              <p className="text-sm font-medium">
                {formatDate(selectedEvent.fields.event_start)}
                {selectedEvent.fields.event_ende && selectedEvent.fields.event_ende !== selectedEvent.fields.event_start && (
                  <span className="text-muted-foreground"> → {formatDate(selectedEvent.fields.event_ende)}</span>
                )}
              </p>
              {selectedEvent.fields.event_max_teilnehmer && (
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <IconUsers size={12} />
                  Max. {selectedEvent.fields.event_max_teilnehmer} Teilnehmer
                </p>
              )}
            </div>

            {/* Veranstaltungsort */}
            <div className="rounded-xl border bg-card p-4 overflow-hidden">
              <div className="flex items-center gap-2 mb-2">
                <IconMapPin size={16} className="text-muted-foreground shrink-0" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Veranstaltungsort</p>
              </div>
              {(() => {
                const ort = selectedOrt ?? currentOrt;
                if (ort) {
                  return (
                    <>
                      <p className="text-sm font-medium truncate">{ort.fields.ort_name ?? '—'}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {[ort.fields.strasse, ort.fields.hausnummer].filter(Boolean).join(' ')}
                        {(ort.fields.plz || ort.fields.stadt) && (
                          <span>, {[ort.fields.plz, ort.fields.stadt].filter(Boolean).join(' ')}</span>
                        )}
                      </p>
                    </>
                  );
                }
                return <p className="text-sm text-muted-foreground">Kein Ort zugewiesen</p>;
              })()}
            </div>

            {/* Referent */}
            <div className="rounded-xl border bg-card p-4 overflow-hidden sm:col-span-2">
              <div className="flex items-center gap-2 mb-2">
                <IconMicrophone size={16} className="text-muted-foreground shrink-0" />
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Referent</p>
              </div>
              {(() => {
                const ref = selectedRef ?? currentRef;
                if (ref) {
                  const fullName = [ref.fields.ref_vorname, ref.fields.ref_nachname].filter(Boolean).join(' ');
                  return (
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <p className="text-sm font-medium">{fullName || '—'}</p>
                      {ref.fields.ref_fachgebiet && (
                        <p className="text-xs text-muted-foreground self-center">{ref.fields.ref_fachgebiet}</p>
                      )}
                      {ref.fields.ref_email && (
                        <p className="text-xs text-muted-foreground self-center">{ref.fields.ref_email}</p>
                      )}
                    </div>
                  );
                }
                return <p className="text-sm text-muted-foreground">Kein Referent zugewiesen</p>;
              })()}
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <Button variant="outline" onClick={handleReset}>
              <IconCalendar size={16} className="mr-2" />
              Weitere Veranstaltung einrichten
            </Button>
            <Button asChild>
              <a href={`#/intents/teilnehmer-anmelden?eventId=${selectedEvent.record_id}`}>
                <IconUsers size={16} className="mr-2" />
                Anmeldungen verwalten
              </a>
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
