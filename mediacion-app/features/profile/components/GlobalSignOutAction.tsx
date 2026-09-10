import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, StyleSheet } from 'react-native';

import { Icon } from '@/design-system';
import { semanticColors } from '@/design-system/tokens/colors';
import { radii } from '@/design-system/tokens/radii';
import { layout as spacingLayout } from '@/design-system/tokens/spacing';
import { blurActiveElement } from '@/utils/blur-active-element';

import { useAccountActions } from '../hooks/useAccountActions';
import { SignOutDialog } from './SignOutDialog';

export type GlobalSignOutActionProps = {
  /** Icon color override — the desktop topbar and the native header sit on different backgrounds. */
  color?: string;
};

/**
 * Point #3 (AJUSTES-PACTUM-2026-09-10): "cerrar sesión" accesible desde
 * cualquier pantalla, no solo `/profile/account`. Reusa exactamente el mismo
 * wiring que esa pantalla (`useAccountActions` + `SignOutDialog` +
 * `/signed-out`) en vez de duplicar el manejo de confirm/pending/error — este
 * es el único lugar que ambas superficies (DesktopTopbar, header nativo de
 * los tabs) montan para tener el mismo comportamiento de cierre de sesión.
 */
export function GlobalSignOutAction({ color }: GlobalSignOutActionProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { signOutStatus, signOut, resetSignOutStatus } = useAccountActions();
  const [visible, setVisible] = useState(false);

  const open = () => {
    resetSignOutStatus();
    setVisible(true);
  };

  const confirm = async () => {
    const ok = await signOut();
    if (ok) {
      setVisible(false);
      blurActiveElement();
      router.dismissAll();
      router.replace('/signed-out');
    }
  };

  return (
    <>
      <Pressable
        onPress={open}
        accessibilityRole="button"
        accessibilityLabel={t('common.signOut')}
        style={({ pressed }) => [styles.button, pressed ? styles.buttonPressed : null]}
        hitSlop={8}
      >
        <Icon name="log-out" size={20} color={color ?? semanticColors.text.secondary} />
      </Pressable>

      <SignOutDialog
        visible={visible}
        status={signOutStatus}
        title={t('profile.account.signOut.dialogTitle')}
        body={t('profile.account.signOut.dialogBody')}
        confirmLabel={t('profile.account.signOut.confirm')}
        cancelLabel={t('profile.account.signOut.cancel')}
        errorTitle={t('profile.account.signOut.error.title')}
        retryLabel={t('profile.account.signOut.error.retry')}
        onConfirm={confirm}
        onCancel={() => {
          if (signOutStatus === 'pending') return;
          setVisible(false);
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    width: spacingLayout.touchTarget,
    height: spacingLayout.touchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.pill,
  },
  buttonPressed: {
    backgroundColor: semanticColors.surface.sunken,
  },
});
