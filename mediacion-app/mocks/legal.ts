import type { CompanyInfo, LegalDocument } from '../types/legal';

import { privacyV1Text, termsV1Text } from './legal-texts';

/**
 * Mock rows for the future `legal_documents` table (docs/reparto-tyc-devs.md
 * #10). The wording is the real Golosetti deliverable, verbatim from
 * `mocks/legal-texts.ts` — including its [COMPLETAR: …] placeholders, which
 * stay visible on purpose: they are Administración's pending inputs and
 * hiding them would hide the blocker. v1.0 is therefore a draft; the real
 * seed is a DB ticket blocked on those datos societarios.
 *
 * `validFrom` is a fixed past date, not `new Date()`: the visible "última
 * actualización" date must come from the data and stay stable across
 * reloads, so a test can assert it and a human can notice it changing only
 * when a new version is published.
 */
export const mockLegalDocuments: LegalDocument[] = [
  {
    tipo: 'terms',
    version: 'v1.0',
    contenido: termsV1Text,
    validFrom: '2026-08-13T00:00:00.000Z',
    validTo: null,
    isSubstantial: false,
    resumenCambios: null,
  },
  {
    tipo: 'privacy',
    version: 'v1.0',
    contenido: privacyV1Text,
    validFrom: '2026-08-13T00:00:00.000Z',
    validTo: null,
    isSubstantial: false,
    resumenCambios: null,
  },
];

/**
 * Everything Administración still owes (instructivo §5: razón social, CUIT y
 * domicilio "visibles en el sitio. No alcanza con el nombre de fantasía").
 * All null until the real data arrives — the UI renders an explicit pending
 * notice, never fake data. The response-time promise is ours to declare, so
 * it does have a value.
 */
export const mockCompanyInfo: CompanyInfo = {
  razonSocial: null,
  cuit: null,
  domicilio: null,
  emailContacto: null,
  plazoRespuestaDias: 5,
};

/**
 * Link a la Ventanilla Única Federal de Defensa del Consumidor — fixed by the
 * instructivo (§5), shown next to the contact details.
 */
export const ventanillaUnicaUrl =
  'https://www.argentina.gob.ar/justicia/derechofacil/leysimple/ventanilla-unica-federal-de-reclamos-de-defensa-del-consumidor';
