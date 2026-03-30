import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichVeranstaltungen, enrichAnmeldungen } from '@/lib/enrich';
import type { EnrichedVeranstaltungen, EnrichedAnmeldungen } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl, extractRecordId } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { AnmeldungenDialog } from '@/components/dialogs/AnmeldungenDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconCalendarEvent,
  IconCalendar,
  IconUsers,
  IconUserCheck,
  IconPlus,
  IconPencil,
  IconTrash,
  IconMapPin,
  IconMicrophone,
  IconAlertCircle,
} from '@tabler/icons-react';

function statusClass(key?: string) {
  switch (key) {
    case 'geplant': return 'bg-blue-100 text-blue-700';
    case 'bestaetigt': return 'bg-green-100 text-green-700';
    case 'abgesagt': return 'bg-red-100 text-red-700';
    case 'abgeschlossen': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function categoryClass(key?: string) {
  switch (key) {
    case 'konferenz': return 'bg-purple-100 text-purple-700';
    case 'workshop': return 'bg-orange-100 text-orange-700';
    case 'seminar': return 'bg-indigo-100 text-indigo-700';
    case 'networking': return 'bg-teal-100 text-teal-700';
    case 'messe': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function anmStatusClass(key?: string) {
  switch (key) {
    case 'bestaetigt': return 'bg-green-100 text-green-700';
    case 'ausstehend': return 'bg-yellow-100 text-yellow-700';
    case 'storniert': return 'bg-red-100 text-red-700';
    case 'warteliste': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

export default function DashboardOverview() {
  const {
    veranstaltungen, teilnehmer, veranstaltungsort, referenten, anmeldungen,
    veranstaltungenMap, teilnehmerMap, veranstaltungsortMap, referentenMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedVeranstaltungen = enrichVeranstaltungen(veranstaltungen, { veranstaltungsortMap, referentenMap });
  const enrichedAnmeldungen = enrichAnmeldungen(anmeldungen, { veranstaltungenMap, teilnehmerMap });

  const [selectedEvent, setSelectedEvent] = useState<EnrichedVeranstaltungen | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EnrichedVeranstaltungen | null>(null);
  const [anmeldungDialogOpen, setAnmeldungDialogOpen] = useState(false);
  const [editAnmeldung, setEditAnmeldung] = useState<EnrichedAnmeldungen | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<EnrichedVeranstaltungen | null>(null);
  const [deleteAnmeldungTarget, setDeleteAnmeldungTarget] = useState<EnrichedAnmeldungen | null>(null);

  const sortedEvents = useMemo(() => {
    let events = enrichedVeranstaltungen;
    if (statusFilter !== 'all') {
      events = events.filter(e => e.fields.event_status?.key === statusFilter);
    }
    return [...events].sort((a, b) => {
      if (!a.fields.event_start) return 1;
      if (!b.fields.event_start) return -1;
      return a.fields.event_start.localeCompare(b.fields.event_start);
    });
  }, [enrichedVeranstaltungen, statusFilter]);

  const anmeldungenByEvent = useMemo(() => {
    const map = new Map<string, number>();
    enrichedAnmeldungen.forEach(a => {
      const id = extractRecordId(a.fields.anm_veranstaltung);
      if (id) map.set(id, (map.get(id) ?? 0) + 1);
    });
    return map;
  }, [enrichedAnmeldungen]);

  const selectedEventAnmeldungen = useMemo(() => {
    if (!selectedEvent) return [];
    const eventUrl = createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent.record_id);
    return enrichedAnmeldungen.filter(a => a.fields.anm_veranstaltung === eventUrl);
  }, [enrichedAnmeldungen, selectedEvent]);

  const upcomingCount = useMemo(() => {
    const n = new Date().toISOString().slice(0, 16);
    return enrichedVeranstaltungen.filter(e => e.fields.event_start && e.fields.event_start >= n).length;
  }, [enrichedVeranstaltungen]);

  const confirmedAnmCount = useMemo(
    () => enrichedAnmeldungen.filter(a => a.fields.anm_status?.key === 'bestaetigt').length,
    [enrichedAnmeldungen]
  );

  const anmeldungDefaultValues = useMemo(() => {
    if (editAnmeldung) return editAnmeldung.fields;
    if (selectedEvent) return { anm_veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent.record_id) };
    return undefined;
  }, [editAnmeldung, selectedEvent]);

  const handleDeleteEvent = async () => {
    if (!deleteEventTarget) return;
    await LivingAppsService.deleteVeranstaltungenEntry(deleteEventTarget.record_id);
    if (selectedEvent?.record_id === deleteEventTarget.record_id) setSelectedEvent(null);
    setDeleteEventTarget(null);
    fetchAll();
  };

  const handleDeleteAnmeldung = async () => {
    if (!deleteAnmeldungTarget) return;
    await LivingAppsService.deleteAnmeldungenEntry(deleteAnmeldungTarget.record_id);
    setDeleteAnmeldungTarget(null);
    fetchAll();
  };

  function getParticipantName(anm: EnrichedAnmeldungen): string {
    const id = extractRecordId(anm.fields.anm_teilnehmer);
    if (!id) return anm.anm_teilnehmerName || '—';
    const tn = teilnehmerMap.get(id);
    if (!tn) return anm.anm_teilnehmerName || '—';
    return `${tn.fields.tn_vorname ?? ''} ${tn.fields.tn_nachname ?? ''}`.trim() || '—';
  }

  function getReferentFullName(event: EnrichedVeranstaltungen): string {
    const id = extractRecordId(event.fields.referenten_ref);
    if (!id) return '—';
    const ref = referentenMap.get(id);
    if (!ref) return '—';
    return `${ref.fields.ref_vorname ?? ''} ${ref.fields.ref_nachname ?? ''}`.trim() || '—';
  }

  function getVenueDetails(event: EnrichedVeranstaltungen): string {
    const id = extractRecordId(event.fields.veranstaltungsort_ref);
    if (!id) return event.veranstaltungsort_refName || '—';
    const ort = veranstaltungsortMap.get(id);
    if (!ort) return event.veranstaltungsort_refName || '—';
    const name = ort.fields.ort_name ?? '';
    const city = ort.fields.stadt ? `, ${ort.fields.stadt}` : '';
    return `${name}${city}` || '—';
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Veranstaltungen</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{enrichedVeranstaltungen.length} Veranstaltungen insgesamt</p>
        </div>
        <Button
          onClick={() => { setEditEvent(null); setEventDialogOpen(true); }}
          className="shrink-0"
        >
          <IconPlus size={16} className="shrink-0 mr-1.5" />
          Neue Veranstaltung
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Veranstaltungen"
          value={String(enrichedVeranstaltungen.length)}
          description="Gesamt"
          icon={<IconCalendarEvent size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Bevorstehend"
          value={String(upcomingCount)}
          description="Ab heute"
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Anmeldungen"
          value={String(enrichedAnmeldungen.length)}
          description="Gesamt"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Bestätigt"
          value={String(confirmedAnmCount)}
          description="Anmeldungen"
          icon={<IconUserCheck size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Main: Event list + Detail */}
      <div className="grid grid-cols-1 lg:grid-cols-[2fr_3fr] gap-4 items-start">
        {/* Left: Event list */}
        <div className="flex flex-col gap-3">
          {/* Status filter */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'all', label: 'Alle' },
              { key: 'geplant', label: 'Geplant' },
              { key: 'bestaetigt', label: 'Bestätigt' },
              { key: 'abgesagt', label: 'Abgesagt' },
              { key: 'abgeschlossen', label: 'Abgeschlossen' },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === f.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Event cards */}
          {sortedEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-card rounded-2xl border border-border">
              <IconCalendarEvent size={48} className="text-muted-foreground mb-3" stroke={1.5} />
              <p className="text-sm font-medium text-foreground">Keine Veranstaltungen</p>
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter !== 'all' ? 'Kein Ergebnis für diesen Filter' : 'Erstelle deine erste Veranstaltung'}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[600px] overflow-y-auto pr-1">
              {sortedEvents.map(event => {
                const regCount = anmeldungenByEvent.get(event.record_id) ?? 0;
                const isSelected = selectedEvent?.record_id === event.record_id;
                return (
                  <div
                    key={event.record_id}
                    onClick={() => setSelectedEvent(isSelected ? null : event)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? 'bg-primary/5 border-primary/40'
                        : 'bg-card border-border hover:border-primary/20 hover:bg-accent/20'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1.5 mb-1.5">
                          {event.fields.event_kategorie && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryClass(event.fields.event_kategorie.key)}`}>
                              {event.fields.event_kategorie.label}
                            </span>
                          )}
                          {event.fields.event_status && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusClass(event.fields.event_status.key)}`}>
                              {event.fields.event_status.label}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-foreground truncate">{event.fields.event_titel || '—'}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {event.fields.event_start ? formatDate(event.fields.event_start) : 'Kein Datum'}
                        </p>
                        {event.veranstaltungsort_refName && (
                          <div className="flex items-center gap-1 mt-0.5">
                            <IconMapPin size={12} className="shrink-0 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">{event.veranstaltungsort_refName}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <span className="text-xs font-medium text-muted-foreground bg-muted rounded-full px-2 py-0.5 whitespace-nowrap">
                          {regCount} Anm.
                        </span>
                        <div className="flex gap-1">
                          <button
                            onClick={e => { e.stopPropagation(); setEditEvent(event); setEventDialogOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Bearbeiten"
                          >
                            <IconPencil size={13} className="shrink-0" />
                          </button>
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteEventTarget(event); }}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Löschen"
                          >
                            <IconTrash size={13} className="shrink-0" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Event detail */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {!selectedEvent ? (
            <div className="flex flex-col items-center justify-center py-24 text-center px-6">
              <IconCalendarEvent size={48} className="text-muted-foreground mb-3" stroke={1.5} />
              <p className="text-sm font-medium text-foreground">Veranstaltung auswählen</p>
              <p className="text-xs text-muted-foreground mt-1">Klicke auf eine Veranstaltung, um Details und Anmeldungen zu sehen</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Event header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between gap-3 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedEvent.fields.event_kategorie && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryClass(selectedEvent.fields.event_kategorie.key)}`}>
                          {selectedEvent.fields.event_kategorie.label}
                        </span>
                      )}
                      {selectedEvent.fields.event_status && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusClass(selectedEvent.fields.event_status.key)}`}>
                          {selectedEvent.fields.event_status.label}
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-bold text-foreground leading-tight truncate">{selectedEvent.fields.event_titel || '—'}</h2>
                    {selectedEvent.fields.event_beschreibung && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{selectedEvent.fields.event_beschreibung}</p>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => { setEditEvent(selectedEvent); setEventDialogOpen(true); }}
                    >
                      <IconPencil size={14} className="shrink-0 mr-1" />
                      <span className="hidden sm:inline">Bearbeiten</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                      onClick={() => setDeleteEventTarget(selectedEvent)}
                    >
                      <IconTrash size={14} className="shrink-0" />
                    </Button>
                  </div>
                </div>

                {/* Event meta */}
                <div className="mt-3 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconCalendar size={14} className="shrink-0 text-primary" />
                    <span className="truncate">
                      {selectedEvent.fields.event_start ? formatDate(selectedEvent.fields.event_start) : 'Kein Datum'}
                      {selectedEvent.fields.event_ende ? ` – ${formatDate(selectedEvent.fields.event_ende)}` : ''}
                    </span>
                  </div>
                  {selectedEvent.veranstaltungsort_refName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconMapPin size={14} className="shrink-0 text-primary" />
                      <span className="truncate">{getVenueDetails(selectedEvent)}</span>
                    </div>
                  )}
                  {selectedEvent.fields.referenten_ref && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconMicrophone size={14} className="shrink-0 text-primary" />
                      <span className="truncate">{getReferentFullName(selectedEvent)}</span>
                    </div>
                  )}
                </div>

                {/* Capacity bar */}
                {selectedEvent.fields.event_max_teilnehmer != null && selectedEvent.fields.event_max_teilnehmer > 0 && (
                  <div className="mt-3">
                    {(() => {
                      const max = selectedEvent.fields.event_max_teilnehmer!;
                      const reg = anmeldungenByEvent.get(selectedEvent.record_id) ?? 0;
                      const pct = Math.min((reg / max) * 100, 100);
                      return (
                        <div>
                          <div className="flex justify-between text-xs text-muted-foreground mb-1">
                            <span>{reg} von {max} Plätzen belegt</span>
                            <span className="font-medium">{Math.round(pct)}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Registrations */}
              <div>
                <div className="px-5 py-3 flex items-center justify-between border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    Anmeldungen ({selectedEventAnmeldungen.length})
                  </h3>
                  <Button
                    size="sm"
                    onClick={() => { setEditAnmeldung(null); setAnmeldungDialogOpen(true); }}
                  >
                    <IconPlus size={14} className="shrink-0 mr-1" />
                    Anmeldung
                  </Button>
                </div>

                {selectedEventAnmeldungen.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <IconUsers size={36} className="text-muted-foreground mx-auto mb-2" stroke={1.5} />
                    <p className="text-sm text-muted-foreground">Noch keine Anmeldungen für diese Veranstaltung</p>
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-2 max-h-[340px] overflow-y-auto">
                    {selectedEventAnmeldungen.map(anm => (
                      <div key={anm.record_id} className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{getParticipantName(anm)}</p>
                          <div className="flex flex-wrap items-center gap-2 mt-0.5">
                            {anm.fields.anm_datum && (
                              <span className="text-xs text-muted-foreground">{formatDate(anm.fields.anm_datum)}</span>
                            )}
                            {anm.fields.anm_status && (
                              <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${anmStatusClass(anm.fields.anm_status.key)}`}>
                                {anm.fields.anm_status.label}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <button
                            onClick={() => { setEditAnmeldung(anm); setAnmeldungDialogOpen(true); }}
                            className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                            title="Bearbeiten"
                          >
                            <IconPencil size={13} className="shrink-0" />
                          </button>
                          <button
                            onClick={() => setDeleteAnmeldungTarget(anm)}
                            className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                            title="Löschen"
                          >
                            <IconTrash size={13} className="shrink-0" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Dialogs */}
      <VeranstaltungenDialog
        open={eventDialogOpen}
        onClose={() => { setEventDialogOpen(false); setEditEvent(null); }}
        onSubmit={async (fields) => {
          if (editEvent) {
            await LivingAppsService.updateVeranstaltungenEntry(editEvent.record_id, fields);
          } else {
            await LivingAppsService.createVeranstaltungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={editEvent?.fields}
        veranstaltungsortList={veranstaltungsort}
        referentenList={referenten}
        enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
      />

      <AnmeldungenDialog
        open={anmeldungDialogOpen}
        onClose={() => { setAnmeldungDialogOpen(false); setEditAnmeldung(null); }}
        onSubmit={async (fields) => {
          if (editAnmeldung) {
            await LivingAppsService.updateAnmeldungenEntry(editAnmeldung.record_id, fields);
          } else {
            await LivingAppsService.createAnmeldungenEntry(fields);
          }
          fetchAll();
        }}
        defaultValues={anmeldungDefaultValues}
        veranstaltungenList={veranstaltungen}
        teilnehmerList={teilnehmer}
        enablePhotoScan={AI_PHOTO_SCAN['Anmeldungen']}
        enablePhotoLocation={AI_PHOTO_LOCATION['Anmeldungen']}
      />

      <ConfirmDialog
        open={!!deleteEventTarget}
        title="Veranstaltung löschen"
        description={`Möchtest du "${deleteEventTarget?.fields.event_titel ?? 'diese Veranstaltung'}" wirklich löschen?`}
        onConfirm={handleDeleteEvent}
        onClose={() => setDeleteEventTarget(null)}
      />

      <ConfirmDialog
        open={!!deleteAnmeldungTarget}
        title="Anmeldung löschen"
        description="Möchtest du diese Anmeldung wirklich löschen?"
        onConfirm={handleDeleteAnmeldung}
        onClose={() => setDeleteAnmeldungTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  );
}

function DashboardError({ error, onRetry }: { error: Error; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4">
      <div className="w-12 h-12 rounded-2xl bg-destructive/10 flex items-center justify-center">
        <IconAlertCircle size={22} className="text-destructive" />
      </div>
      <div className="text-center">
        <h3 className="font-semibold text-foreground mb-1">Fehler beim Laden</h3>
        <p className="text-sm text-muted-foreground max-w-xs">{error.message}</p>
      </div>
      <Button variant="outline" size="sm" onClick={onRetry}>Erneut versuchen</Button>
    </div>
  );
}
