import type { Anmeldungen, Veranstaltungen, Teilnehmer } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface AnmeldungenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Anmeldungen | null;
  onEdit: (record: Anmeldungen) => void;
  veranstaltungenList: Veranstaltungen[];
  teilnehmerList: Teilnehmer[];
}

export function AnmeldungenViewDialog({ open, onClose, record, onEdit, veranstaltungenList, teilnehmerList }: AnmeldungenViewDialogProps) {
  function getVeranstaltungenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return veranstaltungenList.find(r => r.record_id === id)?.fields.event_titel ?? '—';
  }

  function getTeilnehmerDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return teilnehmerList.find(r => r.record_id === id)?.fields.tn_vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Anmeldungen anzeigen</DialogTitle>
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
            <p className="text-sm">{getVeranstaltungenDisplayName(record.fields.anm_veranstaltung)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Teilnehmer</Label>
            <p className="text-sm">{getTeilnehmerDisplayName(record.fields.anm_teilnehmer)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anmeldedatum</Label>
            <p className="text-sm">{formatDate(record.fields.anm_datum)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Anmeldestatus</Label>
            <Badge variant="secondary">{record.fields.anm_status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Notizen zur Anmeldung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.anm_notizen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}