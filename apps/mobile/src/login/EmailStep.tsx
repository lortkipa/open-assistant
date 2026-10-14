import { emailProblem } from '@open-assistant/shared';
import { useRef, useState } from 'react';
import { StyleSheet, Text, type TextInput, View } from 'react-native';
import { GoogleIcon } from './GoogleIcon';
import { fonts, useTheme } from './theme';
import { Button, ErrorText, Field, styles as ui, Title } from './ui';

type Props = {
  email: string;
  onEmailChange: (email: string) => void;
  onSubmit: () => void;
  onGoogle: () => void;
};

export function EmailStep({ email, onEmailChange, onSubmit, onGoogle }: Props) {
  const { c } = useTheme();
  const [error, setError] = useState('');
  const input = useRef<TextInput>(null);

  function submit() {
    const problem = emailProblem(email.trim());
    setError(problem);
    if (problem) {
      input.current?.focus();
      return;
    }
    onEmailChange(email.trim());
    onSubmit();
  }

  return (
    <View>
      <Title>Log in to Open Assistant</Title>

      <View style={ui.form}>
        <Field
          ref={input}
          accessibilityLabel="Email address"
          placeholder="Email address"
          autoComplete="email"
          textContentType="emailAddress"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          value={email}
          invalid={!!error}
          onChangeText={(v) => {
            onEmailChange(v);
            setError('');
          }}
          onSubmitEditing={submit}
        />
        {!!error && <ErrorText>{error}</ErrorText>}
        <Button variant="primary" onPress={submit} disabled={!email.trim()}>
          Continue with Email
        </Button>
      </View>

      <View style={styles.divider}>
        <View style={[styles.rule, { backgroundColor: c.line }]} />
        <Text style={[styles.or, { color: c.muted }]}>OR</Text>
        <View style={[styles.rule, { backgroundColor: c.line }]} />
      </View>

      <Button variant="secondary" onPress={onGoogle} icon={<GoogleIcon />}>
        Continue with Google
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 20 },
  rule: { flex: 1, height: StyleSheet.hairlineWidth * 2 },
  or: { fontFamily: fonts.regular, fontSize: 12, letterSpacing: 1 },
});
