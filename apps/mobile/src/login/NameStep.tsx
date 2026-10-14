import { normalizeName } from '@open-assistant/shared';
import { useRef, useState } from 'react';
import { type TextInput, View } from 'react-native';
import { Button, ErrorText, Field, LinkButton, Links, styles as ui, Title } from './ui';

type Props = { onSubmit: (name: string) => void; onBack: () => void };

export function NameStep({ onSubmit, onBack }: Props) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const input = useRef<TextInput>(null);

  function submit() {
    const n = normalizeName(name);
    if (!n) {
      setError('Enter your name.');
      input.current?.focus();
      return;
    }
    onSubmit(n);
  }

  return (
    <View>
      <Title>What's your name?</Title>
      <View style={ui.form}>
        <Field
          ref={input}
          accessibilityLabel="Your name"
          placeholder="Your name"
          autoComplete="name"
          textContentType="name"
          autoCapitalize="words"
          maxLength={60}
          autoFocus
          returnKeyType="go"
          value={name}
          invalid={!!error}
          onChangeText={(v) => {
            setName(v);
            setError('');
          }}
          onSubmitEditing={submit}
        />
        {!!error && <ErrorText>{error}</ErrorText>}
        <Button variant="primary" onPress={submit} disabled={!name.trim()}>
          Continue
        </Button>
      </View>

      <Links>
        <LinkButton onPress={onBack}>Use a different email</LinkButton>
      </Links>
    </View>
  );
}
