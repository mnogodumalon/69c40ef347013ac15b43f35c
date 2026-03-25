import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { IntentWizardShell } from '@/components/IntentWizardShell';
import { EntitySelectStep } from '@/components/EntitySelectStep';
import { VeranstaltungsortDialog } from '@/components/dialogs/VeranstaltungsortDialog';
import { ReferentenDialog } from '@/components/dialogs/ReferentenDialog';
import { VeranstaltungenDialog } from '@/components/dialogs/VeranstaltungenDialog';
import { useDashboardData } from '@/hooks/useDashboardData';
import type { Veranstaltungsort, Referenten, Veranstaltungen } from '@/types/app';
import { APP_IDS } from '@/types/app';
import { LivingAppsService, createRecordUrl } from '@/services/livingAppsService';
import { AI_PHOTO_SCAN, AI_PHOTO_LOCATION } from '@/config/ai-features';
import { Button } from '@/components/ui/button';
import {
  IconMapPin,
  IconUser,
  IconCalendarEvent,
  IconCircleCheck,
  IconArrowRight,
  IconArrowLeft,
  IconExternalLink,
  IconRefresh,
  IconBuilding,
  IconMicrophone2,
} from '@tabler/icons-react';

const WIZARD_STEPS = [
  { label: 'Veranstaltungsort' },
  { label: 'Referent' },
  { label: 'Event-Details' },
  { label: 'Abschluss' },
];

export default function EventSetupPage() {
  const [searchParams] = useSearchParams();
  const { veranstaltungsort, referenten, veranstaltungen, loading, error, fetchAll } =
    useDashboardData();

  // Deep-link param reading (1-indexed step)
  const initialStep = (() => {
    const s = parseInt(searchParams.get('step') ?? '', 10);
    if (s >= 1 && s <= 4) return s;
    return 1;
  })();

  const [currentStep, setCurrentStep] = useState(initialStep);
  const [selectedVenueId, setSelectedVenueId] = useState<string | null>(
    searchParams.get('venueId')
  );
  const [selectedSpeakerId, setSelectedSpeakerId] = useState<string | null>(
    searchParams.get('speakerId')
  );
  const [createdEventId, setCreatedEventId] = useState<string | null>(null);

  // Dialog open states
  const [venueDialogOpen, setVenueDialogOpen] = useState(false);
  const [speakerDialogOpen, setSpeakerDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);

  // If venueId + speakerId are pre-supplied via URL, jump to step 3
  useEffect(() => {
    const urlVenueId = searchParams.get('venueId');
    const urlSpeakerId = searchParams.get('speakerId');
    if (urlVenueId && urlSpeakerId) {
      setSelectedVenueId(urlVenueId);
      setSelectedSpeakerId(urlSpeakerId);
      const urlStep = parseInt(searchParams.get('step') ?? '', 10);
      if (!urlStep || urlStep < 3) {
        setCurrentStep(3);
      }
    }
  // Only run on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Derived lookups
  const selectedVenue: Veranstaltungsort | null =
    selectedVenueId
      ? (veranstaltungsort.find((v) => v.record_id === selectedVenueId) ?? null)
      : null;

  const selectedSpeaker: Referenten | null =
    selectedSpeakerId
      ? (referenten.find((r) => r.record_id === selectedSpeakerId) ?? null)
      : null;

  const createdEvent: Veranstaltungen | null =
    createdEventId
      ? (veranstaltungen.find((e) => e.record_id === createdEventId) ?? null)
      : null;

  // Handlers
  const handleVenueSelect = useCallback((id: string) => {
    setSelectedVenueId(id);
  }, []);

  const handleSpeakerSelect = useCallback((id: string) => {
    setSelectedSpeakerId(id);
  }, []);

  const handleVenueCreate = useCallback(
    async (fields: Veranstaltungsort['fields']) => {
      await LivingAppsService.createVeranstaltungsortEntry(fields);
      await fetchAll();
      // Auto-select: the newest record will appear after fetchAll — we find it after reload
    },
    [fetchAll]
  );

  // After creating a venue, the newest record appears; auto-select it
  const [pendingAutoSelectVenue, setPendingAutoSelectVenue] = useState(false);
  const [pendingAutoSelectSpeaker, setPendingAutoSelectSpeaker] = useState(false);

  const handleVenueCreateAndAutoSelect = useCallback(
    async (fields: Veranstaltungsort['fields']) => {
      await handleVenueCreate(fields);
      setPendingAutoSelectVenue(true);
    },
    [handleVenueCreate]
  );

  const handleSpeakerCreateAndAutoSelect = useCallback(
    async (fields: Referenten['fields']) => {
      await LivingAppsService.createReferentenEntry(fields);
      await fetchAll();
      setPendingAutoSelectSpeaker(true);
    },
    [fetchAll]
  );

  // Watch for auto-select after data refresh
  useEffect(() => {
    if (pendingAutoSelectVenue && veranstaltungsort.length > 0) {
      const newest = veranstaltungsort[veranstaltungsort.length - 1];
      setSelectedVenueId(newest.record_id);
      setPendingAutoSelectVenue(false);
      setCurrentStep(2);
    }
  }, [pendingAutoSelectVenue, veranstaltungsort]);

  useEffect(() => {
    if (pendingAutoSelectSpeaker && referenten.length > 0) {
      const newest = referenten[referenten.length - 1];
      setSelectedSpeakerId(newest.record_id);
      setPendingAutoSelectSpeaker(false);
      setCurrentStep(3);
    }
  }, [pendingAutoSelectSpeaker, referenten]);

  const handleEventCreate = useCallback(
    async (fields: Veranstaltungen['fields']) => {
      await LivingAppsService.createVeranstaltungenEntry(fields);
      await fetchAll();
      // Mark that we need to find the newly created event
      setPendingAutoSelectEvent(true);
    },
    [fetchAll]
  );

  const [pendingAutoSelectEvent, setPendingAutoSelectEvent] = useState(false);

  useEffect(() => {
    if (pendingAutoSelectEvent && veranstaltungen.length > 0) {
      const newest = veranstaltungen[veranstaltungen.length - 1];
      setCreatedEventId(newest.record_id);
      setPendingAutoSelectEvent(false);
      setCurrentStep(4);
    }
  }, [pendingAutoSelectEvent, veranstaltungen]);

  const resetWizard = useCallback(() => {
    setSelectedVenueId(null);
    setSelectedSpeakerId(null);
    setCreatedEventId(null);
    setCurrentStep(1);
  }, []);

  // Progress context bar
  const ProgressBar = () => {
    const hasAny = selectedVenue || selectedSpeaker || createdEvent;
    if (!hasAny) return null;
    return (
      <div className="flex items-center gap-2 flex-wrap px-1 py-2">
        {selectedVenue && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
            <IconBuilding size={12} />
            {selectedVenue.fields.ort_name ?? 'Ort'}
          </span>
        )}
        {selectedVenue && selectedSpeaker && (
          <IconArrowRight size={12} className="text-muted-foreground shrink-0" />
        )}
        {selectedSpeaker && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
            <IconMicrophone2 size={12} />
            {[selectedSpeaker.fields.ref_vorname, selectedSpeaker.fields.ref_nachname]
              .filter(Boolean)
              .join(' ') || 'Referent'}
          </span>
        )}
        {selectedSpeaker && createdEvent && (
          <IconArrowRight size={12} className="text-muted-foreground shrink-0" />
        )}
        {createdEvent && (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-green-100 text-green-700 px-3 py-1 rounded-full">
            <IconCalendarEvent size={12} />
            {createdEvent.fields.event_titel ?? 'Veranstaltung'}
          </span>
        )}
      </div>
    );
  };

  // ─── Step 1: Venue ───────────────────────────────────────────────────────────
  const renderStep1 = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Veranstaltungsort auswählen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Wählen Sie einen bestehenden Ort oder legen Sie einen neuen an.
        </p>
      </div>

      <EntitySelectStep
        items={veranstaltungsort.map((v) => ({
          id: v.record_id,
          title: v.fields.ort_name ?? '(Kein Name)',
          subtitle: [v.fields.stadt, v.fields.land].filter(Boolean).join(', '),
          icon: <IconMapPin size={18} className="text-primary" />,
          stats:
            v.fields.kapazitaet != null
              ? [{ label: 'Kapazitat', value: `${v.fields.kapazitaet} Platze` }]
              : undefined,
        }))}
        onSelect={handleVenueSelect}
        searchPlaceholder="Ort suchen..."
        emptyIcon={<IconMapPin size={32} />}
        emptyText="Noch kein Veranstaltungsort vorhanden."
        createLabel="Neuen Ort erstellen"
        onCreateNew={() => setVenueDialogOpen(true)}
        createDialog={
          <VeranstaltungsortDialog
            open={venueDialogOpen}
            onClose={() => setVenueDialogOpen(false)}
            onSubmit={handleVenueCreateAndAutoSelect}
            defaultValues={undefined}
            enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungsort']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungsort']}
          />
        }
      />

      <div className="flex justify-end pt-2">
        <Button
          disabled={!selectedVenueId}
          onClick={() => setCurrentStep(2)}
          className="gap-2"
        >
          Weiter
          <IconArrowRight size={16} />
        </Button>
      </div>
    </div>
  );

  // ─── Step 2: Speaker ─────────────────────────────────────────────────────────
  const renderStep2 = () => (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Referenten auswählen</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Wählen Sie einen Referenten oder legen Sie einen neuen an.
        </p>
      </div>

      <EntitySelectStep
        items={referenten.map((r) => ({
          id: r.record_id,
          title:
            [r.fields.ref_vorname, r.fields.ref_nachname].filter(Boolean).join(' ') ||
            '(Kein Name)',
          subtitle: r.fields.ref_fachgebiet,
          status: r.fields.ref_email
            ? { key: 'aktiv', label: r.fields.ref_email }
            : undefined,
          icon: <IconUser size={18} className="text-primary" />,
        }))}
        onSelect={handleSpeakerSelect}
        searchPlaceholder="Referent suchen..."
        emptyIcon={<IconUser size={32} />}
        emptyText="Noch kein Referent vorhanden."
        createLabel="Neuen Referenten erstellen"
        onCreateNew={() => setSpeakerDialogOpen(true)}
        createDialog={
          <ReferentenDialog
            open={speakerDialogOpen}
            onClose={() => setSpeakerDialogOpen(false)}
            onSubmit={handleSpeakerCreateAndAutoSelect}
            defaultValues={undefined}
            enablePhotoScan={AI_PHOTO_SCAN['Referenten']}
            enablePhotoLocation={AI_PHOTO_LOCATION['Referenten']}
          />
        }
      />

      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={() => setCurrentStep(1)} className="gap-2">
          <IconArrowLeft size={16} />
          Zuruck
        </Button>
        <Button
          disabled={!selectedSpeakerId}
          onClick={() => setCurrentStep(3)}
          className="gap-2"
        >
          Weiter
          <IconArrowRight size={16} />
        </Button>
      </div>
    </div>
  );

  // ─── Step 3: Event Details ───────────────────────────────────────────────────
  const renderStep3 = () => {
    const venueName = selectedVenue?.fields.ort_name ?? '–';
    const venueLocation = [selectedVenue?.fields.stadt, selectedVenue?.fields.land]
      .filter(Boolean)
      .join(', ');
    const speakerName =
      [selectedSpeaker?.fields.ref_vorname, selectedSpeaker?.fields.ref_nachname]
        .filter(Boolean)
        .join(' ') || '–';
    const speakerField = selectedSpeaker?.fields.ref_fachgebiet ?? '';

    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Veranstaltung anlegen</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Die Veranstaltung wird mit dem gewahlten Ort und Referenten verknupft.
          </p>
        </div>

        {/* Summary card of chosen venue + speaker */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="rounded-xl border bg-card p-4 flex items-start gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconBuilding size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Veranstaltungsort
              </p>
              <p className="font-semibold text-sm truncate">{venueName}</p>
              {venueLocation && (
                <p className="text-xs text-muted-foreground truncate">{venueLocation}</p>
              )}
              {selectedVenue?.fields.kapazitaet != null && (
                <p className="text-xs text-muted-foreground">
                  {selectedVenue.fields.kapazitaet} Platze
                </p>
              )}
            </div>
          </div>

          <div className="rounded-xl border bg-card p-4 flex items-start gap-3 overflow-hidden">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <IconMicrophone2 size={18} className="text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
                Referent
              </p>
              <p className="font-semibold text-sm truncate">{speakerName}</p>
              {speakerField && (
                <p className="text-xs text-muted-foreground truncate">{speakerField}</p>
              )}
              {selectedSpeaker?.fields.ref_email && (
                <p className="text-xs text-muted-foreground truncate">
                  {selectedSpeaker.fields.ref_email}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Event creation button */}
        <div className="flex flex-col items-center gap-3 py-4">
          <Button
            size="lg"
            onClick={() => setEventDialogOpen(true)}
            className="gap-2 w-full sm:w-auto"
          >
            <IconCalendarEvent size={18} />
            Veranstaltung erstellen
          </Button>
          <p className="text-xs text-muted-foreground text-center">
            Das Formular wird mit Ort und Referenten vorab ausgefullt.
          </p>
        </div>

        <VeranstaltungenDialog
          open={eventDialogOpen}
          onClose={() => setEventDialogOpen(false)}
          onSubmit={handleEventCreate}
          defaultValues={
            selectedVenueId && selectedSpeakerId
              ? {
                  veranstaltungsort_ref: createRecordUrl(
                    APP_IDS.VERANSTALTUNGSORT,
                    selectedVenueId
                  ),
                  referenten_ref: createRecordUrl(APP_IDS.REFERENTEN, selectedSpeakerId),
                }
              : undefined
          }
          veranstaltungsortList={veranstaltungsort}
          referentenList={referenten}
          enablePhotoScan={AI_PHOTO_SCAN['Veranstaltungen']}
          enablePhotoLocation={AI_PHOTO_LOCATION['Veranstaltungen']}
        />

        <div className="flex items-center justify-between pt-2">
          <Button variant="outline" onClick={() => setCurrentStep(2)} className="gap-2">
            <IconArrowLeft size={16} />
            Zuruck
          </Button>
        </div>
      </div>
    );
  };

  // ─── Step 4: Summary ─────────────────────────────────────────────────────────
  const renderStep4 = () => {
    const eventTitle = createdEvent?.fields.event_titel ?? 'Neue Veranstaltung';
    const eventStart = createdEvent?.fields.event_start;
    const eventEnd = createdEvent?.fields.event_ende;
    const venueName = selectedVenue?.fields.ort_name ?? '–';
    const speakerName =
      [selectedSpeaker?.fields.ref_vorname, selectedSpeaker?.fields.ref_nachname]
        .filter(Boolean)
        .join(' ') || '–';

    const formatDate = (iso?: string) => {
      if (!iso) return null;
      try {
        return new Date(iso).toLocaleString('de-DE', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        return iso;
      }
    };

    return (
      <div className="space-y-5">
        {/* Success hero */}
        <div className="flex flex-col items-center text-center py-6 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-green-100 flex items-center justify-center">
            <IconCircleCheck size={36} className="text-green-600" stroke={1.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold">Veranstaltung angelegt!</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Alle Daten wurden erfolgreich gespeichert.
            </p>
          </div>
        </div>

        {/* Event details card */}
        <div className="rounded-xl border bg-card overflow-hidden">
          <div className="p-4 border-b bg-muted/30">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Veranstaltung
            </p>
            <h3 className="font-bold text-base mt-0.5 truncate">{eventTitle}</h3>
          </div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {eventStart && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Beginn</p>
                <p className="text-sm font-medium">{formatDate(eventStart)}</p>
              </div>
            )}
            {eventEnd && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Ende</p>
                <p className="text-sm font-medium">{formatDate(eventEnd)}</p>
              </div>
            )}
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Veranstaltungsort</p>
              <p className="text-sm font-medium truncate">{venueName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Referent</p>
              <p className="text-sm font-medium truncate">{speakerName}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Anmeldungen</p>
              <p className="text-sm font-medium">0 Anmeldungen</p>
            </div>
            {createdEvent?.fields.event_status && (
              <div>
                <p className="text-xs text-muted-foreground mb-0.5">Status</p>
                <p className="text-sm font-medium">
                  {typeof createdEvent.fields.event_status === 'object'
                    ? createdEvent.fields.event_status.label
                    : createdEvent.fields.event_status}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {createdEventId && (
            <a
              href={`#/intents/batch-registration?eventId=${createdEventId}`}
              className="flex-1"
            >
              <Button className="w-full gap-2" size="lg">
                <IconExternalLink size={16} />
                Anmeldungen verwalten
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            size="lg"
            onClick={resetWizard}
            className="flex-1 gap-2"
          >
            <IconRefresh size={16} />
            Neue Veranstaltung planen
          </Button>
        </div>
      </div>
    );
  };

  const renderCurrentStep = () => {
    switch (currentStep) {
      case 1:
        return renderStep1();
      case 2:
        return renderStep2();
      case 3:
        return renderStep3();
      case 4:
        return renderStep4();
      default:
        return renderStep1();
    }
  };

  return (
    <IntentWizardShell
      title="Veranstaltung einrichten"
      subtitle="Fuhrung durch Ort, Referent und Event-Details in einem Arbeitsablauf"
      steps={WIZARD_STEPS}
      currentStep={currentStep}
      onStepChange={setCurrentStep}
      loading={loading}
      error={error}
      onRetry={fetchAll}
    >
      <div className="space-y-3">
        <ProgressBar />
        {renderCurrentStep()}
      </div>
    </IntentWizardShell>
  );
}
