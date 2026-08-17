import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { JetBrainsMono_400Regular, JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono';
import { ThemeProvider, type Theme } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack, type ErrorBoundaryProps } from 'expo-router';
import Head from 'expo-router/head';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import 'react-native-reanimated';

import { ResponsiveAppShell } from '@/components/ResponsiveAppShell';
import { ErrorState } from '@/design-system';
import { AuthGate } from '@/features/auth/AuthGate';
import { ReacceptanceGate } from '@/features/legal/components/ReacceptanceGate';
import { VersionNoticeBanner } from '@/features/legal/components/VersionNoticeBanner';
import { colors } from '@/design-system/tokens/colors';
import { useDocumentLang } from '@/hooks/use-document-lang';
import '@/i18n';

export const unstable_settings = {
  anchor: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

// Mediación ships light-only for phase 1 — the design system defines no dark
// theme, so navigation chrome uses the brand palette directly instead of
// switching on the device color scheme.
const mediacionNavigationTheme: Theme = {
  dark: false,
  colors: {
    primary: colors.primary,
    background: colors.canvas,
    card: colors.surface1,
    text: colors.ink,
    border: colors.hairline,
    notification: colors.primary,
  },
  fonts: {
    regular: { fontFamily: 'Inter_400Regular', fontWeight: '400' },
    medium: { fontFamily: 'Inter_500Medium', fontWeight: '500' },
    bold: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
    heavy: { fontFamily: 'Inter_700Bold', fontWeight: '700' },
  },
};

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useDocumentLang();

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <ThemeProvider value={mediacionNavigationTheme}>
      <SafeAreaProvider>
      <Head><title>Mediación</title></Head>
      {/*
        AuthGate wraps the whole tree so a signed-out visitor cannot reach any
        screen by URL. It is a pass-through when no backend is configured: the
        app then runs on mocks, where there is nothing to sign in to and gating
        would lock everything behind a form that cannot succeed.
      */}
      <AuthGate>
      {/*
        ReacceptanceGate sits inside AuthGate: it covers the whole app with a
        blocking overlay only when a substantial TyC change is pending
        (instructivo §4.9). It fails open on errors — the DB constraint, not
        this overlay, is the real enforcement.
      */}
      <ReacceptanceGate>
      {/*
        VersionNoticeBanner is the non-blocking half of the same rule: it
        announces a version scheduled to take effect (instructivo §4.8, the
        10-day in-product notice), while the gate above blocks once one
        already has. It renders nothing whenever nothing is scheduled, which
        is almost always, and it sits above the shell so the announcement is
        not buried inside a scrolling screen.
      */}
      <View style={styles.appColumn}>
      <VersionNoticeBanner />
      <ResponsiveAppShell>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="signup" options={{ headerShown: false }} />
          {/*
            Every route below owns its own nested `<Stack>` (declared in its
            own `_layout.tsx`) — that inner Stack already renders the one
            header/back button each of its screens needs. Without
            `headerShown: false` here, this root Stack would ALSO render a
            default header (raw route name as title) for the group as a
            whole, and — because React Navigation's back-button visibility
            bubbles up through ancestor navigators — every inner screen would
            show a second, redundant back control on top of its own. This is
            the single ownership rule: the innermost Stack owns the header:
            the root Stack never does for routes that have one.
          */}
          <Stack.Screen name="case/create" options={{ headerShown: false }} />
          <Stack.Screen name="case/[id]/positions" options={{ headerShown: false }} />
          <Stack.Screen name="case/[id]/negotiation" options={{ headerShown: false }} />
          <Stack.Screen name="case/[id]/agreement" options={{ headerShown: false }} />
          <Stack.Screen name="case/[id]/mediator" options={{ headerShown: false }} />
          <Stack.Screen name="profile" options={{ headerShown: false }} />
          <Stack.Screen name="notices" options={{ headerShown: false }} />
          <Stack.Screen name="admin" options={{ headerShown: false }} />
        </Stack>
      </ResponsiveAppShell>
      </View>
      </ReacceptanceGate>
      </AuthGate>
      <StatusBar style="dark" />
      </SafeAreaProvider>
    </ThemeProvider>
  );
}

export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  const { t } = useTranslation();

  return (
    <View style={errorStyles.container}>
      <ErrorState
        title={t('states.error.title')}
        description={t('states.error.description')}
        retryLabel={t('states.error.retry')}
        onRetry={() => {
          void retry();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The banner and the shell stack vertically; the shell takes what's left.
  appColumn: {
    flex: 1,
  },
});

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: colors.canvas,
  },
});
