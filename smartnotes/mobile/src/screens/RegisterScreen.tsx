/**
 * RegisterScreen — sign-up form.
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
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuthStore } from '@/store';
import { colors, fontSize, spacing, borderRadius } from '@/theme';
import type { AuthStackParamList } from '@/navigation/types';

type Nav = NativeStackNavigationProp<AuthStackParamList, 'Register'>;

export const RegisterScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { register, isLoading } = useAuthStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert('Missing fields', 'Please fill in all fields.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Password must be at least 8 characters.');
      return;
    }
    try {
      await register({ display_name: name.trim(), email: email.trim(), password });
    } catch {
      Alert.alert('Registration failed', 'This email may already be in use. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <Text style={styles.heading}>Create Account</Text>
          <Text style={styles.sub}>Join SmartNotes and start saving smarter.</Text>

          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Display name"
            placeholderTextColor={colors.textDisabled}
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="Email"
            placeholderTextColor={colors.textDisabled}
            autoCapitalize="none"
            keyboardType="email-address"
            returnKeyType="next"
          />
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Password (min 8 chars)"
            placeholderTextColor={colors.textDisabled}
            secureTextEntry
            returnKeyType="done"
            onSubmitEditing={handleRegister}
          />

          <TouchableOpacity
            style={[styles.btn, isLoading && { opacity: 0.7 }]}
            onPress={handleRegister}
            disabled={isLoading}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{isLoading ? 'Creating…' : 'Create Account'}</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.link}>
              Already have an account?{' '}
              <Text style={{ color: colors.primary, fontWeight: '700' }}>Sign In</Text>
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing[6], gap: spacing[3] },
  heading: { fontSize: fontSize['2xl'], fontWeight: '800', color: colors.textPrimary },
  sub: { fontSize: fontSize.base, color: colors.textSecondary },
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
  link: { textAlign: 'center', color: colors.textSecondary, fontSize: fontSize.sm },
});
