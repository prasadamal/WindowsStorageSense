/**
 * LoginScreen — email + password login form.
 */

import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store';
import { colors, fontSize, spacing, borderRadius } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Login'>;

export const LoginScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { login, isLoading } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Please enter your email and password.');
      return;
    }
    try {
      await login({ email: email.trim(), password });
    } catch {
      Alert.alert('Login failed', 'Invalid email or password. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Text style={styles.logo}>✦ SmartNotes</Text>
            <Text style={styles.tagline}>Save anything. Remember everything.</Text>
          </View>

          <View style={styles.form}>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textDisabled}
              autoCapitalize="none"
              keyboardType="email-address"
              textContentType="emailAddress"
              returnKeyType="next"
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textDisabled}
              secureTextEntry
              textContentType="password"
              returnKeyType="done"
              onSubmitEditing={handleLogin}
            />

            <TouchableOpacity
              style={[styles.btn, isLoading && { opacity: 0.7 }]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>{isLoading ? 'Signing in…' : 'Sign In'}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => navigation.navigate('Register')}>
              <Text style={styles.link}>
                Don't have an account?{' '}
                <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[6] },
  brand: { alignItems: 'center', marginBottom: spacing[10] },
  logo: { fontSize: fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  tagline: { fontSize: fontSize.base, color: colors.textSecondary, marginTop: spacing[2] },
  form: { gap: spacing[3] },
  input: {
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    borderRadius: borderRadius.md,
    padding: spacing[4],
    fontSize: fontSize.base,
    borderWidth: 1,
    borderColor: colors.border,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.full,
    padding: spacing[4],
    alignItems: 'center',
    marginTop: spacing[2],
  },
  btnText: { color: colors.textPrimary, fontWeight: '700', fontSize: fontSize.base },
  link: { textAlign: 'center', color: colors.textSecondary, fontSize: fontSize.sm, marginTop: spacing[2] },
});
