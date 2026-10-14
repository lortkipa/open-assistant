// Small building blocks that mirror the web login styles.
import { forwardRef, type ReactNode, useState } from 'react';
import {
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
} from 'react-native';
import { fonts, useTheme } from './theme';

export function Title({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={[styles.title, { color: c.ink }]}>{children}</Text>;
}

export function Lede({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return <Text style={[styles.lede, { color: c.muted }]}>{children}</Text>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={styles.error} accessibilityRole="alert">
      <View style={[styles.errorDot, { backgroundColor: c.danger }]}>
        <Text style={[styles.errorBang, { color: c.bg }]}>!</Text>
      </View>
      <Text style={[styles.errorText, { color: c.danger }]}>{children}</Text>
    </View>
  );
}

type FieldProps = TextInputProps & { invalid?: boolean; textStyle?: StyleProp<TextStyle> };

// Text input with the brand focus ring (drawn as an outline behind the box).
export const Field = forwardRef<TextInput, FieldProps>(function Field(
  { invalid, editable = true, style, textStyle, onFocus, onBlur, ...props },
  ref,
) {
  const { c } = useTheme();
  const [focused, setFocused] = useState(false);
  const border = invalid ? c.danger : focused ? c.signal : c.lineStrong;
  return (
    <View style={[styles.fieldWrap, style, !editable && styles.disabled]}>
      {focused && (
        <View
          pointerEvents="none"
          style={[styles.ring, { borderColor: invalid ? c.dangerRing : c.ring }]}
        />
      )}
      <TextInput
        ref={ref}
        editable={editable}
        placeholderTextColor={c.muted}
        selectionColor={c.signal}
        style={[
          styles.field,
          { color: c.ink, backgroundColor: c.surface, borderColor: border },
          textStyle,
        ]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        {...props}
      />
    </View>
  );
});

type ButtonProps = {
  variant: 'primary' | 'secondary';
  onPress: () => void;
  disabled?: boolean;
  icon?: ReactNode;
  children: ReactNode;
};

export function Button({ variant, onPress, disabled, icon, children }: ButtonProps) {
  const { c } = useTheme();
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        primary
          ? {
              backgroundColor: pressed ? c.signalHover : c.signal,
              borderColor: pressed ? c.signalHover : c.signal,
            }
          : { backgroundColor: c.surface, borderColor: pressed ? c.muted : c.lineStrong },
        pressed && styles.pressed,
        disabled && styles.buttonDisabled,
      ]}
    >
      {icon}
      <Text
        style={[
          styles.buttonText,
          { color: primary ? c.onSignal : c.ink, fontFamily: primary ? fonts.semibold : fonts.medium },
        ]}
      >
        {children}
      </Text>
    </Pressable>
  );
}

export function LinkButton(props: { onPress: () => void; disabled?: boolean; children: ReactNode }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: props.disabled }}
      disabled={props.disabled}
      onPress={props.onPress}
      hitSlop={8}
      style={props.disabled && styles.linkDisabled}
    >
      {({ pressed }) => (
        <Text style={[styles.link, { color: pressed ? c.ink : c.muted }]}>{props.children}</Text>
      )}
    </Pressable>
  );
}

export function Links({ children }: { children: ReactNode }) {
  return <View style={styles.links}>{children}</View>;
}

export const styles = StyleSheet.create({
  title: {
    fontFamily: fonts.bold,
    fontSize: 30,
    lineHeight: 35,
    letterSpacing: -0.75,
    textAlign: 'center',
  },
  lede: {
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 10,
    textAlign: 'center',
  },
  form: { gap: 12, marginTop: 28 },
  error: { flexDirection: 'row', gap: 6, marginTop: -2 },
  errorDot: {
    width: 16,
    height: 16,
    marginTop: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBang: { fontFamily: fonts.bold, fontSize: 11, lineHeight: 16 },
  errorText: { flex: 1, fontFamily: fonts.regular, fontSize: 13.5, lineHeight: 19.5 },
  fieldWrap: { position: 'relative' },
  ring: {
    position: 'absolute',
    top: -3,
    left: -3,
    right: -3,
    bottom: -3,
    borderRadius: 11,
    borderWidth: 3,
  },
  field: {
    height: 44,
    paddingHorizontal: 14,
    fontFamily: fonts.regular,
    fontSize: 15,
    borderWidth: 1,
    borderRadius: 8,
  },
  disabled: { opacity: 0.5 },
  button: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 8,
  },
  buttonText: { fontSize: 15 },
  pressed: { transform: [{ translateY: 1 }] },
  buttonDisabled: { opacity: 0.45, transform: [] },
  links: { flexDirection: 'row', justifyContent: 'center', gap: 18, marginTop: 18 },
  link: { fontFamily: fonts.medium, fontSize: 14, padding: 4 },
  linkDisabled: { opacity: 0.7 },
});
