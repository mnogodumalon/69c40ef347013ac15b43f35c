import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { Veranstaltungen, Teilnehmer } from '@/types/app';
import { APP_IDS, LOOKUP_OPTIONS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { TeilnehmerDialog } from '@/components/dialogs/TeilnehmerDialog';
import { TeilnehmerAnmeldungDialog } from '@/components/dialogs/TeilnehmerAnmeldungDialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  IconPlus,
  IconX,
  IconCircleCheck,
  IconLoader2,
  IconUsers,
  IconCalendarEvent,
  IconUserPlus,
  IconWalk,
} from '@tabler/icons-react';

// ---- Types ----

type BasketItem =
  | { type: 'teilnehmer'; id: string; name: string; email: string; status: string }
  | { type: 'walkin'; recordId: string; name: string; email: string };

const WIZARD_STEPS = [
  { label: 'Veranstaltung' },
  { label: 'Teilnehmer' },
  { label: 'Bestätigen' },
  { label: 'Abschluss' },
];

const STATUS_OPTIONS = LOOKUP_OPTIONS['anmeldungen']?.['anm_status'] ?? [
  { key: 'ausstehend', label: 'Ausstehend' },
  { key: 'bestaetigt', label: 'Bestätigt' },
  { key: 'storniert', label: 'Storniert' },
  { key: 'warteliste', label: 'Warteliste' },
];

function formatDate(dateStr: string | undefined): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

function getTodayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---- Capacity Bar ----

function CapacityBar({ count, max }: { count: number; max: number | undefined }) {
  if (!max) return null;
  const pct = Math.min(100, Math.round((count / max) * 100));
  const colorClass = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Auslastung</span>
        <span className={pct >= 90 ? 'text-red-600 font-medium' : pct >= 70 ? 'text-amber-600 font-medium' : 'text-green-700 font-medium'}>
          {count} / {max} Plätze
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colorClass}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---- Basket Panel ----

interface BasketPanelProps {
  basket: BasketItem[];
  event: Veranstaltungen | null;
  onRemove: (id: string) => void;
}

function BasketPanel({ basket, event, onRemove }: BasketPanelProps) {
  const max = event?.fields?.event_max_teilnehmer;
  const teilnehmerCount = basket.filter(b => b.type === 'teilnehmer').length;
  const walkinCount = basket.filter(b => b.type === 'walkin').length;
  const totalCount = basket.length;

  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <IconUsers size={16} className="text-primary" />
          </div>
          <span className="font-semibold text-sm">Anmeldeliste</span>
        </div>
        <span className="text-sm font-medium text-muted-foreground">
          {totalCount} {totalCount === 1 ? 'Teilnehmer' : 'Teilnehmer'}
        </span>
      </div>

      {max !== undefined && (
        <CapacityBar count={totalCount} max={max} />
      )}

      {basket.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          Noch keine Teilnehmer hinzugefuegt
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {basket.map((item, idx) => (
            <div
              key={item.type === 'teilnehmer' ? item.id : item.recordId + idx}
              className="flex items-center gap-2 p-2 rounded-lg bg-muted/50"
            >
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {item.type === 'walkin'
                  ? <IconWalk size={12} className="text-primary" />
                  : <IconUsers size={12} className="text-primary" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{item.name}</p>
                {item.email && (
                  <p className="text-xs text-muted-foreground truncate">{item.email}</p>
                )}
                {item.type === 'walkin' && (
                  <span className="text-xs text-green-700 font-medium">Walk-in</span>
                )}
              </div>
              {item.type === 'teilnehmer' && (
                <button
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  aria-label="Entfernen"
                >
                  <IconX size={12} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {walkinCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {teilnehmerCount > 0 && `${teilnehmerCount} Teilnehmer`}
          {teilnehmerCount > 0 && walkinCount > 0 && ' + '}
          {walkinCount > 0 && `${walkinCount} Walk-in (bereits angemeldet)`}
        </p>
      )}
    </div>
  );
}

// ---- Main Page ----

export default function BatchRegistrationPage() {
  const [searchParams, setSearchParams] = useSearchParams();

  // ---- All hooks declared before any early returns ----

  const [step, setStep] = useState<number>(() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    return s >= 1 && s <= 4 ? s : 1;
  });

  const [veranstaltungen, setVeranstaltungen] = useState<Veranstaltungen[]>([]);
  const [teilnehmer, setTeilnehmer] = useState<Teilnehmer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const [selectedEventId, setSelectedEventId] = useState<string | null>(
    () => searchParams.get('eventId')
  );

  const [basket, setBasket] = useState<BasketItem[]>([]);
  const [activeTab, setActiveTab] = useState<'existing' | 'walkin'>('existing');
  const [selectedTeilnehmerId, setSelectedTeilnehmerId] = useState<string | null>(null);

  const [newTeilnehmerDialogOpen, setNewTeilnehmerDialogOpen] = useState(false);
  const [walkinDialogOpen, setWalkinDialogOpen] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setError(null);
    try {
      const [vData, tData] = await Promise.all([
        LivingAppsService.getVeranstaltungen(),
        LivingAppsService.getTeilnehmer(),
      ]);
      setVeranstaltungen(vData);
      setTeilnehmer(tData);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Fehler beim Laden der Daten'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  // Deep-link: if ?eventId is set and we're on step 1, jump to step 2
  useEffect(() => {
    const eventId = searchParams.get('eventId');
    if (eventId && step === 1 && !loading) {
      setSelectedEventId(eventId);
      setStep(2);
    }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  // Sync step to URL
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (step > 1) {
      params.set('step', String(step));
    } else {
      params.delete('step');
    }
    if (selectedEventId) {
      params.set('eventId', selectedEventId);
    } else {
      params.delete('eventId');
    }
    setSearchParams(params, { replace: true });
  }, [step, selectedEventId, searchParams, setSearchParams]);

  const selectedEvent = useMemo(
    () => veranstaltungen.find(v => v.record_id === selectedEventId) ?? null,
    [veranstaltungen, selectedEventId]
  );

  const filteredEvents = useMemo(
    () => veranstaltungen.filter(v => {
      const key = v.fields.event_status?.key;
      return key !== 'abgesagt' && key !== 'abgeschlossen';
    }),
    [veranstaltungen]
  );

  const basketIds = useMemo(
    () => new Set(basket.filter(b => b.type === 'teilnehmer').map(b => b.type === 'teilnehmer' ? b.id : '')),
    [basket]
  );

  const teilnehmerCount = basket.filter(b => b.type === 'teilnehmer').length;
  const walkinCount = basket.filter(b => b.type === 'walkin').length;

  // ---- Handlers ----

  function handleSelectEvent(id: string) {
    setSelectedEventId(id);
  }

  function handleGoToStep2() {
    if (!selectedEventId) return;
    setStep(2);
  }

  function handleAddToBasket() {
    if (!selectedTeilnehmerId) return;
    if (basketIds.has(selectedTeilnehmerId)) return;
    const tn = teilnehmer.find(t => t.record_id === selectedTeilnehmerId);
    if (!tn) return;
    setBasket(prev => [
      ...prev,
      {
        type: 'teilnehmer',
        id: tn.record_id,
        name: `${tn.fields.tn_vorname ?? ''} ${tn.fields.tn_nachname ?? ''}`.trim() || tn.record_id,
        email: tn.fields.tn_email ?? '',
        status: 'bestaetigt',
      },
    ]);
    setSelectedTeilnehmerId(null);
  }

  function handleRemoveFromBasket(id: string) {
    setBasket(prev => prev.filter(b => !(b.type === 'teilnehmer' && b.id === id)));
  }

  function handleSetItemStatus(id: string, status: string) {
    setBasket(prev =>
      prev.map(b =>
        b.type === 'teilnehmer' && b.id === id ? { ...b, status } : b
      )
    );
  }

  function handleSetAllBestaetigt() {
    setBasket(prev =>
      prev.map(b => (b.type === 'teilnehmer' ? { ...b, status: 'bestaetigt' } : b))
    );
  }

  async function handleSubmitAnmeldungen() {
    if (!selectedEventId) return;
    setSubmitting(true);
    setSubmitError(null);
    const today = getTodayIso();
    try {
      const teilnehmerItems = basket.filter(
        (b): b is Extract<BasketItem, { type: 'teilnehmer' }> => b.type === 'teilnehmer'
      );
      await Promise.all(
        teilnehmerItems.map(item =>
          LivingAppsService.createAnmeldungenEntry({
            anm_veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEventId),
            anm_teilnehmer: createRecordUrl(APP_IDS.TEILNEHMER, item.id),
            anm_datum: today,
            anm_status: item.status,
          })
        )
      );
      setStep(4);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Fehler beim Einreichen der Anmeldungen'
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleMoreRegistrations() {
    setBasket([]);
    setSelectedTeilnehmerId(null);
    setActiveTab('existing');
    setSubmitError(null);
    setStep(2);
  }

  function handleReset() {
    setBasket([]);
    setSelectedEventId(null);
    setSelectedTeilnehmerId(null);
    setActiveTab('existing');
    setSubmitError(null);
    setStep(1);
  }

  // ---- Render ----

  return (
    <IntentWizardShell
      title="Sammelanmeldung"
      subtitle="Mehrere Teilnehmer auf einmal fuer eine Veranstaltung anmelden"
      steps={WIZARD_STEPS}
      currentStep={step}
      onStepChange={setStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      {/* ---- Step 1: Veranstaltung auswaehlen ---- */}
      {step === 1 && (
        <div className="space-y-4">
          <div className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <IconCalendarEvent size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="font-semibold text-sm">Veranstaltung auswaehlen</h2>
                <p className="text-xs text-muted-foreground">Waehle das Event, fuer das du Anmeldungen erfassen moechtest</p>
              </div>
            </div>

            <EntitySelectStep
              items={filteredEvents.map(v => ({
                id: v.record_id,
                title: v.fields.event_titel ?? v.record_id,
                subtitle: v.fields.event_start ? formatDate(v.fields.event_start) : undefined,
                status: v.fields.event_status
                  ? { key: v.fields.event_status.key, label: v.fields.event_status.label }
                  : undefined,
                stats: [
                  {
                    label: 'Plaetze',
                    value: v.fields.event_max_teilnehmer !== undefined
                      ? String(v.fields.event_max_teilnehmer)
                      : '∞',
                  },
                ],
              }))}
              onSelect={handleSelectEvent}
              searchPlaceholder="Veranstaltung suchen..."
              emptyIcon={<IconCalendarEvent size={32} />}
              emptyText="Keine aktiven Veranstaltungen gefunden."
            />

            {selectedEventId && selectedEvent && (
              <div className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-xs font-medium text-primary">Ausgewaehlt:</p>
                <p className="text-sm font-semibold">{selectedEvent.fields.event_titel}</p>
                {selectedEvent.fields.event_start && (
                  <p className="text-xs text-muted-foreground">{formatDate(selectedEvent.fields.event_start)}</p>
                )}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleGoToStep2}
              disabled={!selectedEventId}
              className="min-w-32"
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* ---- Step 2: Teilnehmer hinzufuegen ---- */}
      {step === 2 && (
        <div className="space-y-4">
          {selectedEvent && (
            <div className="p-3 rounded-xl border bg-muted/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendarEvent size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Veranstaltung</p>
                <p className="text-sm font-semibold truncate">{selectedEvent.fields.event_titel}</p>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              onClick={() => setActiveTab('existing')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'existing'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              <IconUsers size={15} />
              Bestehende Teilnehmer
            </button>
            <button
              onClick={() => setActiveTab('walkin')}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'walkin'
                  ? 'bg-background shadow-sm text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              <IconWalk size={15} />
              Walk-in Anmeldung
            </button>
          </div>

          {/* Tab A: Bestehende Teilnehmer */}
          {activeTab === 'existing' && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <EntitySelectStep
                items={teilnehmer.map(t => ({
                  id: t.record_id,
                  title: `${t.fields.tn_vorname ?? ''} ${t.fields.tn_nachname ?? ''}`.trim() || t.record_id,
                  subtitle: t.fields.tn_email,
                  status: basketIds.has(t.record_id)
                    ? { key: 'bestaetigt', label: 'Bereits hinzugefuegt' }
                    : undefined,
                }))}
                onSelect={id => {
                  if (!basketIds.has(id)) setSelectedTeilnehmerId(id);
                }}
                searchPlaceholder="Teilnehmer suchen..."
                emptyIcon={<IconUsers size={32} />}
                emptyText="Keine Teilnehmer gefunden."
                createLabel="Neuen Teilnehmer erstellen"
                onCreateNew={() => setNewTeilnehmerDialogOpen(true)}
              />

              <TeilnehmerDialog
                open={newTeilnehmerDialogOpen}
                onClose={() => setNewTeilnehmerDialogOpen(false)}
                onSubmit={async (fields) => {
                  const result = await LivingAppsService.createTeilnehmerEntry(fields);
                  await fetchAll();
                  // Auto-add newly created teilnehmer
                  const entries = Object.entries(result as Record<string, unknown>);
                  if (entries.length > 0) {
                    const [newRecordId] = entries[0];
                    const name = `${String(fields.tn_vorname ?? '')} ${String(fields.tn_nachname ?? '')}`.trim() || newRecordId;
                    const email = String(fields.tn_email ?? '');
                    setBasket(prev => [
                      ...prev,
                      { type: 'teilnehmer', id: newRecordId, name, email, status: 'bestaetigt' },
                    ]);
                  }
                }}
                defaultValues={undefined}
                enablePhotoScan={AI_PHOTO_SCAN['Teilnehmer']}
                enablePhotoLocation={AI_PHOTO_LOCATION['Teilnehmer']}
              />

              {selectedTeilnehmerId && !basketIds.has(selectedTeilnehmerId) && (() => {
                const tn = teilnehmer.find(t => t.record_id === selectedTeilnehmerId);
                if (!tn) return null;
                return (
                  <div className="flex items-center gap-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {`${tn.fields.tn_vorname ?? ''} ${tn.fields.tn_nachname ?? ''}`.trim()}
                      </p>
                      {tn.fields.tn_email && (
                        <p className="text-xs text-muted-foreground truncate">{tn.fields.tn_email}</p>
                      )}
                    </div>
                    <Button size="sm" onClick={handleAddToBasket} className="shrink-0 gap-1.5">
                      <IconUserPlus size={14} />
                      Hinzufuegen
                    </Button>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Tab B: Walk-in */}
          {activeTab === 'walkin' && (
            <div className="rounded-xl border bg-card p-4 space-y-3">
              <div className="text-center py-6 space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <IconWalk size={24} className="text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Walk-in Gast registrieren</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    Registriere einen Gast ohne vorhandenes Teilnehmerprofil direkt fuer diese Veranstaltung.
                    Die Anmeldung wird sofort gespeichert.
                  </p>
                </div>
                <Button
                  onClick={() => setWalkinDialogOpen(true)}
                  className="gap-2"
                >
                  <IconPlus size={16} />
                  Walk-in Gast registrieren
                </Button>
              </div>

              <TeilnehmerAnmeldungDialog
                open={walkinDialogOpen}
                onClose={() => setWalkinDialogOpen(false)}
                onSubmit={async (fields) => {
                  const result = await LivingAppsService.createTeilnehmerAnmeldungEntry(fields);
                  await fetchAll();
                  const entries = Object.entries(result as Record<string, unknown>);
                  if (entries.length > 0) {
                    const [newRecordId] = entries[0];
                    const name = `${String(fields.ta_vorname ?? '')} ${String(fields.ta_nachname ?? '')}`.trim() || 'Walk-in Gast';
                    const email = String(fields.ta_email ?? '');
                    setBasket(prev => [
                      ...prev,
                      { type: 'walkin', recordId: newRecordId, name, email },
                    ]);
                  }
                }}
                defaultValues={{
                  ta_veranstaltung: selectedEventId
                    ? createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEventId)
                    : undefined,
                }}
                veranstaltungenList={veranstaltungen}
                enablePhotoScan={AI_PHOTO_SCAN['TeilnehmerAnmeldung']}
                enablePhotoLocation={AI_PHOTO_LOCATION['TeilnehmerAnmeldung']}
              />
            </div>
          )}

          {/* Basket */}
          <BasketPanel basket={basket} event={selectedEvent} onRemove={handleRemoveFromBasket} />

          {/* Navigation */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
              Zurueck
            </Button>
            <Button
              onClick={() => setStep(3)}
              disabled={basket.length === 0}
              className="flex-1"
            >
              Weiter zur Bestaetigung ({basket.length})
            </Button>
          </div>
        </div>
      )}

      {/* ---- Step 3: Anmeldungen bestaetigen ---- */}
      {step === 3 && (
        <div className="space-y-4">
          {selectedEvent && (
            <div className="p-3 rounded-xl border bg-muted/40 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <IconCalendarEvent size={16} className="text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Veranstaltung</p>
                <p className="text-sm font-semibold truncate">{selectedEvent.fields.event_titel}</p>
              </div>
            </div>
          )}

          <div className="rounded-xl border bg-card overflow-hidden">
            <div className="p-4 border-b flex items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-sm">Anmeldungen ueberprufen</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {teilnehmerCount > 0
                    ? `${teilnehmerCount} neue Anmeldung${teilnehmerCount !== 1 ? 'en' : ''} werden erstellt`
                    : 'Keine neuen Anmeldungen'}
                  {walkinCount > 0 && ` + ${walkinCount} Walk-in${walkinCount !== 1 ? 's' : ''} bereits gespeichert`}
                </p>
              </div>
              {teilnehmerCount > 0 && (
                <Button variant="outline" size="sm" onClick={handleSetAllBestaetigt} className="shrink-0">
                  Alle bestaetigen
                </Button>
              )}
            </div>

            <div className="divide-y">
              {basket.map((item, idx) => (
                <div
                  key={item.type === 'teilnehmer' ? item.id : item.recordId + idx}
                  className="p-4 flex items-center gap-3"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    {item.type === 'walkin'
                      ? <IconWalk size={14} className="text-primary" />
                      : <IconUsers size={14} className="text-primary" />
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.name}</p>
                    {item.email && (
                      <p className="text-xs text-muted-foreground truncate">{item.email}</p>
                    )}
                  </div>
                  {item.type === 'walkin' ? (
                    <span className="shrink-0 text-xs font-medium px-2 py-1 rounded-full bg-green-100 text-green-700">
                      Direkt angemeldet
                    </span>
                  ) : (
                    <Select
                      value={item.status}
                      onValueChange={val => handleSetItemStatus(item.id, val)}
                    >
                      <SelectTrigger className="w-36 shrink-0 h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {STATUS_OPTIONS.map(opt => (
                          <SelectItem key={opt.key} value={opt.key}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
              ))}
            </div>
          </div>

          {submitError && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <p className="text-sm text-destructive">{submitError}</p>
            </div>
          )}

          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              disabled={submitting}
              className="flex-1"
            >
              Zurueck
            </Button>
            <Button
              onClick={handleSubmitAnmeldungen}
              disabled={submitting || teilnehmerCount === 0}
              className="flex-1 gap-2"
            >
              {submitting ? (
                <>
                  <IconLoader2 size={16} className="animate-spin" />
                  Wird eingereicht...
                </>
              ) : (
                <>
                  <IconCircleCheck size={16} />
                  Anmeldungen einreichen
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ---- Step 4: Abschluss ---- */}
      {step === 4 && (
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-10 gap-4 text-center">
            <div className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
              <IconCircleCheck size={48} className="text-green-600" stroke={1.5} />
            </div>
            <div>
              <h2 className="text-xl font-bold">Anmeldungen erfolgreich eingereicht!</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Alle Anmeldungen wurden gespeichert.
              </p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-3xl font-bold text-primary">{teilnehmerCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Anmeldungen erstellt</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{walkinCount}</p>
              <p className="text-sm text-muted-foreground mt-1">Walk-in Anmeldungen</p>
            </div>
            <div className="rounded-xl border bg-card p-4 text-center overflow-hidden">
              <p className="text-sm font-semibold truncate">{selectedEvent?.fields.event_titel ?? '—'}</p>
              <p className="text-sm text-muted-foreground mt-1">Veranstaltung</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              onClick={handleMoreRegistrations}
              className="flex-1 gap-2"
            >
              <IconUserPlus size={16} />
              Weitere Anmeldungen
            </Button>
            <Button
              onClick={handleReset}
              className="flex-1 gap-2"
            >
              <IconCalendarEvent size={16} />
              Andere Veranstaltung
            </Button>
          </div>
        </div>
      )}
    </IntentWizardShell>
  );
}
