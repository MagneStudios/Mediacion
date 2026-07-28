const eventDurationMs = 60 * 60 * 1000;

export type CalendarEventInput = {
  id: string;
  descripcion: string;
  fechaEvento: Date;
  generatedAt: Date;
};

function toIcsTimestamp(value: Date): string {
  return `${value.toISOString().replace(/[-:]/g, "").split(".")[0]}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

export function buildCalendarEvent(input: CalendarEventInput): string {
  const end = new Date(input.fechaEvento.getTime() + eventDurationMs);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Mediacion//Accionables//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${input.id}@mediacion`,
    `DTSTAMP:${toIcsTimestamp(input.generatedAt)}`,
    `DTSTART:${toIcsTimestamp(input.fechaEvento)}`,
    `DTEND:${toIcsTimestamp(end)}`,
    `SUMMARY:${escapeIcsText(input.descripcion)}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
