import type { Veranstaltungen, Veranstaltungsort, Referenten } from '@/types/app';
import { extractRecordId } from '@/services/livingAppsService';
import {
  Dialog, DialogContent, DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { IconPencil, IconFileText } from '@tabler/icons-react';
import { format, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';

function formatDate(d?: string) {
  if (!d) return '—';
  try { return format(parseISO(d), 'dd.MM.yyyy', { locale: de }); } catch { return d; }
}

interface VeranstaltungenViewDialogProps {
  open: boolean;
  onClose: () => void;
  record: Veranstaltungen | null;
  onEdit: (record: Veranstaltungen) => void;
  veranstaltungsortList: Veranstaltungsort[];
  referentenList: Referenten[];
}

export function VeranstaltungenViewDialog({ open, onClose, record, onEdit, veranstaltungsortList, referentenList }: VeranstaltungenViewDialogProps) {
  function getVeranstaltungsortDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return veranstaltungsortList.find(r => r.record_id === id)?.fields.ort_name ?? '—';
  }

  function getReferentenDisplayName(url?: unknown) {
    if (!url) return '—';
    const id = extractRecordId(url);
    return referentenList.find(r => r.record_id === id)?.fields.ref_vorname ?? '—';
  }

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Veranstaltungen anzeigen</DialogTitle>
        </DialogHeader>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => { onClose(); onEdit(record); }}>
            <IconPencil className="h-3.5 w-3.5 mr-1.5" />
            Bearbeiten
          </Button>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Titel der Veranstaltung</Label>
            <p className="text-sm">{record.fields.event_titel ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Beschreibung</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.event_beschreibung ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Kategorie</Label>
            <Badge variant="secondary">{record.fields.event_kategorie?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Status</Label>
            <Badge variant="secondary">{record.fields.event_status?.label ?? '—'}</Badge>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Startdatum und -uhrzeit</Label>
            <p className="text-sm">{formatDate(record.fields.event_start)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Enddatum und -uhrzeit</Label>
            <p className="text-sm">{formatDate(record.fields.event_ende)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Maximale Teilnehmerzahl</Label>
            <p className="text-sm">{record.fields.event_max_teilnehmer ?? '—'}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Veranstaltungsort</Label>
            <p className="text-sm">{getVeranstaltungsortDisplayName(record.fields.veranstaltungsort_ref)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Referent</Label>
            <p className="text-sm">{getReferentenDisplayName(record.fields.referenten_ref)}</p>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Titelbild der Veranstaltung</Label>
            {record.fields.event_bild ? (
              <div className="relative w-full rounded-lg bg-muted overflow-hidden border">
                <img src={record.fields.event_bild} alt="" className="w-full h-auto object-contain" />
              </div>
            ) : <p className="text-sm text-muted-foreground">—</p>}
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Interne Notizen</Label>
            <p className="text-sm whitespace-pre-wrap">{record.fields.event_notizen ?? '—'}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}