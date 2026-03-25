/**
 * AuthNavigator — Login / Register stack shown when user is not authenticated.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { LoginScreen } from '@/screens/LoginScreen';
import { RegisterScreen } from '@/screens/RegisterScreen';
import { colors } from '@/theme';
import type { AuthStackParamList } from './types';

const Auth = createNativeStackNavigator<AuthStackParamList>();

export const AuthNavigator: React.FC = () => (
  <Auth.Navigator
    screenOptions={{
      headerShown: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <Auth.Screen name="Login" component={LoginScreen} />
    <Auth.Screen name="Register" component={RegisterScreen} />
  </Auth.Navigator>
);
