import {
  type AuthClient,
  CODE_TTL_MIN,
  OTP_LENGTH,
  RESEND_COOLDOWN_S,
} from '@open-assistant/shared';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, type TextInput, View } from 'react-native';
import { fonts, useTheme } from './theme';
import { Button, ErrorText, Field, Lede, LinkButton, Links, styles as ui, Title } from './ui';

type Props = {
  auth: AuthClient;
  email: string;
  onVerified: () => void;
  onBack: () => void;
};

const empty = () => Array<string>(OTP_LENGTH).fill('');

export function CodeStep({ auth, email, onVerified, onBack }: Props) {
  const { c } = useTheme();
  const [digits, setDigitsState] = useState(empty);
  // Keystrokes can arrive faster than React re-renders, so edits read from this ref.
  const latest = useRef(digits);
  const setDigits = (next: string[]) => {
    latest.current = next;
    setDigitsState(next);
  };
  const [error, setError] = useState('');
  const [invalid, setInvalid] = useState(false);
  const [locked, setLocked] = useState(false);
  const [cooldownEnd, setCooldownEnd] = useState(0);
  const [now, setNow] = useState(Date.now);
  const inputs = useRef<(TextInput | null)[]>([]);
  const shake = useRef(new Animated.Value(0)).current;

  const secondsLeft = Math.max(0, Math.ceil((cooldownEnd - now) / 1000));

  useEffect(() => {
    if (secondsLeft === 0) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [secondsLeft === 0]);

  function sendCode() {
    void auth.sendEmailCode(email);
    setDigits(empty());
    setError('');
    setInvalid(false);
    setLocked(false);
    setCooldownEnd(Date.now() + RESEND_COOLDOWN_S * 1000);
    setNow(Date.now());
    inputs.current[0]?.focus();
  }

  useEffect(sendCode, []);

  function runShake() {
    shake.setValue(0);
    Animated.sequence(
      [-5, 5, -5, 5, 0].map((toValue) =>
        Animated.timing(shake, { toValue, duration: 70, useNativeDriver: true }),
      ),
    ).start();
  }

  async function verify(code: string[]) {
    const joined = code.join('');
    if (joined.length < OTP_LENGTH) {
      setError(`Enter all ${OTP_LENGTH} digits from the email.`);
      inputs.current[code.findIndex((d) => !d)]?.focus();
      return;
    }
    const result = await auth.verifyEmailCode(email, joined);
    if (result.ok) {
      onVerified();
      return;
    }
    setInvalid(true);
    runShake();
    if (result.attemptsLeft > 0) {
      const n = result.attemptsLeft;
      setError(`That code is incorrect. ${n} ${n === 1 ? 'attempt' : 'attempts'} left.`);
      setDigits(empty());
      inputs.current[0]?.focus();
    } else {
      setLocked(true);
      setError('Too many incorrect attempts. Go back and enter your email again to get a new code.');
      inputs.current.forEach((el) => el?.blur());
    }
  }

  function clearError() {
    if (error && !locked) {
      setError('');
      setInvalid(false);
    }
  }

  // A single keystroke, or a whole pasted/autofilled code landing in one box.
  function onDigits(i: number, value: string) {
    const typed = value.replace(/\D/g, '');
    const prev = latest.current[i];
    // Typing into a filled box gives old + new digit; keep only the new one.
    const chars = typed.length === 2 && prev && typed.startsWith(prev) ? typed.slice(1) : typed;
    if (chars.length > 1) {
      const text = chars.slice(0, OTP_LENGTH);
      const next = latest.current.map((x, j) => text[j] ?? x);
      setDigits(next);
      clearError();
      inputs.current[Math.min(text.length, OTP_LENGTH - 1)]?.focus();
      if (text.length === OTP_LENGTH) void verify(next);
      return;
    }
    const d = chars.slice(-1);
    const next = latest.current.map((x, j) => (j === i ? d : x));
    setDigits(next);
    clearError();
    if (d && i < OTP_LENGTH - 1) inputs.current[i + 1]?.focus();
    if (next.every(Boolean)) void verify(next);
  }

  return (
    <View>
      <Title>Check your email</Title>
      <Lede>
        We sent a {OTP_LENGTH}-digit code to{' '}
        <Text style={{ color: c.ink, fontFamily: fonts.medium }}>{email}</Text>. It expires in{' '}
        {CODE_TTL_MIN} minutes.
      </Lede>

      <View style={ui.form}>
        <Animated.View
          style={[styles.code, { transform: [{ translateX: shake }] }]}
          accessibilityLabel="One-time code"
        >
          {digits.map((d, i) => (
            <Field
              key={i}
              ref={(el) => {
                inputs.current[i] = el;
              }}
              style={styles.cell}
              textStyle={styles.cellText}
              accessibilityLabel={`Digit ${i + 1}`}
              keyboardType="number-pad"
              textContentType={i === 0 ? 'oneTimeCode' : 'none'}
              autoComplete={i === 0 ? 'sms-otp' : 'off'}
              value={d}
              editable={!locked}
              invalid={invalid}
              onChangeText={(v) => onDigits(i, v)}
              onKeyPress={(e) => {
                if (e.nativeEvent.key === 'Backspace' && !latest.current[i] && i > 0) {
                  inputs.current[i - 1]?.focus();
                }
              }}
            />
          ))}
        </Animated.View>
        {!!error && <ErrorText>{error}</ErrorText>}
        <Button variant="primary" onPress={() => void verify(latest.current)} disabled={locked}>
          Continue
        </Button>
      </View>

      <Links>
        <LinkButton onPress={sendCode} disabled={locked || secondsLeft > 0}>
          {!locked && secondsLeft > 0 ? (
            <>
              Resend code in{' '}
              <Text style={styles.timer}>0:{String(secondsLeft).padStart(2, '0')}</Text>
            </>
          ) : (
            'Resend code'
          )}
        </LinkButton>
        <LinkButton onPress={onBack}>Use a different email</LinkButton>
      </Links>
    </View>
  );
}

const styles = StyleSheet.create({
  code: { flexDirection: 'row', gap: 8 },
  cell: { flex: 1 },
  cellText: {
    height: 52,
    paddingHorizontal: 0,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 20,
  },
  timer: { fontFamily: fonts.mono, fontSize: 13 },
});
