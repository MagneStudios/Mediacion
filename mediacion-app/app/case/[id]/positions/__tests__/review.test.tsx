import { contentWidths, getResponsiveContentStyle, horizontalPadding } from '@/design-system/tokens/layout';

describe('ReviewPositionScreen — responsive layout', () => {
  it('compact mode uses form content width with compact padding', () => {
    const style = getResponsiveContentStyle({
      maxWidth: contentWidths.form,
      horizontalPadding: horizontalPadding.compact,
    });
    expect(style).toEqual({
      width: '100%',
      maxWidth: contentWidths.form,
      alignSelf: 'center',
      paddingHorizontal: horizontalPadding.compact,
    });
  });

  it('wide mode uses form content width with wide padding', () => {
    const style = getResponsiveContentStyle({
      maxWidth: contentWidths.form,
      horizontalPadding: horizontalPadding.wide,
    });
    expect(style).toEqual({
      width: '100%',
      maxWidth: contentWidths.form,
      alignSelf: 'center',
      paddingHorizontal: horizontalPadding.wide,
    });
  });

  it('has a maxWidth constraint', () => {
    const style = getResponsiveContentStyle({
      maxWidth: contentWidths.form,
      horizontalPadding: 16,
    });
    expect(style).toHaveProperty('maxWidth');
    expect(typeof style === 'object' && style !== null && 'maxWidth' in style ? style.maxWidth : 0).toBeGreaterThan(0);
  });

  it('centers the content horizontally', () => {
    const style = getResponsiveContentStyle({
      maxWidth: contentWidths.form,
      horizontalPadding: 16,
    });
    expect(style).toHaveProperty('alignSelf', 'center');
    expect(style).toHaveProperty('width', '100%');
  });
});
