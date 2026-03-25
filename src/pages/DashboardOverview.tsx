import { useState, useMemo } from 'react';
import { useDashboardData } from '@/hooks/useDashboardData';
import { enrichVeranstaltungen, enrichAnmeldungen, enrichTeilnehmerAnmeldung } from '@/lib/enrich';
import type { EnrichedVeranstaltungen } from '@/types/enriched';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { formatDate } from '@/lib/formatters';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/StatCard';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { AnmeldungenDialog } from '@/components/dialogs/AnmeldungenDialog';
import { TeilnehmerAnmeldungDialog } from '@/components/dialogs/TeilnehmerAnmeldungDialog';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import {
  IconAlertCircle,
  IconCalendar,
  IconUsers,
  IconPlus,
  IconPencil,
  IconTrash,
  IconMapPin,
  IconUserCheck,
  IconClipboardList,
  IconChevronRight,
  IconRocket,
  IconCalendarPlus,
  IconUsersPlus,
} from '@tabler/icons-react';

export default function DashboardOverview() {
  const {
    veranstaltungsort, referenten, veranstaltungen, teilnehmer, anmeldungen, teilnehmerAnmeldung,
    veranstaltungsortMap, referentenMap, veranstaltungenMap, teilnehmerMap,
    loading, error, fetchAll,
  } = useDashboardData();

  const enrichedVeranstaltungen = enrichVeranstaltungen(veranstaltungen, { veranstaltungsortMap, referentenMap });
  const enrichedAnmeldungen = enrichAnmeldungen(anmeldungen, { veranstaltungenMap, teilnehmerMap });
  const enrichedTeilnehmerAnmeldung = enrichTeilnehmerAnmeldung(teilnehmerAnmeldung, { veranstaltungenMap });

  const [selectedEvent, setSelectedEvent] = useState<EnrichedVeranstaltungen | null>(null);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EnrichedVeranstaltungen | null>(null);
  const [deleteEventTarget, setDeleteEventTarget] = useState<EnrichedVeranstaltungen | null>(null);
  const [anmeldungDialogOpen, setAnmeldungDialogOpen] = useState(false);
  const [quickRegDialogOpen, setQuickRegDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');

  const now = new Date();

  const upcomingEvents = useMemo(() =>
    enrichedVeranstaltungen
      .filter(e => e.fields.event_start && new Date(e.fields.event_start) >= now)
      .sort((a, b) => new Date(a.fields.event_start!).getTime() - new Date(b.fields.event_start!).getTime()),
    [enrichedVeranstaltungen]
  );

  const pastEvents = useMemo(() =>
    enrichedVeranstaltungen
      .filter(e => e.fields.event_start && new Date(e.fields.event_start) < now)
      .sort((a, b) => new Date(b.fields.event_start!).getTime() - new Date(a.fields.event_start!).getTime()),
    [enrichedVeranstaltungen]
  );

  const confirmedRegs = useMemo(
    () => anmeldungen.filter(a => a.fields.anm_status?.key === 'bestaetigt').length,
    [anmeldungen]
  );

  const eventRegistrationCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    anmeldungen.forEach(a => {
      const url = a.fields.anm_veranstaltung;
      if (url) {
        const match = url.match(/([a-f0-9]{24})$/i);
        const id = match ? match[1] : null;
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      }
    });
    enrichedTeilnehmerAnmeldung.forEach(ta => {
      const url = ta.fields.ta_veranstaltung;
      if (url) {
        const match = url.match(/([a-f0-9]{24})$/i);
        const id = match ? match[1] : null;
        if (id) counts[id] = (counts[id] ?? 0) + 1;
      }
    });
    return counts;
  }, [anmeldungen, enrichedTeilnehmerAnmeldung]);

  const displayEvents = activeTab === 'upcoming' ? upcomingEvents : pastEvents;

  if (loading) return <DashboardSkeleton />;
  if (error) return <DashboardError error={error} onRetry={fetchAll} />;

  const statusColors: Record<string, string> = {
    geplant: 'bg-blue-100 text-blue-700',
    bestaetigt: 'bg-green-100 text-green-700',
    abgesagt: 'bg-red-100 text-red-700',
    abgeschlossen: 'bg-gray-100 text-gray-600',
  };

  const categoryColors: Record<string, string> = {
    konferenz: 'bg-violet-100 text-violet-700',
    workshop: 'bg-amber-100 text-amber-700',
    seminar: 'bg-sky-100 text-sky-700',
    networking: 'bg-teal-100 text-teal-700',
    messe: 'bg-rose-100 text-rose-700',
    sonstiges: 'bg-stone-100 text-stone-600',
  };

  const handleDeleteEvent = async () => {
    if (!deleteEventTarget) return;
    await LivingAppsService.deleteVeranstaltungenEntry(deleteEventTarget.record_id);
    if (selectedEvent?.record_id === deleteEventTarget.record_id) setSelectedEvent(null);
    setDeleteEventTarget(null);
    fetchAll();
  };

  const selectedEventRegs = selectedEvent
    ? enrichedAnmeldungen.filter(a => {
        const url = a.fields.anm_veranstaltung;
        if (!url) return false;
        const match = url.match(/([a-f0-9]{24})$/i);
        return match ? match[1] === selectedEvent.record_id : false;
      })
    : [];

  const selectedEventTaRegs = selectedEvent
    ? enrichedTeilnehmerAnmeldung.filter(ta => {
        const url = ta.fields.ta_veranstaltung;
        if (!url) return false;
        const match = url.match(/([a-f0-9]{24})$/i);
        return match ? match[1] === selectedEvent.record_id : false;
      })
    : [];

  const totalRegsForSelected = selectedEventRegs.length + selectedEventTaRegs.length;
  const maxCapacity = selectedEvent?.fields.event_max_teilnehmer ?? 0;
  const capacityPct = maxCapacity > 0 ? Math.min(100, Math.round((totalRegsForSelected / maxCapacity) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Workflows */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <IconRocket size={18} className="text-primary" />
          <h2 className="font-semibold text-base">Workflows</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a
            href="#/intents/event-setup"
            className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-primary flex items-center gap-4 min-w-0 group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconCalendarPlus size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Veranstaltung planen</p>
              <p className="text-xs text-muted-foreground mt-0.5">Ort, Referent und Event in einem Durchgang anlegen</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </a>
          <a
            href="#/intents/batch-registration"
            className="bg-card border border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-primary flex items-center gap-4 min-w-0 group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <IconUsersPlus size={20} className="text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm">Teilnehmer anmelden</p>
              <p className="text-xs text-muted-foreground mt-0.5">Mehrere Teilnehmer auf einmal für ein Event registrieren</p>
            </div>
            <IconChevronRight size={16} className="text-muted-foreground shrink-0 group-hover:translate-x-0.5 transition-transform" />
          </a>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          title="Veranstaltungen"
          value={String(veranstaltungen.length)}
          description={`${upcomingEvents.length} bevorstehend`}
          icon={<IconCalendar size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Teilnehmer"
          value={String(teilnehmer.length)}
          description="Registriert"
          icon={<IconUsers size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Anmeldungen"
          value={String(anmeldungen.length + teilnehmerAnmeldung.length)}
          description={`${confirmedRegs} bestätigt`}
          icon={<IconClipboardList size={18} className="text-muted-foreground" />}
        />
        <StatCard
          title="Veranstaltungsorte"
          value={String(veranstaltungsort.length)}
          description="Verfügbar"
          icon={<IconMapPin size={18} className="text-muted-foreground" />}
        />
      </div>

      {/* Main workspace: Event list + Detail panel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
        {/* Event List */}
        <div className="lg:col-span-2 rounded-2xl border bg-card overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-4 pb-2 gap-2 flex-wrap">
            <h2 className="font-semibold text-base">Veranstaltungen</h2>
            <Button
              size="sm"
              className="shrink-0"
              onClick={() => { setEditEvent(null); setEventDialogOpen(true); }}
            >
              <IconPlus size={14} className="shrink-0 mr-1" />
              <span className="hidden sm:inline">Neu</span>
            </Button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 px-4 pb-2">
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTab === 'upcoming'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Bevorstehend ({upcomingEvents.length})
            </button>
            <button
              onClick={() => setActiveTab('past')}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                activeTab === 'past'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80'
              }`}
            >
              Vergangen ({pastEvents.length})
            </button>
          </div>

          <div className="divide-y max-h-[520px] overflow-y-auto">
            {displayEvents.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
                <IconCalendar size={36} stroke={1.5} />
                <p className="text-sm">Keine Veranstaltungen</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setEditEvent(null); setEventDialogOpen(true); }}
                >
                  <IconPlus size={14} className="mr-1 shrink-0" />
                  Erstellen
                </Button>
              </div>
            ) : (
              displayEvents.map(event => {
                const isSelected = selectedEvent?.record_id === event.record_id;
                const regCount = eventRegistrationCounts[event.record_id] ?? 0;
                const statusKey = event.fields.event_status?.key ?? '';
                const categoryKey = event.fields.event_kategorie?.key ?? '';
                return (
                  <button
                    key={event.record_id}
                    onClick={() => setSelectedEvent(isSelected ? null : event)}
                    className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 min-w-0 ${
                      isSelected
                        ? 'bg-accent'
                        : 'hover:bg-accent/50'
                    }`}
                  >
                    {/* Date box */}
                    <div className="shrink-0 w-10 flex flex-col items-center text-center">
                      <span className="text-xs text-muted-foreground leading-none">
                        {event.fields.event_start
                          ? new Date(event.fields.event_start).toLocaleDateString('de-DE', { month: 'short' })
                          : '—'}
                      </span>
                      <span className="text-lg font-bold leading-tight">
                        {event.fields.event_start
                          ? new Date(event.fields.event_start).getDate()
                          : '—'}
                      </span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{event.fields.event_titel ?? '(Kein Titel)'}</p>
                      <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                        {categoryKey && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${categoryColors[categoryKey] ?? 'bg-muted text-muted-foreground'}`}>
                            {event.fields.event_kategorie?.label}
                          </span>
                        )}
                        {statusKey && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${statusColors[statusKey] ?? 'bg-muted text-muted-foreground'}`}>
                            {event.fields.event_status?.label}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {event.veranstaltungsort_refName && (
                          <span className="flex items-center gap-0.5 min-w-0 truncate">
                            <IconMapPin size={10} className="shrink-0" />
                            <span className="truncate">{event.veranstaltungsort_refName}</span>
                          </span>
                        )}
                        {regCount > 0 && (
                          <span className="flex items-center gap-0.5 shrink-0">
                            <IconUsers size={10} className="shrink-0" />
                            {regCount}
                          </span>
                        )}
                      </div>
                    </div>

                    <IconChevronRight size={14} className={`shrink-0 mt-1 transition-transform ${isSelected ? 'rotate-90' : ''} text-muted-foreground`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Detail Panel */}
        <div className="lg:col-span-3 rounded-2xl border bg-card overflow-hidden">
          {!selectedEvent ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground px-6 text-center">
              <IconCalendar size={48} stroke={1.5} />
              <p className="text-sm font-medium">Veranstaltung auswählen</p>
              <p className="text-xs">Wähle eine Veranstaltung aus der Liste aus, um Details und Anmeldungen zu sehen.</p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Event header */}
              <div className="px-5 pt-5 pb-4 border-b">
                <div className="flex items-start gap-3 justify-between flex-wrap">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold text-base truncate">{selectedEvent.fields.event_titel ?? '(Kein Titel)'}</h3>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedEvent.fields.event_kategorie && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${categoryColors[selectedEvent.fields.event_kategorie.key] ?? 'bg-muted text-muted-foreground'}`}>
                          {selectedEvent.fields.event_kategorie.label}
                        </span>
                      )}
                      {selectedEvent.fields.event_status && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[selectedEvent.fields.event_status.key] ?? 'bg-muted text-muted-foreground'}`}>
                          {selectedEvent.fields.event_status.label}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => { setEditEvent(selectedEvent); setEventDialogOpen(true); }}
                    >
                      <IconPencil size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => setDeleteEventTarget(selectedEvent)}
                    >
                      <IconTrash size={14} />
                    </Button>
                  </div>
                </div>

                {/* Event meta */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <IconCalendar size={14} className="shrink-0" />
                    <span className="truncate">
                      {selectedEvent.fields.event_start ? formatDate(selectedEvent.fields.event_start) : '—'}
                      {selectedEvent.fields.event_ende ? ` – ${formatDate(selectedEvent.fields.event_ende)}` : ''}
                    </span>
                  </div>
                  {selectedEvent.veranstaltungsort_refName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconMapPin size={14} className="shrink-0" />
                      <span className="truncate">{selectedEvent.veranstaltungsort_refName}</span>
                    </div>
                  )}
                  {selectedEvent.referenten_refName && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconUserCheck size={14} className="shrink-0" />
                      <span className="truncate">{selectedEvent.referenten_refName}</span>
                    </div>
                  )}
                  {selectedEvent.fields.event_max_teilnehmer && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <IconUsers size={14} className="shrink-0" />
                      <span className="truncate">{totalRegsForSelected} / {selectedEvent.fields.event_max_teilnehmer} Plätze</span>
                    </div>
                  )}
                </div>

                {/* Capacity bar */}
                {maxCapacity > 0 && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>Auslastung</span>
                      <span>{capacityPct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          capacityPct >= 90 ? 'bg-red-500' : capacityPct >= 70 ? 'bg-amber-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${capacityPct}%` }}
                      />
                    </div>
                  </div>
                )}

                {selectedEvent.fields.event_beschreibung && (
                  <p className="mt-3 text-sm text-muted-foreground line-clamp-2">
                    {selectedEvent.fields.event_beschreibung}
                  </p>
                )}
              </div>

              {/* Registrations */}
              <div className="px-5 pt-4 pb-5 flex-1 overflow-hidden">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <h4 className="font-medium text-sm">
                    Anmeldungen
                    {totalRegsForSelected > 0 && (
                      <Badge variant="secondary" className="ml-2 text-xs">{totalRegsForSelected}</Badge>
                    )}
                  </h4>
                  <div className="flex gap-2 flex-wrap">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setAnmeldungDialogOpen(true)}
                    >
                      <IconPlus size={13} className="mr-1 shrink-0" />
                      <span className="hidden sm:inline">Teilnehmer</span>
                      <span className="sm:hidden">TN</span>
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => setQuickRegDialogOpen(true)}
                    >
                      <IconPlus size={13} className="mr-1 shrink-0" />
                      <span className="hidden sm:inline">Schnellanmeldung</span>
                      <span className="sm:hidden">Schnell</span>
                    </Button>
                  </div>
                </div>

                {totalRegsForSelected === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-muted-foreground">
                    <IconClipboardList size={32} stroke={1.5} />
                    <p className="text-sm">Noch keine Anmeldungen</p>
                  </div>
                ) : (
                  <div className="space-y-1 max-h-64 overflow-y-auto pr-1">
                    {selectedEventRegs.map(reg => {
                      const statusKey = reg.fields.anm_status?.key ?? '';
                      return (
                        <div key={reg.record_id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/40 min-w-0">
                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <IconUsers size={13} className="text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{reg.anm_teilnehmerName || '—'}</p>
                            {reg.fields.anm_datum && (
                              <p className="text-xs text-muted-foreground">{formatDate(reg.fields.anm_datum)}</p>
                            )}
                          </div>
                          {statusKey && (
                            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 ${
                              statusKey === 'bestaetigt' ? 'bg-green-100 text-green-700'
                              : statusKey === 'ausstehend' ? 'bg-yellow-100 text-yellow-700'
                              : statusKey === 'storniert' ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-600'
                            }`}>
                              {reg.fields.anm_status?.label}
                            </span>
                          )}
                        </div>
                      );
                    })}
                    {selectedEventTaRegs.map(ta => (
                      <div key={ta.record_id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-muted/40 min-w-0">
                        <div className="w-7 h-7 rounded-full bg-secondary/50 flex items-center justify-center shrink-0">
                          <IconUserCheck size={13} className="text-secondary-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {[ta.fields.ta_vorname, ta.fields.ta_nachname].filter(Boolean).join(' ') || '—'}
                          </p>
                          {ta.fields.ta_email && (
                            <p className="text-xs text-muted-foreground truncate">{ta.fields.ta_email}</p>
                          )}
                        </div>
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-sky-100 text-sky-700">
                          Direkt
                        </span>
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

      {selectedEvent && (
        <>
          <AnmeldungenDialog
            open={anmeldungDialogOpen}
            onClose={() => setAnmeldungDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createAnmeldungenEntry(fields);
              fetchAll();
            }}
            defaultValues={{
              anm_veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent.record_id),
            }}
            veranstaltungenList={veranstaltungen}
            teilnehmerList={teilnehmer}
            enablePhotoScan={AI_PHOTO_SCAN['Anmeldungen']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Anmeldungen']}
          />

          <TeilnehmerAnmeldungDialog
            open={quickRegDialogOpen}
            onClose={() => setQuickRegDialogOpen(false)}
            onSubmit={async (fields) => {
              await LivingAppsService.createTeilnehmerAnmeldungEntry(fields);
              fetchAll();
            }}
            defaultValues={{
              ta_veranstaltung: createRecordUrl(APP_IDS.VERANSTALTUNGEN, selectedEvent.record_id),
            }}
            veranstaltungenList={veranstaltungen}
            enablePhotoScan={AI_PHOTO_SCAN['TeilnehmerAnmeldung']}
            enablePhotoLocation={AI_PHOTO_LOCATION['TeilnehmerAnmeldung']}
          />
        </>
      )}

      <ConfirmDialog
        open={!!deleteEventTarget}
        title="Veranstaltung löschen"
        description={`"${deleteEventTarget?.fields.event_titel}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        onConfirm={handleDeleteEvent}
        onClose={() => setDeleteEventTarget(null)}
      />
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        <Skeleton className="lg:col-span-2 h-96 rounded-2xl" />
        <Skeleton className="lg:col-span-3 h-96 rounded-2xl" />
      </div>
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
