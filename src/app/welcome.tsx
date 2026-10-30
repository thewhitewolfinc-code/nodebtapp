import { Redirect, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Image, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { ActionButton } from '@/components/nodebt/action-button';
import { font, layout, palette, radius, space, type } from '@/design/tokens';
import { entryRequests } from '@/features/auth/flow';
import { isGuestSession, navigationFor } from '@/features/auth/navigation';
import { useWorkspace } from '@/features/auth/workspace';
import { PrivacyNotes } from '@/features/auth/privacy-notes';
import { useAuthSession } from '@/features/auth/session';
import { openGuestRepository } from '@/storage/open';

export default function Welcome() {
  const session = useAuthSession();
  const workspace = useWorkspace();
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [pending, setPending] = useState<'google' | 'guest'>();
  const [feedback, setFeedback] = useState<{ message: string; error: boolean }>();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null);
  const operationId = useRef<string | undefined>(undefined);
  const contentWidth = Math.min(width, layout.authMaxWidth);
  const extraHeight = Math.max(0, height - insets.top - insets.bottom - 700);

  useEffect(() => {
    if (feedback) requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
  }, [feedback]);

  function begin(action: 'google' | 'guest') {
    if (!isGuestSession(session.state)) return;
    void entryRequests.run(async () => {
      setPending(action); setFeedback(undefined);
      try {
        if (action === 'google') {
          const outcome = await session.signInGoogle();
          if (outcome === 'cancelled') setFeedback({ message: 'Sign-in cancelled. You can try again whenever you’re ready.', error: false });
        } else {
          // Same production encrypted repository and idempotent onboarding command as P1.
          // No account ID, financial copy, migration, upload, or new database is involved.
          const repository = await openGuestRepository();
          const { randomUUID } = await import('expo-crypto');
          operationId.current ??= randomUUID();
          await repository.execute(operationId.current, { type: 'onboard' });
          await session.enterGuest();
          router.replace('/home');
        }
      } catch (cause) {
        const message = action === 'google' && cause instanceof Error ? cause.message :
          'Your private ledger could not be opened. Please retry in the NoDebt Android or iOS development app.';
        setFeedback({ message, error: true });
      } finally { setPending(undefined); }
    });
  }
  if (!isGuestSession(session.state)) return <Redirect href={navigationFor(session.state, workspace).destination} />;
  return <SafeAreaView style={styles.safe} edges={['top', 'bottom', 'left', 'right']}>
    <StatusBar style="dark" />
    <ScrollView ref={scroll} onContentSizeChange={() => { if (feedback) scroll.current?.scrollToEnd({ animated: true }); }} bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
      <View style={[styles.content, { minHeight: height - insets.top - insets.bottom, width: contentWidth }]}>
        <Image accessible={false} importantForAccessibility="no-hide-descendants" pointerEvents="none"
          source={require('../../assets/auth/backdrop.png')} resizeMode="stretch"
          style={{ position: 'absolute', top: 110 + extraHeight * 0.25, width: contentWidth, height: 291 + extraHeight * 0.45, opacity: fontScale > 1.1 ? 0 : 1 }} />
        <View style={styles.topRow}><View style={styles.language}><Text style={styles.languageText}>English</Text></View></View>
        <View style={[styles.identity, { paddingTop: space.sm + extraHeight * 0.25 }]}>
          <Image source={require('../../assets/auth/brand-mark.png')} accessibilityLabel="NoDebt logo" style={styles.logo} resizeMode="contain" />
          <Text accessibilityRole="header" accessibilityLabel="NoDebt" style={styles.wordmark}><Text style={styles.no}>No</Text><Text style={styles.debt}>Debt</Text></Text>
          <Text style={styles.tagline}>Know what you owe.{ '\n' }Track what you are owed.{ '\n' }Find your way to zero.</Text>
        </View>
        <View style={{ height: 123 + extraHeight * 0.45 }}>{fontScale > 1.1 &&
          <Image accessible={false} importantForAccessibility="no-hide-descendants" source={require('../../assets/auth/landscape.png')}
            style={{ width: contentWidth, height: '100%' }} resizeMode="stretch" />}</View>
        <PrivacyNotes />
        <View style={styles.actions}>
          <ActionButton label="Continue with Google" icon={<Image source={require('../../assets/auth/google.png')} style={styles.googleIcon} />}
            loading={pending === 'google'} disabled={Boolean(pending) || !session.googleReady} onPress={() => begin('google')} />
          <ActionButton label="Continue as Guest" secondary icon={<Image source={require('../../assets/auth/guest-leaf.png')} style={styles.leafIcon} resizeMode="contain" />}
            loading={pending === 'guest'} disabled={Boolean(pending) || !session.guestReady} onPress={() => begin('guest')} />
          {session.state === 'guest-offline' && <View style={styles.feedback}>
            <Text style={styles.feedbackText}>Google sign-in needs a connection. Your guest workspace is still available.</Text>
            <ActionButton label="Retry connection" secondary onPress={() => {
              void entryRequests.run(async () => {
                try { await session.retry(); }
                catch { setFeedback({ message: 'Please close and reopen NoDebt to retry your connection.', error: true }); }
              });
            }} />
          </View>}
          {session.problem && <Text accessibilityLiveRegion="polite" style={styles.feedbackText}>{session.problem}</Text>}
          {feedback && <View accessibilityRole={feedback.error ? 'alert' : undefined} accessibilityLiveRegion="polite"
            style={[styles.feedback, { backgroundColor: feedback.error ? palette.errorSurface : palette.infoSurface }]}>
            <Text style={[styles.feedbackText, { color: feedback.error ? palette.error : palette.info }]}>{feedback.message}</Text>
          </View>}
        </View>
        <View style={styles.footer}><Text style={styles.footerText}>Your guest records stay on this device.{ '\n' }You’re in control, from the start.</Text></View>
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: palette.canvas },
  scroll: { flexGrow: 1, alignItems: 'center' },
  content: { paddingBottom: 0 },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: space.xs, paddingRight: space.md + space.xxs, minHeight: 48 },
  language: { minWidth: 84, alignItems: 'center', paddingHorizontal: space.md, height: 32, borderRadius: radius.pill, backgroundColor: palette.surfaceSubtle, justifyContent: 'center' },
  languageText: { ...type.caption, fontFamily: font.medium, color: palette.text },
  identity: { alignItems: 'center' },
  logo: { width: 98, height: 112 },
  wordmark: { ...type.display, lineHeight: 44, includeFontPadding: false, marginTop: space.xxs, textAlign: 'center' },
  no: { color: palette.wordmark }, debt: { color: palette.brand[700] },
  tagline: { ...type.bodyLarge, fontSize: 14, lineHeight: 18, includeFontPadding: false, color: palette.textSecondary, textAlign: 'center', marginTop: space.xxs, paddingHorizontal: space.lg },
  actions: { marginTop: space.md, paddingHorizontal: layout.pageGutter, gap: space.xs },
  googleIcon: { width: 22, height: 22 }, leafIcon: { width: 20, height: 28 },
  feedback: { padding: space.sm, borderRadius: radius.md },
  feedbackText: { ...type.caption },
  footer: { flex: 1, justifyContent: 'flex-end', paddingTop: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xxs },
  footerText: { ...type.caption, fontSize: 11, lineHeight: 15, color: palette.textSecondary, textAlign: 'center' },
});
