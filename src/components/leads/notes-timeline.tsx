import { Phone, MessageCircle, Mail, Users, MoreHorizontal, StickyNote } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { CallType } from "@/types";
import { formatDateTime } from "@/lib/format";

export interface TimelineNote {
  id: string;
  note_text: string;
  call_type: CallType | null;
  created_at: string;
  authorName: string;
}

const CALL_TYPE_ICONS: Record<CallType, LucideIcon> = {
  "Inbound Call": Phone,
  "Outbound Call": Phone,
  WhatsApp: MessageCircle,
  Email: Mail,
  Meeting: Users,
  Other: MoreHorizontal,
};

export function NotesTimeline({ notes }: { notes: TimelineNote[] }) {
  if (notes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No activity yet. Add the first note below.
      </p>
    );
  }

  return (
    <ul className="space-y-4">
      {notes.map((note) => {
        const Icon = note.call_type ? CALL_TYPE_ICONS[note.call_type] : StickyNote;
        return (
          <li key={note.id} className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-700">
              <Icon className="h-4 w-4" />
            </span>
            <div className="flex-1 rounded-xl border border-slate-200 bg-white p-4 shadow-soft">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-slate-900">
                  {note.authorName}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDateTime(note.created_at)}
                </p>
              </div>
              {note.call_type && (
                <p className="mt-0.5 text-xs font-medium text-brand-600">
                  {note.call_type}
                </p>
              )}
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                {note.note_text}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
