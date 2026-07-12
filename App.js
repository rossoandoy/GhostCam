import React from 'react';
import { StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import CameraScreen from './src/screens/CameraScreen';
import GalleryScreen from './src/screens/GalleryScreen';
import { SeriesProvider } from './src/context/SeriesContext';

const Stack = createStackNavigator();

export default function App() {
  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <SeriesProvider>
          <NavigationContainer>
            <Stack.Navigator
              initialRouteName="Camera"
              screenOptions={{
                headerShown: false,
              }}
            >
              <Stack.Screen name="Camera" component={CameraScreen} />
              <Stack.Screen name="Gallery" component={GalleryScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </SeriesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
