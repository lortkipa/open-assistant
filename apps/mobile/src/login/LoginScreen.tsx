import { MockAuthClient } from '@open-assistant/shared';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CodeStep } from './CodeStep';
import { DoneStep } from './DoneStep';
import { EmailStep } from './EmailStep';
import { Mark } from './Mark';
import { NameStep } from './NameStep';
import { fonts, useTheme } from './theme';

// No backend yet: every sign-in goes through the mock (test code 123456).
const auth = new MockAuthClient();

type Step = 'start' | 'code' | 'name' | 'done';

export function LoginScreen() {
  const { name: theme, c } = useTheme();
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [signedInAs, setSignedInAs] = useState('');
  const [name, setName] = useState('');

  function askName(how: string) {
    setSignedInAs(how);
    setStep('name');
  }

  return (
    <SafeAreaView style={[styles.page, { backgroundColor: c.bg }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Mark />
          </View>

          <View style={styles.main}>
            <View style={styles.card}>
              {step === 'start' && (
                <EmailStep
                  email={email}
                  onEmailChange={setEmail}
                  onSubmit={() => setStep('code')}
                  onGoogle={async () => {
                    await auth.signInWithGoogle();
                    askName('with Google');
                  }}
                />
              )}
              {step === 'code' && (
                <CodeStep
                  auth={auth}
                  email={email}
                  onVerified={() => askName(`as ${email}`)}
                  onBack={() => setStep('start')}
                />
              )}
              {step === 'name' && (
                <NameStep
                  onSubmit={(n) => {
                    setName(n);
                    setStep('done');
                  }}
                  onBack={() => setStep('start')}
                />
              )}
              {step === 'done' && (
                <DoneStep
                  name={name}
                  signedInAs={signedInAs}
                  onRestart={() => {
                    setEmail('');
                    setStep('start');
                  }}
                />
              )}
            </View>
          </View>

          <View style={styles.footer}>
            <FooterLink label="Terms" />
            <FooterLink label="Privacy Policy" />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// Placeholder until the legal pages exist.
function FooterLink({ label }: { label: string }) {
  const { c } = useTheme();
  return (
    <Pressable accessibilityRole="link" hitSlop={8}>
      {({ pressed }) => (
        <Text style={[styles.footerText, { color: pressed ? c.ink : c.muted }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1 },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, paddingHorizontal: 16 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 18,
  },
  main: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40, paddingBottom: 64 },
  card: { width: '100%', maxWidth: 340 },
  footer: { flexDirection: 'row', justifyContent: 'center', gap: 16, paddingTop: 20, paddingBottom: 24 },
  footerText: { fontFamily: fonts.regular, fontSize: 12 },
});
