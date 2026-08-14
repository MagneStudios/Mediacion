import { render, screen } from '@testing-library/react-native';

import { LegalDocumentBody, parseLegalBlocks } from '../LegalDocumentBody';

const sample = [
  'Párrafo inicial del encabezado.',
  '',
  '## A. DEFINICIONES',
  '',
  'A.1. "Plataforma": el sitio web.',
  'A.2. "Servicios": las funcionalidades.',
].join('\n');

describe('parseLegalBlocks', () => {
  it('splits headings from paragraphs and drops blank lines', () => {
    expect(parseLegalBlocks(sample)).toEqual([
      { kind: 'paragraph', text: 'Párrafo inicial del encabezado.' },
      { kind: 'heading', text: 'A. DEFINICIONES' },
      { kind: 'paragraph', text: 'A.1. "Plataforma": el sitio web.' },
      { kind: 'paragraph', text: 'A.2. "Servicios": las funcionalidades.' },
    ]);
  });

  it('handles the empty document without blocks', () => {
    expect(parseLegalBlocks('')).toEqual([]);
  });
});

describe('LegalDocumentBody', () => {
  it('renders headings with the header accessibility role and paragraphs as plain text', async () => {
    await render(<LegalDocumentBody contenido={sample} />);

    expect(screen.getByRole('header', { name: 'A. DEFINICIONES' })).toBeTruthy();
    expect(screen.getByText('A.1. "Plataforma": el sitio web.')).toBeTruthy();
    expect(screen.getByText('Párrafo inicial del encabezado.')).toBeTruthy();
  });
});
