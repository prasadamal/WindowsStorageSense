/**
 * SmartNotes — App entry point.
 *
 * Wraps the entire app in required providers:
 * - GestureHandlerRootView (react-native-gesture-handler)
 * - SafeAreaProvider
 * - Toast notification layer
 * - RootNavigator (handles auth + routing)
 */

import 'react-native-gesture-handler';

import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Toast from 'react-native-toast-message';

import { RootNavigator } from '@/navigation/RootNavigator';

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <RootNavigator />
        <Toast />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
