import { colors, semanticColors, legacyColorMigrationMap } from '../colors';
import { radii } from '../radii';
import { typography } from '../typography';
import { spacing, layout } from '../spacing';

describe('design tokens — aquatic redesign foundations', () => {
  describe('colors', () => {
    it('exposes the new aquatic base palette', () => {
      expect(colors.canvas).toBe('#F4FAFD');
      expect(colors.primary).toBe('#3F6F9E');
      expect(colors.accent).toBe('#2F83C5');
      expect(colors.mediationAqua).toBe('#2F858B');
      expect(colors.ink).toBe('#17324A');
    });

    it('no longer exposes the removed cream-and-sage keys', () => {
      expect((colors as Record<string, unknown>).mediationSage).toBeUndefined();
      expect((colors as Record<string, unknown>).supportBlue).toBeUndefined();
    });

    it('keeps a migration reference for every replaced legacy hex', () => {
      expect(legacyColorMigrationMap['#324d5a'].now).toContain('primary');
      expect(legacyColorMigrationMap['#45645e'].now).toContain('mediationAqua');
      expect(legacyColorMigrationMap['#111111'].now).toContain('ink');
    });

    it('keeps the AI accent and the success color visually distinct', () => {
      // A regression here would make an accepted proposal/signed agreement
      // (success) visually indistinguishable from "AI-assisted" — see the
      // comment in colors.ts for why these are deliberately different hues.
      expect(colors.statusSuccess).not.toBe(colors.mediationAqua);
      expect(semanticColors.status.successFg).not.toBe(semanticColors.ai.accent);
    });

    it('routes focus color through the accent (Cerúleo), not the AI accent', () => {
      expect(semanticColors.border.focus).toBe(colors.accent);
      expect(semanticColors.border.focus).not.toBe(colors.mediationAqua);
    });

    it('exposes the semantic groups every consuming component relies on', () => {
      expect(semanticColors).toEqual(
        expect.objectContaining({
          text: expect.any(Object),
          surface: expect.any(Object),
          border: expect.any(Object),
          action: expect.any(Object),
          status: expect.any(Object),
          ai: expect.any(Object),
        }),
      );
    });
  });

  describe('radii', () => {
    it('matches the approved redesign scale', () => {
      expect(radii).toEqual({ xs: 6, sm: 8, md: 10, lg: 14, xl: 18, xxl: 24, pill: 9999, full: 9999 });
    });
  });

  describe('typography', () => {
    it('uses the semibold family for heading/action roles', () => {
      expect(typography.headline.fontFamily).toBe('Inter_600SemiBold');
      expect(typography.button.fontFamily).toBe('Inter_600SemiBold');
      expect(typography.eyebrow.fontFamily).toBe('Inter_600SemiBold');
    });

    it('uses the regular family for body/caption roles', () => {
      expect(typography.body.fontFamily).toBe('Inter_400Regular');
      expect(typography.caption.fontFamily).toBe('Inter_400Regular');
    });

    it('derives lineHeight from fontSize and rounds to the nearest point', () => {
      expect(typography.body.lineHeight).toBe(Math.round(16 * 1.5));
    });
  });

  describe('spacing / touch targets', () => {
    it('keeps the 8px-grid spacing scale unchanged', () => {
      expect(spacing).toEqual({ xxs: 4, xs: 8, sm: 12, md: 16, lg: 24, xl: 32, xxl: 48, section: 96 });
    });

    it('keeps the 44px minimum touch target', () => {
      expect(layout.touchTarget).toBe(44);
    });
  });
});
