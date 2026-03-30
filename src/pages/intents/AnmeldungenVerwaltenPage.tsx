import { useState, useEffect, useMemo } from 'react';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS } from '@/types/app';
import type { Veranstaltungen, Anmeldungen, Teilnehmer } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { Button } from '@/components/ui/button';
import {
  IconCalendar,
  IconUsers,
  IconCheck,
  IconX,
  IconClock,
  IconRefresh,
  IconAlertCircle,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Event wählen' },
  { label: 'Status bearbeiten' },
  { label: 'Fertig' },
];

type StatusChange = { anmId: string; oldStatus: string | undefined; newStatus: string };

function statusBadgeClass(key?: string): string {
  switch (key) {
    case 'bestaetigt': return 'bg-green-100 text-green-700';
    case 'ausstehend': return 'bg-yellow-100 text-yellow-700';
    case 'storniert': return 'bg-red-100 text-red-700';
    case 'warteliste': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

export default function AnmeldungenVerwaltenPage() {
  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<Veranstaltungen | null>(null);
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [anmeldungen, setAnmeldungen] = useState<Anmeldungen[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState<string | null>(null); // anmId currently being saved
  const [localStatuses, setLocalStatuses] = useState<Map<string, string>>(new Map());
  const [changes, setChanges] = useState<StatusChange[]>([]);

  const fetchAll = async () => {
    try {
      const [v, anm, tn] = await Promise.all([
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getAnmeldungen(),
        LivingAppsService.getTeilnehmer(),
      ]);
      setVeranstaltungen(v);
      setAnmeldungen(anm);
      setTeilnehmer(tn);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Deep-link: ?eventId= from URL hash
  useEffect(() => {
    if (loading) return;
    const hash = window.location.hash;
    const queryStart = hash.indexOf('?');
    if (queryStart === -1) return;
    const params = new URLSearchParams(hash.slice(queryStart + 1));
    const eventId = params.get('eventId');
    if (!eventId) return;
    const found = veranstaltungen.find(v => v.record_id === eventId);
    if (found) {
      setSelectedEvent(found);
      setStep(2);
    }
  }, [loading, veranstaltungen]);

  // Count anmeldungen per event and by status
  const anmCountByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const anm of anmeldungen) {
      const id = extractRecordId(anm.fields.anm_veranstaltung);
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [anmeldungen]);

  const pendingCountByEvent = useMemo(() => {
    const map = new Map<string, number>();
    for (const anm of anmeldungen) {
      const id = extractRecordId(anm.fields.anm_veranstaltung);
      const status = anm.fields.anm_status?.key;
      if (id && (status === 'ausstehend' || status === 'warteliste')) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }, [anmeldungen]);

  // Anmeldungen for selected event
  const eventAnmeldungen = useMemo(() => {
    if (!selectedEvent) return [];
    const eventUrl = createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent.record_id);
    return anmeldungen.filter(anm => anm.fields.anm_veranstaltung === eventUrl);
  }, [anmeldungen, selectedEvent]);

  const teilnehmerMap = useMemo(
    () => new Map(teilnehmer.map(tn => [tn.record_id, tn])),
    [teilnehmer]
  );

  function getAnmName(anm: Anmeldungen): string {
    const id = extractRecordId(anm.fields.anm_teilnehmer);
    if (!id) return '—';
    const tn = teilnehmerMap.get(id);
    if (!tn) return '—';
    return `${tn.fields.tn_vorname ?? ''} ${tn.fields.tn_nachname ?? ''}`.trim() || '—';
  }

  function getAnmEmail(anm: Anmeldungen): string | undefined {
    const id = extractRecordId(anm.fields.anm_teilnehmer);
    if (!id) return undefined;
    return teilnehmerMap.get(id)?.fields.tn_email ?? undefined;
  }

  function getCurrentStatus(anm: Anmeldungen): string | undefined {
    return localStatuses.get(anm.record_id) ?? anm.fields.anm_status?.key;
  }

  function getCurrentStatusLabel(key: string | undefined): string {
    switch (key) {
      case 'bestaetigt': return 'Bestätigt';
      case 'ausstehend': return 'Ausstehend';
      case 'storniert': return 'Storniert';
      case 'warteliste': return 'Warteliste';
      default: return key ?? '—';
    }
  }

  async function handleStatusChange(anm: Anmeldungen, newStatus: string) {
    const oldStatus = anm.fields.anm_status?.key;
    if (getCurrentStatus(anm) === newStatus) return;
    setSaving(anm.record_id);
    try {
      await LivingAppsService.updateAnmeldungenEntry(anm.record_id, { anm_status: newStatus });
      setLocalStatuses(prev => new Map(prev).set(anm.record_id, newStatus));
      setChanges(prev => {
        const existing = prev.findIndex(c => c.anmId === anm.record_id);
        const entry: StatusChange = { anmId: anm.record_id, oldStatus, newStatus };
        if (existing >= 0) {
          const next = [...prev];
          next[existing] = entry;
          return next;
        }
        return [...prev, entry];
      });
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Fehler beim Speichern'));
    } finally {
      setSaving(null);
    }
  }

  const handleSelectEvent = (id: string) => {
    const ev = veranstaltungen.find(v => v.record_id === id);
    if (ev) {
      setSelectedEvent(ev);
      setLocalStatuses(new Map());
      setChanges([]);
      setStep(2);
    }
  };

  const handleReset = () => {
    setSelectedEvent(null);
    setLocalStatuses(new Map());
    setChanges([]);
    setStep(1);
  };

  const changedCount = changes.length;
  const confirmedCount = [...localStatuses.values()].filter(s => s === 'bestaetigt').length;
  const cancelledCount = [...localStatuses.values()].filter(s => s === 'storniert').length;
  const waitlistCount = [...localStatuses.values()].filter(s => s === 'warteliste').length;

  return (
    <IntentWizardShell
      title="Anmeldestatus bearbeiten"
      subtitle="Bestätige, storniere oder setze Anmeldungen auf die Warteliste."
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setLoading(true); fetchAll(); }}
    >
      {/* Step 1: Event wählen */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Veranstaltung auswählen</h2>
            <p className="text-sm text-muted-foreground">
              Wähle die Veranstaltung, deren Anmeldungen du bearbeiten möchtest.
            </p>
          </div>
          <EntitySelectStep
            items={veranstaltungen.map(ev => {
              const total = anmCountByEvent.get(ev.record_id) ?? 0;
              const pending = pendingCountByEvent.get(ev.record_id) ?? 0;
              return {
                id: ev.record_id,
                title: ev.fields.event_titel ?? '(Ohne Titel)',
                subtitle: [
                  ev.fields.event_start ? formatDate(ev.fields.event_start) : null,
                  ev.fields.event_kategorie?.label,
                ].filter(Boolean).join(' · '),
                status: ev.fields.event_status,
                stats: [
                  { label: 'Anmeldungen', value: total },
                  { label: 'Ausstehend', value: pending },
                ],
                icon: <IconCalendar size={18} className={pending > 0 ? 'text-amber-500' : 'text-primary'} />,
              };
            })}
            onSelect={handleSelectEvent}
            searchPlaceholder="Veranstaltung suchen..."
            emptyIcon={<IconCalendar size={32} />}
            emptyText="Keine Veranstaltungen gefunden."
          />
        </div>
      )}

      {/* Step 2: Status bearbeiten */}
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
                {selectedEvent.fields.event_start && (
                  <span className="text-xs text-muted-foreground">
                    {formatDate(selectedEvent.fields.event_start)}
                  </span>
                )}
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
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-1 rounded-full">
                {eventAnmeldungen.length} Anmeldungen
              </span>
            </div>
          </div>

          {/* Status legend */}
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-yellow-100 text-yellow-700">
              <IconClock size={12} /> Ausstehend
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-green-100 text-green-700">
              <IconCheck size={12} /> Bestätigt
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700">
              <IconUsers size={12} /> Warteliste
            </span>
            <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-red-100 text-red-700">
              <IconX size={12} /> Storniert
            </span>
          </div>

          {eventAnmeldungen.length === 0 ? (
            <div className="text-center py-12 rounded-xl border bg-card">
              <IconUsers size={36} className="text-muted-foreground mx-auto mb-2 opacity-40" stroke={1.5} />
              <p className="text-sm font-medium text-foreground">Keine Anmeldungen</p>
              <p className="text-xs text-muted-foreground mt-1">
                Für diese Veranstaltung gibt es noch keine Anmeldungen.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {eventAnmeldungen.map(anm => {
                const currentStatus = getCurrentStatus(anm);
                const isSaving = saving === anm.record_id;
                const hasChanged = localStatuses.has(anm.record_id);
                const name = getAnmName(anm);
                const email = getAnmEmail(anm);

                return (
                  <div
                    key={anm.record_id}
                    className={`rounded-xl border p-4 transition-all ${
                      hasChanged ? 'border-primary/30 bg-primary/5' : 'border-border bg-card'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-foreground truncate">{name}</p>
                          {hasChanged && (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                              geändert
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {email && (
                            <span className="text-xs text-muted-foreground truncate">{email}</span>
                          )}
                          {anm.fields.anm_datum && (
                            <span className="text-xs text-muted-foreground">
                              {formatDate(anm.fields.anm_datum)}
                            </span>
                          )}
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadgeClass(currentStatus)}`}>
                            {getCurrentStatusLabel(currentStatus)}
                          </span>
                        </div>
                      </div>

                      {/* Quick action buttons */}
                      <div className="flex gap-1.5 flex-wrap shrink-0">
                        {isSaving ? (
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground px-2 py-1.5">
                            <IconRefresh size={13} className="animate-spin" />
                            Speichert...
                          </div>
                        ) : (
                          <>
                            <button
                              onClick={() => handleStatusChange(anm, 'bestaetigt')}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                currentStatus === 'bestaetigt'
                                  ? 'bg-green-500 text-white border-green-500'
                                  : 'bg-card border-border text-muted-foreground hover:border-green-400 hover:text-green-700 hover:bg-green-50'
                              }`}
                              title="Bestätigen"
                            >
                              <IconCheck size={12} className="shrink-0" />
                              <span className="hidden sm:inline">Bestätigen</span>
                            </button>
                            <button
                              onClick={() => handleStatusChange(anm, 'warteliste')}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                currentStatus === 'warteliste'
                                  ? 'bg-orange-500 text-white border-orange-500'
                                  : 'bg-card border-border text-muted-foreground hover:border-orange-400 hover:text-orange-700 hover:bg-orange-50'
                              }`}
                              title="Auf Warteliste"
                            >
                              <IconUsers size={12} className="shrink-0" />
                              <span className="hidden sm:inline">Warteliste</span>
                            </button>
                            <button
                              onClick={() => handleStatusChange(anm, 'storniert')}
                              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                currentStatus === 'storniert'
                                  ? 'bg-red-500 text-white border-red-500'
                                  : 'bg-card border-border text-muted-foreground hover:border-red-400 hover:text-red-700 hover:bg-red-50'
                              }`}
                              title="Stornieren"
                            >
                              <IconX size={12} className="shrink-0" />
                              <span className="hidden sm:inline">Stornieren</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Error feedback */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <IconAlertCircle size={15} />
              <span>{error.message}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-3 border-t gap-3 flex-wrap">
            <div className="text-sm text-muted-foreground">
              {changedCount > 0 ? (
                <span>
                  <span className="font-semibold text-foreground">{changedCount}</span> Status geändert
                </span>
              ) : (
                <span>Noch keine Änderungen</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={changedCount === 0}
              >
                Fertig ({changedCount})
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Step 3: Fertig */}
      {step === 3 && selectedEvent && (
        <div className="space-y-6">
          {/* Success header */}
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <IconCheck size={32} className="text-green-600" stroke={2.5} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              {changedCount} Anmeldung{changedCount !== 1 ? 'en' : ''} aktualisiert
            </h2>
            <p className="text-sm text-muted-foreground">
              Für „{selectedEvent.fields.event_titel}"
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border bg-green-50 border-green-200 p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{confirmedCount}</p>
              <p className="text-xs text-green-600 mt-0.5">Bestätigt</p>
            </div>
            <div className="rounded-xl border bg-orange-50 border-orange-200 p-3 text-center">
              <p className="text-2xl font-bold text-orange-700">{waitlistCount}</p>
              <p className="text-xs text-orange-600 mt-0.5">Warteliste</p>
            </div>
            <div className="rounded-xl border bg-red-50 border-red-200 p-3 text-center">
              <p className="text-2xl font-bold text-red-700">{cancelledCount}</p>
              <p className="text-xs text-red-600 mt-0.5">Storniert</p>
            </div>
          </div>

          {/* Changes list */}
          {changes.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <h3 className="font-medium text-sm text-foreground mb-3">Vorgenommene Änderungen</h3>
              {changes.map(change => {
                const anm = anmeldungen.find(a => a.record_id === change.anmId);
                if (!anm) return null;
                return (
                  <div key={change.anmId} className="flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      change.newStatus === 'bestaetigt' ? 'bg-green-500' :
                      change.newStatus === 'warteliste' ? 'bg-orange-500' :
                      change.newStatus === 'storniert' ? 'bg-red-500' : 'bg-gray-400'
                    }`} />
                    <span className="font-medium flex-1 min-w-0 truncate">{getAnmName(anm)}</span>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${statusBadgeClass(change.oldStatus)}`}>
                        {getCurrentStatusLabel(change.oldStatus)}
                      </span>
                      <IconCheck size={12} className="text-muted-foreground shrink-0" />
                      <span className={`text-[11px] px-1.5 py-0.5 rounded-full ${statusBadgeClass(change.newStatus)}`}>
                        {getCurrentStatusLabel(change.newStatus)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => { setLocalStatuses(new Map()); setChanges([]); setStep(2); }}>
              <IconUsers size={16} className="mr-2" />
              Weitere Anmeldungen bearbeiten
            </Button>
            <Button className="flex-1" onClick={handleReset}>
              <IconCalendar size={16} className="mr-2" />
              Anderes Event wählen
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
