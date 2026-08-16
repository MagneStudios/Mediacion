import { StyleSheet, Text, View } from 'react-native';

import { semanticColors } from '@/design-system/tokens/colors';
import { spacing } from '@/design-system/tokens/spacing';
import { typography } from '@/design-system/tokens/typography';

export type LegalDocumentBodyProps = {
  /** Normalized legal text: "## X. TITLE" lines are section headings, every other non-blank line is a paragraph. */
  contenido: string;
};

type Block = { kind: 'heading' | 'paragraph'; text: string };

/**
 * The entire grammar of `legal_documents.contenido` — deliberately not a
 * markdown library: the corpus is headings + numbered paragraphs and nothing
 * else, and a real parser would be a new dependency to render two documents.
 */
export function parseLegalBlocks(contenido: string): Block[] {
  return contenido
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) =>
      line.startsWith('## ')
        ? { kind: 'heading' as const, text: line.slice(3) }
        : { kind: 'paragraph' as const, text: line },
    );
}

/** Renders one frozen legal document version, exactly as stored — never local copy. */
export function LegalDocumentBody({ contenido }: LegalDocumentBodyProps) {
  const blocks = parseLegalBlocks(contenido);

  return (
    <View style={styles.container}>
      {blocks.map((block, index) =>
        block.kind === 'heading' ? (
          <Text
            // Positional keys are safe here: the block list is derived from an
            // immutable document version, never reordered or edited in place.
            key={index}
            style={styles.heading}
            accessibilityRole="header"
          >
            {block.text}
          </Text>
        ) : (
          <Text key={index} style={styles.paragraph}>
            {block.text}
          </Text>
        ),
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.md,
  },
  heading: {
    ...typography.cardTitle,
    color: semanticColors.text.primary,
    marginTop: spacing.md,
  },
  paragraph: {
    ...typography.body,
    color: semanticColors.text.secondary,
  },
});
