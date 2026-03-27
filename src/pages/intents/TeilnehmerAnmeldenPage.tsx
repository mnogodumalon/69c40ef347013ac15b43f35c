import { useState, useEffect, useMemo } from 'react';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { StatusBadge } from '@/components/StatusBadge';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { TeilnehmerDialog } from '@/components/dialogs/TeilnehmerDialog';
import { LivingAppsService, extractRecordId, createRecordUrl } from '@/services/livingAppsService';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import type { Veranstaltungen, Teilnehmer, Anmeldungen, Veranstaltungsort, Referenten } from '@/types/app';
import { formatDate } from '@/lib/formatters';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { IconCheck, IconUsers, IconPlus, IconSearch, IconCalendar, IconAlertCircle } from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Event wählen' },
  { label: 'Teilnehmer wählen' },
  { label: 'Anmeldungen erstellen' },
  { label: 'Fertig' },
];

const ANM_STATUS_OPTIONS = LOOKUP_OPTIONS['anmeldungen']?.anm_status ?? [];

export default function TeilnehmerAnmeldenPage() {
  const [step, setStep] = useState(1);
  const [selectedEvent, setSelectedEvent] = useState<Veranstaltungen | null>(null);
  const [selectedTeilnehmerIds, setSelectedTeilnehmerIds] = useState<Set<string>>(new Set());
  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [veranstaltungsort, setVeranstaltungsort] = useState<Veranstaltungsort[]>([]);
  const [referenten, setReferenten] = useState<Referenten[]>([]);
  const [anmeldungen, setAnmeldungen] = useState<Anmeldungen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [creating, setCreating] = useState(false);
  const [createdCount, setCreatedCount] = useState(0);
  const [newlyCreatedIds, setNewlyCreatedIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().slice(0, 10));
  const [selectedStatus, setSelectedStatus] = useState('bestaetigt');
  const [notes, setNotes] = useState('');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [teilnehmerDialogOpen, setTeilnehmerDialogOpen] = useState(false);

  const fetchAll = async () => {
    try {
      const [v, tn, vo, ref, anm] = await Promise.all([
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getTeilnehmer(),
        LivingAppsService.getVeranstaltungsort(),
        LivingAppsService.getReferenten(),
        LivingAppsService.getAnmeldungen(),
      ]);
      setVeranstaltungen(v);
      setTeilnehmer(tn);
      setVeranstaltungsort(vo);
      setReferenten(ref);
      setAnmeldungen(anm);
    } catch (e) {
      setError(e instanceof Error ? e : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
  }, []);

  // Deep-link: read ?eventId= from URL hash after data is loaded
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

  // Per-event registration counts
  const anmeldungenCount = useMemo(() => {
    const map = new Map<string, number>();
    for (const anm of anmeldungen) {
      const id = extractRecordId(anm.fields.anm_veranstaltung);
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    }
    return map;
  }, [anmeldungen]);

  // Already registered teilnehmer IDs for selected event
  const registeredTeilnehmerIds = useMemo(() => {
    if (!selectedEvent) return new Set<string>();
    const eventUrl = createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent.record_id);
    const ids = new Set<string>();
    for (const anm of anmeldungen) {
      if (anm.fields.anm_veranstaltung === eventUrl) {
        const tnId = extractRecordId(anm.fields.anm_teilnehmer);
        if (tnId) ids.add(tnId);
      }
    }
    return ids;
  }, [anmeldungen, selectedEvent]);

  // Filter teilnehmer by search
  const filteredTeilnehmer = useMemo(() => {
    if (!searchQuery) return teilnehmer;
    const q = searchQuery.toLowerCase();
    return teilnehmer.filter(tn => {
      const name = `${tn.fields.tn_vorname ?? ''} ${tn.fields.tn_nachname ?? ''}`.toLowerCase();
      const email = (tn.fields.tn_email ?? '').toLowerCase();
      return name.includes(q) || email.includes(q);
    });
  }, [teilnehmer, searchQuery]);

  // Newly selected (not already registered)
  const newlySelected = useMemo(
    () => [...selectedTeilnehmerIds].filter(id => !registeredTeilnehmerIds.has(id)),
    [selectedTeilnehmerIds, registeredTeilnehmerIds]
  );

  function toggleTeilnehmer(id: string) {
    if (registeredTeilnehmerIds.has(id)) return;
    setSelectedTeilnehmerIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const handleSelectEvent = (id: string) => {
    const ev = veranstaltungen.find(v => v.record_id === id);
    if (ev) {
      setSelectedEvent(ev);
      setSelectedTeilnehmerIds(new Set());
      setStep(2);
    }
  };

  const handleCreate = async () => {
    if (!selectedEvent) return;
    setCreating(true);
    try {
      await Promise.all(
        newlySelected.map(id =>
          LivingAppsService.createAnmeldungenEntry({
            anm_veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent.record_id),
            anm_teilnehmer: createRecordUrl(APP_IDS.TEILNEHMER, id),
            anm_datum: selectedDate,
            anm_status: selectedStatus,
            anm_notizen: notes || undefined,
          })
        )
      );
      setCreatedCount(newlySelected.length);
      setNewlyCreatedIds([...newlySelected]);
      const fresh = await LivingAppsService.getAnmeldungen();
      setAnmeldungen(fresh);
      setStep(4);
    } finally {
      setCreating(false);
    }
  };

  const registeredCount = selectedEvent
    ? (anmeldungenCount.get(selectedEvent.record_id) ?? 0)
    : 0;
  const maxTeilnehmer = selectedEvent?.fields.event_max_teilnehmer;
  const available = maxTeilnehmer != null ? Math.max(0, maxTeilnehmer - registeredCount) : null;

  // Step 4: build list of newly registered participants
  const newlyRegisteredTeilnehmer = useMemo(() => {
    return teilnehmer.filter(tn => newlyCreatedIds.includes(tn.record_id));
  }, [teilnehmer, newlyCreatedIds]);

  return (
    <IntentWizardShell
      title="Teilnehmer anmelden"
      subtitle="Mehrere Teilnehmer in einem Schritt für eine Veranstaltung anmelden"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* Step 1: Event wählen */}
      {step === 1 && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Veranstaltung auswählen</h2>
            <p className="text-sm text-muted-foreground">Wähle die Veranstaltung, für die du Teilnehmer anmelden möchtest.</p>
          </div>
          <EntitySelectStep
            items={veranstaltungen.map(v => {
              const count = anmeldungenCount.get(v.record_id) ?? 0;
              const max = v.fields.event_max_teilnehmer;
              const avail = max != null ? Math.max(0, max - count) : null;
              return {
                id: v.record_id,
                title: v.fields.event_titel ?? '(Ohne Titel)',
                subtitle: [
                  v.fields.event_start ? formatDate(v.fields.event_start) : null,
                  v.fields.event_kategorie?.label,
                ].filter(Boolean).join(' · '),
                status: v.fields.event_status,
                stats: [
                  { label: 'Anmeldungen', value: count },
                  { label: 'Max.', value: max != null ? String(max) : '∞' },
                  { label: 'Verfügbar', value: avail != null ? String(avail) : '∞' },
                ],
                icon: <IconCalendar size={18} className="text-primary" />,
              };
            })}
            onSelect={handleSelectEvent}
            searchPlaceholder="Veranstaltung suchen..."
            emptyIcon={<IconCalendar size={32} />}
            emptyText="Keine Veranstaltungen gefunden."
            createLabel="Neue Veranstaltung"
            onCreateNew={() => setEventDialogOpen(true)}
            createDialog={
              <VeranstaltungenDialog
                open={eventDialogOpen}
                onClose={() => setEventDialogOpen(false)}
                onSubmit={async (fields) => {
                  await LivingAppsService.createVeranstaltungenEntry(fields);
                  await fetchAll();
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

      {/* Step 2: Teilnehmer wählen */}
      {step === 2 && selectedEvent && (
        <div className="space-y-4">
          {/* Context card */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="min-w-0">
                <h2 className="font-bold text-foreground text-base truncate">
                  {selectedEvent.fields.event_titel ?? '(Ohne Titel)'}
                </h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {selectedEvent.fields.event_start ? formatDate(selectedEvent.fields.event_start) : '—'}
                  {selectedEvent.fields.event_kategorie && (
                    <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                      {selectedEvent.fields.event_kategorie.label}
                    </span>
                  )}
                </p>
              </div>
              {selectedEvent.fields.event_status && (
                <StatusBadge statusKey={selectedEvent.fields.event_status.key} label={selectedEvent.fields.event_status.label} />
              )}
            </div>

            {/* Capacity bar */}
            {maxTeilnehmer != null && maxTeilnehmer > 0 ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Kapazität</span>
                  <span>{registeredCount} / {maxTeilnehmer} Plätze belegt</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      registeredCount >= maxTeilnehmer ? 'bg-red-500' :
                      registeredCount / maxTeilnehmer >= 0.8 ? 'bg-amber-500' : 'bg-primary'
                    }`}
                    style={{ width: `${Math.min(100, (registeredCount / maxTeilnehmer) * 100)}%` }}
                  />
                </div>
                {available === 0 && (
                  <div className="flex items-center gap-1 text-xs text-red-600">
                    <IconAlertCircle size={12} />
                    <span>Keine freien Plätze mehr</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">{registeredCount} Anmeldungen · Keine Teilnehmerbegrenzung</p>
            )}
          </div>

          {/* Teilnehmer list */}
          <div>
            <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
              <h3 className="font-semibold text-foreground">Teilnehmer auswählen</h3>
              <Button variant="outline" size="sm" onClick={() => setTeilnehmerDialogOpen(true)} className="gap-1.5 shrink-0">
                <IconPlus size={14} />
                Neuen Teilnehmer anlegen
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-3">
              <IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Name oder E-Mail suchen..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {filteredTeilnehmer.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <IconUsers size={32} className="mx-auto mb-2 opacity-40" />
                <p className="text-sm">Keine Teilnehmer gefunden.</p>
                <Button variant="outline" size="sm" onClick={() => setTeilnehmerDialogOpen(true)} className="mt-3 gap-1.5">
                  <IconPlus size={14} />
                  Teilnehmer anlegen
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTeilnehmer.map(tn => {
                  const isRegistered = registeredTeilnehmerIds.has(tn.record_id);
                  const isSelected = selectedTeilnehmerIds.has(tn.record_id);
                  return (
                    <div
                      key={tn.record_id}
                      onClick={() => toggleTeilnehmer(tn.record_id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                        isRegistered
                          ? 'bg-muted/40 border-border opacity-60 cursor-default'
                          : isSelected
                          ? 'bg-primary/5 border-primary/40'
                          : 'bg-card border-border hover:border-primary/20'
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 ${
                          isRegistered || isSelected
                            ? 'bg-primary border-primary'
                            : 'border-muted-foreground/30'
                        }`}
                      >
                        {(isRegistered || isSelected) && (
                          <IconCheck size={12} className="text-primary-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">
                          {tn.fields.tn_vorname} {tn.fields.tn_nachname}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {tn.fields.tn_email ?? tn.fields.tn_telefon ?? '—'}
                        </p>
                      </div>
                      {isRegistered && (
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                          Bereits angemeldet
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{newlySelected.length}</span> Teilnehmer ausgewählt
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setStep(1)}>Zurück</Button>
              <Button
                onClick={() => setStep(3)}
                disabled={newlySelected.length === 0}
              >
                Weiter
              </Button>
            </div>
          </div>

          <TeilnehmerDialog
            open={teilnehmerDialogOpen}
            onClose={() => setTeilnehmerDialogOpen(false)}
            onSubmit={async (fields) => {
              const created = await LivingAppsService.createTeilnehmerEntry(fields);
              await fetchAll();
              // Auto-select the new participant
              if (created && typeof created === 'object') {
                const entries = Object.entries(created as Record<string, unknown>);
                if (entries.length > 0) {
                  const [newId] = entries[0];
                  if (newId) {
                    setSelectedTeilnehmerIds(prev => {
                      const next = new Set(prev);
                      next.add(newId);
                      return next;
                    });
                  }
                }
              }
            }}
            enablePhotoScan={AI_PHOTO_SCAN['Teilnehmer']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Teilnehmer']}
          />
        </div>
      )}

      {/* Step 3: Anmeldungen erstellen */}
      {step === 3 && selectedEvent && (
        <div className="space-y-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-1">Anmeldungen bestätigen</h2>
            <p className="text-sm text-muted-foreground">
              Überprüfe deine Auswahl und lege die Anmeldungsdetails fest.
            </p>
          </div>

          {/* Selected participants summary */}
          <div className="rounded-xl border bg-card p-4 space-y-3">
            <h3 className="font-medium text-sm text-foreground">
              Ausgewählte Teilnehmer ({newlySelected.length})
            </h3>
            <div className="space-y-1.5">
              {teilnehmer
                .filter(tn => newlySelected.includes(tn.record_id))
                .map(tn => (
                  <div key={tn.record_id} className="flex items-center gap-2 text-sm">
                    <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <IconCheck size={11} className="text-primary" />
                    </div>
                    <span className="font-medium truncate">{tn.fields.tn_vorname} {tn.fields.tn_nachname}</span>
                    {tn.fields.tn_email && (
                      <span className="text-muted-foreground truncate text-xs">{tn.fields.tn_email}</span>
                    )}
                  </div>
                ))}
            </div>
          </div>

          {/* Registration details */}
          <div className="rounded-xl border bg-card p-4 space-y-4">
            <h3 className="font-medium text-sm text-foreground">Anmeldungsdetails</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Anmeldedatum
              </label>
              <Input
                type="date"
                value={selectedDate}
                onChange={e => setSelectedDate(e.target.value)}
                className="max-w-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Status
              </label>
              <div className="flex gap-2 flex-wrap">
                {ANM_STATUS_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setSelectedStatus(opt.key)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                      selectedStatus === opt.key
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-foreground hover:border-primary/30'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                Notizen (optional)
              </label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Anmerkungen zu diesen Anmeldungen..."
                rows={3}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              />
            </div>
          </div>

          <div className="rounded-xl bg-primary/5 border border-primary/20 p-3 text-sm text-primary font-medium">
            Es werden {newlySelected.length} Anmeldung{newlySelected.length !== 1 ? 'en' : ''} erstellt.
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between pt-2 border-t gap-3 flex-wrap">
            <Button variant="outline" onClick={() => setStep(2)} disabled={creating}>
              Zurück
            </Button>
            <Button onClick={handleCreate} disabled={creating || newlySelected.length === 0}>
              {creating ? 'Wird erstellt…' : `${newlySelected.length} Teilnehmer anmelden`}
            </Button>
          </div>
        </div>
      )}

      {/* Step 4: Fertig */}
      {step === 4 && selectedEvent && (
        <div className="space-y-6">
          {/* Success header */}
          <div className="text-center py-6">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
              <IconCheck size={32} className="text-green-600" stroke={2.5} />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-1">
              {createdCount} Anmeldung{createdCount !== 1 ? 'en' : ''} erfolgreich erstellt!
            </h2>
            <p className="text-sm text-muted-foreground">
              Alle Teilnehmer wurden für „{selectedEvent.fields.event_titel}" angemeldet.
            </p>
          </div>

          {/* Updated capacity bar */}
          {maxTeilnehmer != null && maxTeilnehmer > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-muted-foreground">Aktuelle Auslastung</span>
                <span className="font-semibold text-foreground">
                  {anmeldungenCount.get(selectedEvent.record_id) ?? 0} / {maxTeilnehmer}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{
                    width: `${Math.min(100, ((anmeldungenCount.get(selectedEvent.record_id) ?? 0) / maxTeilnehmer) * 100)}%`,
                  }}
                />
              </div>
            </div>
          )}

          {/* Newly created registrations */}
          {newlyRegisteredTeilnehmer.length > 0 && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <h3 className="font-medium text-sm text-foreground">Neu angemeldete Teilnehmer</h3>
              <div className="space-y-2">
                {newlyRegisteredTeilnehmer.map(tn => (
                  <div key={tn.record_id} className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-green-100 flex items-center justify-center shrink-0">
                      <IconCheck size={14} className="text-green-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {tn.fields.tn_vorname} {tn.fields.tn_nachname}
                      </p>
                      {tn.fields.tn_email && (
                        <p className="text-xs text-muted-foreground truncate">{tn.fields.tn_email}</p>
                      )}
                    </div>
                    <StatusBadge statusKey={selectedStatus} label={ANM_STATUS_OPTIONS.find(o => o.key === selectedStatus)?.label ?? selectedStatus} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSelectedTeilnehmerIds(new Set());
                setNotes('');
                setCreatedCount(0);
                setNewlyCreatedIds([]);
                setStep(2);
              }}
            >
              <IconUsers size={16} className="mr-2" />
              Weitere Anmeldungen für dieses Event
            </Button>
            <Button
              className="flex-1"
              onClick={() => {
                setSelectedEvent(null);
                setSelectedTeilnehmerIds(new Set());
                setNotes('');
                setCreatedCount(0);
                setNewlyCreatedIds([]);
                setStep(1);
              }}
            >
              <IconCalendar size={16} className="mr-2" />
              Anderes Event wählen
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
