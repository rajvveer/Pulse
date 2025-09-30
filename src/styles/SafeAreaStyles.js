import { StyleSheet, Platform, StatusBar } from 'react-native';

export const SafeAreaStyles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  containerWithBackground: {
    flex: 1,
    backgroundColor: '#F7F9FC',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
});
