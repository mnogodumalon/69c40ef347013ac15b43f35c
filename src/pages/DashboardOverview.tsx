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
  IconChevronRight,
  IconClockHour4,
  IconCheck,
  IconX,
  IconArrowRight,
} from '@tabler/icons-react';

function statusBadge(key?: string) {
  switch (key) {
    case 'geplant': return 'bg-blue-100 text-blue-700';
    case 'bestaetigt': return 'bg-green-100 text-green-700';
    case 'abgesagt': return 'bg-red-100 text-red-700';
    case 'abgeschlossen': return 'bg-gray-100 text-gray-500';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function categoryBadge(key?: string) {
  switch (key) {
    case 'konferenz': return 'bg-purple-100 text-purple-700';
    case 'workshop': return 'bg-orange-100 text-orange-700';
    case 'seminar': return 'bg-indigo-100 text-indigo-700';
    case 'networking': return 'bg-teal-100 text-teal-700';
    case 'messe': return 'bg-amber-100 text-amber-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function anmStatusBadge(key?: string) {
  switch (key) {
    case 'bestaetigt': return 'bg-green-100 text-green-700';
    case 'ausstehend': return 'bg-yellow-100 text-yellow-700';
    case 'storniert': return 'bg-red-100 text-red-700';
    case 'warteliste': return 'bg-orange-100 text-orange-700';
    default: return 'bg-gray-100 text-gray-500';
  }
}

function groupEvents(events: EnrichedVeranstaltungen[]) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 7);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  const heute: EnrichedVeranstaltungen[] = [];
  const dieseWoche: EnrichedVeranstaltungen[] = [];
  const spaeter: EnrichedVeranstaltungen[] = [];
  const vergangen: EnrichedVeranstaltungen[] = [];

  for (const e of events) {
    const d = e.fields.event_start?.slice(0, 10);
    if (!d) {
      spaeter.push(e);
    } else if (d === todayStr) {
      heute.push(e);
    } else if (d > todayStr && d <= weekEndStr) {
      dieseWoche.push(e);
    } else if (d > weekEndStr) {
      spaeter.push(e);
    } else {
      vergangen.push(e);
    }
  }

  return { heute, dieseWoche, spaeter, vergangen };
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
  const [activeTab, setActiveTab] = useState<'heute' | 'woche' | 'spaeter' | 'alle'>('alle');
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EnrichedVeranstaltungen | null>(null);
  const [anmeldungDialogOpen, setAnmeldungDialogOpen] = useState(false);
  const [editAnmeldung, setEditAnmeldung] = useState<EnrichedAnmeldungen | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<EnrichedVeranstaltungen | null>(null);
  const [deleteAnmeldungTarget, setDeleteAnmeldungTarget] = useState<EnrichedAnmeldungen | null>(null);

  const sortedAll = useMemo(() => {
    return [...enrichedVeranstaltungen].sort((a, b) => {
      if (!a.fields.event_start) return 1;
      if (!b.fields.event_start) return -1;
      return a.fields.event_start.localeCompare(b.fields.event_start);
    });
  }, [enrichedVeranstaltungen]);

  const groups = useMemo(() => groupEvents(sortedAll), [sortedAll]);

  const nextEvent = useMemo(() => {
    const now = new Date().toISOString().slice(0, 16);
    return sortedAll.find(e =>
      e.fields.event_start &&
      e.fields.event_start >= now &&
      e.fields.event_status?.key !== 'abgesagt'
    ) ?? null;
  }, [sortedAll]);

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

  const visibleEvents = useMemo(() => {
    if (activeTab === 'heute') return groups.heute;
    if (activeTab === 'woche') return groups.dieseWoche;
    if (activeTab === 'spaeter') return [...groups.spaeter, ...groups.vergangen];
    return sortedAll;
  }, [activeTab, groups, sortedAll]);

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

  function getVenueDetails(event: EnrichedVeranstaltungen): string {
    const id = extractRecordId(event.fields.veranstaltungsort_ref);
    if (!id) return event.veranstaltungsort_refName || '—';
    const ort = veranstaltungsortMap.get(id);
    if (!ort) return event.veranstaltungsort_refName || '—';
    const name = ort.fields.ort_name ?? '';
    const city = ort.fields.stadt ? `, ${ort.fields.stadt}` : '';
    return `${name}${city}` || '—';
  }

  function getReferentName(event: EnrichedVeranstaltungen): string {
    const id = extractRecordId(event.fields.referenten_ref);
    if (!id) return '—';
    const ref = referentenMap.get(id);
    if (!ref) return '—';
    return `${ref.fields.ref_vorname ?? ''} ${ref.fields.ref_nachname ?? ''}`.trim() || '—';
  }

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">EventFlow</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Dein Veranstaltungsmanagement auf einen Blick</p>
        </div>
        <Button onClick={() => { setEditEvent(null); setEventDialogOpen(true); }} className="shrink-0">
          <IconPlus size={16} className="shrink-0 mr-1.5" />
          Neue Veranstaltung
        </Button>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Gesamt"
          value={String(enrichedVeranstaltungen.length)}
          description="Veranstaltungen"
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

      {/* Next Event Hero */}
      {nextEvent && (
        <div
          className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 p-5 cursor-pointer hover:border-primary/40 transition-all"
          onClick={() => setSelectedEvent(selectedEvent?.record_id === nextEvent.record_id ? null : nextEvent)}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-xs font-semibold text-primary uppercase tracking-wide">Nächste Veranstaltung</span>
                {nextEvent.fields.event_kategorie && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryBadge(nextEvent.fields.event_kategorie.key)}`}>
                    {nextEvent.fields.event_kategorie.label}
                  </span>
                )}
                {nextEvent.fields.event_status && (
                  <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadge(nextEvent.fields.event_status.key)}`}>
                    {nextEvent.fields.event_status.label}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-foreground truncate">{nextEvent.fields.event_titel || '—'}</h2>
              {nextEvent.fields.event_beschreibung && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{nextEvent.fields.event_beschreibung}</p>
              )}
              <div className="flex flex-wrap gap-4 mt-3">
                {nextEvent.fields.event_start && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconCalendar size={14} className="shrink-0 text-primary" />
                    <span>{formatDate(nextEvent.fields.event_start)}</span>
                  </div>
                )}
                {nextEvent.veranstaltungsort_refName && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconMapPin size={14} className="shrink-0 text-primary" />
                    <span className="truncate">{getVenueDetails(nextEvent)}</span>
                  </div>
                )}
                {nextEvent.fields.referenten_ref && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <IconMicrophone size={14} className="shrink-0 text-primary" />
                    <span className="truncate">{getReferentName(nextEvent)}</span>
                  </div>
                )}
              </div>
              {nextEvent.fields.event_max_teilnehmer != null && nextEvent.fields.event_max_teilnehmer > 0 && (() => {
                const max = nextEvent.fields.event_max_teilnehmer!;
                const reg = anmeldungenByEvent.get(nextEvent.record_id) ?? 0;
                const pct = Math.min((reg / max) * 100, 100);
                return (
                  <div className="mt-3 max-w-xs">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{reg} von {max} Plätzen</span>
                      <span className="font-semibold">{Math.round(pct)}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-primary/15 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })()}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={e => { e.stopPropagation(); setEditEvent(nextEvent); setEventDialogOpen(true); }}
                className="p-2 rounded-lg bg-background/60 hover:bg-background text-muted-foreground hover:text-foreground transition-colors"
                title="Bearbeiten"
              >
                <IconPencil size={15} className="shrink-0" />
              </button>
              <button
                onClick={e => { e.stopPropagation(); setSelectedEvent(selectedEvent?.record_id === nextEvent.record_id ? null : nextEvent); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                Anmeldungen
                <IconArrowRight size={13} className="shrink-0" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="grid grid-cols-1 lg:grid-cols-[5fr_4fr] gap-4 items-start">
        {/* Left: Event list with tabs */}
        <div className="flex flex-col gap-3">
          {/* Time tabs */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { key: 'alle', label: 'Alle', count: sortedAll.length },
              { key: 'heute', label: 'Heute', count: groups.heute.length },
              { key: 'woche', label: 'Diese Woche', count: groups.dieseWoche.length },
              { key: 'spaeter', label: 'Später & Vergangen', count: groups.spaeter.length + groups.vergangen.length },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span className={`text-[11px] font-semibold min-w-[16px] h-4 flex items-center justify-center rounded-full px-1 ${
                    activeTab === tab.key ? 'bg-white/20 text-white' : 'bg-background text-foreground'
                  }`}>{tab.count}</span>
                )}
              </button>
            ))}
          </div>

          {/* Event cards */}
          {visibleEvents.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 text-center bg-card rounded-2xl border border-border">
              <IconCalendarEvent size={48} className="text-muted-foreground mb-3" stroke={1.5} />
              <p className="text-sm font-medium text-foreground">Keine Veranstaltungen</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                {activeTab !== 'alle' ? 'Keine Veranstaltungen in diesem Zeitraum' : 'Erstelle deine erste Veranstaltung'}
              </p>
              {activeTab === 'alle' && (
                <Button size="sm" onClick={() => { setEditEvent(null); setEventDialogOpen(true); }}>
                  <IconPlus size={14} className="shrink-0 mr-1" />
                  Veranstaltung anlegen
                </Button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2 max-h-[560px] overflow-y-auto pr-0.5">
              {visibleEvents.map(event => {
                const regCount = anmeldungenByEvent.get(event.record_id) ?? 0;
                const isSelected = selectedEvent?.record_id === event.record_id;
                const max = event.fields.event_max_teilnehmer;
                const pct = max && max > 0 ? Math.min((regCount / max) * 100, 100) : null;

                return (
                  <div
                    key={event.record_id}
                    onClick={() => setSelectedEvent(isSelected ? null : event)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? 'bg-primary/5 border-primary/40 shadow-sm'
                        : 'bg-card border-border hover:border-primary/20 hover:bg-accent/20'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Date badge */}
                      <div className={`shrink-0 flex flex-col items-center justify-center w-11 h-11 rounded-xl text-center ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        {event.fields.event_start ? (
                          <>
                            <span className="text-[10px] font-medium uppercase leading-none">
                              {new Date(event.fields.event_start).toLocaleDateString('de-DE', { month: 'short' })}
                            </span>
                            <span className="text-lg font-bold leading-tight">
                              {new Date(event.fields.event_start).getDate()}
                            </span>
                          </>
                        ) : (
                          <IconCalendarEvent size={18} />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap gap-1 mb-1">
                          {event.fields.event_kategorie && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryBadge(event.fields.event_kategorie.key)}`}>
                              {event.fields.event_kategorie.label}
                            </span>
                          )}
                          {event.fields.event_status && (
                            <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadge(event.fields.event_status.key)}`}>
                              {event.fields.event_status.label}
                            </span>
                          )}
                        </div>
                        <p className="font-semibold text-sm text-foreground truncate">{event.fields.event_titel || '—'}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-0.5">
                          {event.fields.event_start && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconClockHour4 size={11} className="shrink-0" />
                              {new Date(event.fields.event_start).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr
                            </span>
                          )}
                          {event.veranstaltungsort_refName && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <IconMapPin size={11} className="shrink-0" />
                              <span className="truncate max-w-[120px]">{event.veranstaltungsort_refName}</span>
                            </span>
                          )}
                        </div>
                        {pct !== null && (
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="flex-1 h-1 rounded-full bg-muted overflow-hidden">
                              <div
                                className={`h-full rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-primary'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="text-[11px] text-muted-foreground shrink-0">{regCount}/{max}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
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

        {/* Right: Detail panel */}
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          {!selectedEvent ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
                <IconChevronRight size={24} className="text-muted-foreground" stroke={1.5} />
              </div>
              <p className="text-sm font-medium text-foreground">Veranstaltung auswählen</p>
              <p className="text-xs text-muted-foreground mt-1">Klicke auf eine Veranstaltung für Details und Anmeldungen</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {/* Header */}
              <div className="p-5 border-b border-border">
                <div className="flex items-start justify-between gap-2 min-w-0">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {selectedEvent.fields.event_kategorie && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${categoryBadge(selectedEvent.fields.event_kategorie.key)}`}>
                          {selectedEvent.fields.event_kategorie.label}
                        </span>
                      )}
                      {selectedEvent.fields.event_status && (
                        <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusBadge(selectedEvent.fields.event_status.key)}`}>
                          {selectedEvent.fields.event_status.label}
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-bold text-foreground leading-snug">{selectedEvent.fields.event_titel || '—'}</h2>
                    {selectedEvent.fields.event_beschreibung && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{selectedEvent.fields.event_beschreibung}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button
                      onClick={() => { setEditEvent(selectedEvent); setEventDialogOpen(true); }}
                      className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                      title="Bearbeiten"
                    >
                      <IconPencil size={14} className="shrink-0" />
                    </button>
                    <button
                      onClick={() => setDeleteEventTarget(selectedEvent)}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Löschen"
                    >
                      <IconTrash size={14} className="shrink-0" />
                    </button>
                  </div>
                </div>

                {/* Meta */}
                <div className="mt-3 flex flex-col gap-1.5">
                  {selectedEvent.fields.event_start && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconCalendar size={14} className="shrink-0 text-primary" />
                      <span className="truncate">
                        {formatDate(selectedEvent.fields.event_start)}
                        {selectedEvent.fields.event_ende ? ` – ${formatDate(selectedEvent.fields.event_ende)}` : ''}
                      </span>
                    </div>
                  )}
                  {selectedEvent.veranstaltungsort_refName && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconMapPin size={14} className="shrink-0 text-primary" />
                      <span className="truncate">{getVenueDetails(selectedEvent)}</span>
                    </div>
                  )}
                  {selectedEvent.fields.referenten_ref && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <IconMicrophone size={14} className="shrink-0 text-primary" />
                      <span className="truncate">{getReferentName(selectedEvent)}</span>
                    </div>
                  )}
                </div>

                {/* Capacity bar */}
                {selectedEvent.fields.event_max_teilnehmer != null && selectedEvent.fields.event_max_teilnehmer > 0 && (() => {
                  const max = selectedEvent.fields.event_max_teilnehmer!;
                  const reg = anmeldungenByEvent.get(selectedEvent.record_id) ?? 0;
                  const pct = Math.min((reg / max) * 100, 100);
                  return (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-muted-foreground mb-1">
                        <span>{reg} von {max} Plätzen belegt</span>
                        <span className={`font-semibold ${pct >= 90 ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-primary'}`}>{Math.round(pct)}%</span>
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

              {/* Registrations */}
              <div>
                <div className="px-5 py-3 flex items-center justify-between border-b border-border">
                  <h3 className="text-sm font-semibold text-foreground">
                    Anmeldungen <span className="text-muted-foreground font-normal">({selectedEventAnmeldungen.length})</span>
                  </h3>
                  <Button size="sm" onClick={() => { setEditAnmeldung(null); setAnmeldungDialogOpen(true); }}>
                    <IconPlus size={13} className="shrink-0 mr-1" />
                    Anmeldung
                  </Button>
                </div>

                {selectedEventAnmeldungen.length === 0 ? (
                  <div className="px-5 py-10 text-center">
                    <IconUsers size={32} className="text-muted-foreground mx-auto mb-2" stroke={1.5} />
                    <p className="text-sm text-muted-foreground">Noch keine Anmeldungen</p>
                    <button
                      onClick={() => { setEditAnmeldung(null); setAnmeldungDialogOpen(true); }}
                      className="mt-2 text-xs text-primary hover:underline"
                    >
                      Erste Anmeldung erfassen
                    </button>
                  </div>
                ) : (
                  <div className="px-4 py-3 space-y-1.5 max-h-[320px] overflow-y-auto">
                    {selectedEventAnmeldungen.map(anm => {
                      const statusKey = anm.fields.anm_status?.key;
                      return (
                        <div key={anm.record_id} className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors group">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            statusKey === 'bestaetigt' ? 'bg-green-100' :
                            statusKey === 'storniert' ? 'bg-red-100' :
                            statusKey === 'warteliste' ? 'bg-orange-100' : 'bg-yellow-100'
                          }`}>
                            {statusKey === 'bestaetigt' ? <IconCheck size={12} className="text-green-600" /> :
                             statusKey === 'storniert' ? <IconX size={12} className="text-red-600" /> :
                             <IconClockHour4 size={12} className={statusKey === 'warteliste' ? 'text-orange-600' : 'text-yellow-600'} />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{getParticipantName(anm)}</p>
                            <div className="flex flex-wrap items-center gap-2">
                              {anm.fields.anm_datum && (
                                <span className="text-[11px] text-muted-foreground">{formatDate(anm.fields.anm_datum)}</span>
                              )}
                              {anm.fields.anm_status && (
                                <span className={`text-[11px] font-medium px-1.5 py-0.5 rounded-full ${anmStatusBadge(anm.fields.anm_status.key)}`}>
                                  {anm.fields.anm_status.label}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <button
                              onClick={() => { setEditAnmeldung(anm); setAnmeldungDialogOpen(true); }}
                              className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                              title="Bearbeiten"
                            >
                              <IconPencil size={12} className="shrink-0" />
                            </button>
                            <button
                              onClick={() => setDeleteAnmeldungTarget(anm)}
                              className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                              title="Löschen"
                            >
                              <IconTrash size={12} className="shrink-0" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
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
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <Skeleton className="h-28 rounded-2xl" />
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
