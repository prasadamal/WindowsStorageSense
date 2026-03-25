/**
 * RootNavigator — switches between Auth stack and App (tab) stack
 * based on auth state. Also handles the initial app load splash.
 */

import React, { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuthStore } from '@/store';
import { colors } from '@/theme';
import { AuthNavigator } from './AuthNavigator';
import { AppTabNavigator } from './AppTabNavigator';
import type { RootStackParamList } from './types';

const Root = createNativeStackNavigator<RootStackParamList>();

export const RootNavigator: React.FC = () => {
  const { user, isInitialising, initialise } = useAuthStore();

  useEffect(() => {
    initialise();
  }, []);

  if (isInitialising) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer
      theme={{
        dark: true,
        colors: {
          primary: colors.primary,
          background: colors.background,
          card: colors.surface,
          text: colors.textPrimary,
          border: colors.border,
          notification: colors.primary,
        },
      }}
    >
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Root.Screen name="App" component={AppTabNavigator} />
        ) : (
          <Root.Screen name="Auth" component={AuthNavigator} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
};
