import { buildCalendarEvent } from "./calendar-event";

const tareaId = "44444444-4444-4444-4444-444444444444";
const fechaEvento = new Date("2026-08-15T13:30:00.000Z");

function lines(ics: string): string[] {
  return ics.split("\r\n");
}

describe("buildCalendarEvent", () => {
  it("builds a single-event RFC 5545 calendar with CRLF line endings", () => {
    const ics = buildCalendarEvent({
      id: tareaId,
      descripcion: "Buscar al hijo en el colegio",
      fechaEvento,
      generatedAt: new Date("2026-07-28T10:00:00.000Z"),
    });

    expect(lines(ics)).toEqual([
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Mediacion//Accionables//ES",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:${tareaId}@mediacion`,
      "DTSTAMP:20260728T100000Z",
      "DTSTART:20260815T133000Z",
      "DTEND:20260815T143000Z",
      "SUMMARY:Buscar al hijo en el colegio",
      "END:VEVENT",
      "END:VCALENDAR",
    ]);
  });

  it("escapes the RFC 5545 reserved characters in the summary", () => {
    const ics = buildCalendarEvent({
      id: tareaId,
      descripcion: "Bienes; casa, auto \\ y el resto\nsegunda linea",
      fechaEvento,
      generatedAt: fechaEvento,
    });

    expect(ics).toContain(
      "SUMMARY:Bienes\\; casa\\, auto \\\\ y el resto\\nsegunda linea",
    );
  });

  it("gives the event a one hour duration", () => {
    const ics = buildCalendarEvent({
      id: tareaId,
      descripcion: "Cuota",
      fechaEvento: new Date("2026-12-31T23:30:00.000Z"),
      generatedAt: fechaEvento,
    });

    expect(ics).toContain("DTSTART:20261231T233000Z");
    expect(ics).toContain("DTEND:20270101T003000Z");
  });
});
