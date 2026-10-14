import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from './theme';
import { Lede, LinkButton, Links, Title } from './ui';

type Props = { name: string; signedInAs: string; onRestart: () => void };

export function DoneStep({ name, signedInAs, onRestart }: Props) {
  const { c } = useTheme();
  return (
    <View style={styles.done}>
      <View style={[styles.check, { backgroundColor: c.signal }]}>
        <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
          <Path
            d="M5 12.5l4.5 4.5L19 7.5"
            stroke={c.onSignal}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </View>
      <Title>Welcome, {name}</Title>
      <Lede>Signed in {signedInAs}.</Lede>
      <Links>
        <LinkButton onPress={onRestart}>Start over</LinkButton>
      </Links>
    </View>
  );
}

const styles = StyleSheet.create({
  done: { alignItems: 'center' },
  check: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
});
