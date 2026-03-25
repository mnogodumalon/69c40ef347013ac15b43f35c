import type { TeilnehmerAnmeldung, Veranstaltungen } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';

interface TeilnehmerAnmeldungViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: TeilnehmerAnmeldung | null;
  onEdit: (record: TeilnehmerAnmeldung) => void;
  veranstaltungenList: Veranstaltungen[];
}

export function TeilnehmerAnmeldungViewDialog({ open, onClose, record, onEdit, veranstaltungenList }: TeilnehmerAnmeldungViewDialogProps) {
  function getVeranstaltungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return veranstaltungenList.find(r => r.record_id === id)?.fields.event_titel ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Teilnehmer-Anmeldung anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Veranstaltung</Label>
            <p className="text-sm">{getVeranstaltungenDisplayName(record.fields.ta_veranstaltung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Vorname</Label>
            <p className="text-sm">{record.fields.ta_vorname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Nachname</Label>
            <p className="text-sm">{record.fields.ta_nachname ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">E-Mail-Adresse</Label>
            <p className="text-sm">{record.fields.ta_email ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Telefonnummer</Label>
            <p className="text-sm">{record.fields.ta_telefon ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Ernährungsbesonderheiten</Label>
            <p className="text-sm">{Array.isArray(record.fields.ta_ernaehrung) ? record.fields.ta_ernaehrung.map((v: any) => v?.label ?? v).join(', ') : '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anmerkungen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.ta_notizen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}