import { APP_NAME } from '@open-assistant/shared';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, useColorScheme, View } from 'react-native';

export default function App() {
  const dark = useColorScheme() === 'dark';

  return (
    <View style={[styles.container, { backgroundColor: dark ? '#121215' : '#F2F1EC' }]}>
      <Text style={[styles.title, { color: dark ? '#F2F2EF' : '#151515' }]}>{APP_NAME}</Text>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
});
