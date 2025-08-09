import React from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { SettingsProvider } from '../context/SettingsContext';
import { GeofenceProvider } from '../context/GeofenceContext';
import { DeviceProvider } from '../context/DeviceContext';
import { Slot } from 'expo-router';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SettingsProvider>
          <GeofenceProvider>
            <DeviceProvider>
              <Slot />
            </DeviceProvider>
          </GeofenceProvider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
