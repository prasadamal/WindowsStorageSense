/**
 * AppTabNavigator — bottom tab bar for authenticated users.
 *
 * Tabs: Home | Folders | Search | Settings
 * Each tab has its own native stack so deep navigation works correctly.
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';

import { HomeScreen } from '@/screens/HomeScreen';
import { FoldersScreen } from '@/screens/FoldersScreen';
import { FolderDetailScreen } from '@/screens/FolderDetailScreen';
import { NoteDetailScreen } from '@/screens/NoteDetailScreen';
import { AddNoteScreen } from '@/screens/AddNoteScreen';
import { SearchScreen } from '@/screens/SearchScreen';
import { SettingsScreen } from '@/screens/SettingsScreen';
import { colors, fontSize } from '@/theme';
import type {
  AppTabParamList,
  HomeStackParamList,
  FoldersStackParamList,
} from './types';

const Tab = createBottomTabNavigator<AppTabParamList>();
const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const FoldersStack = createNativeStackNavigator<FoldersStackParamList>();

// ── Stack navigators ───────────────────────────────────────────────────────────

const HomeNavigator: React.FC = () => (
  <HomeStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.textPrimary,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <HomeStack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
    <HomeStack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ title: 'Note' }} />
    <HomeStack.Screen
      name="AddNote"
      component={AddNoteScreen}
      options={{ presentation: 'modal', title: 'Save Note' }}
    />
  </HomeStack.Navigator>
);

const FoldersNavigator: React.FC = () => (
  <FoldersStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: colors.surface },
      headerTintColor: colors.textPrimary,
      headerShadowVisible: false,
      contentStyle: { backgroundColor: colors.background },
    }}
  >
    <FoldersStack.Screen name="Folders" component={FoldersScreen} options={{ headerShown: false }} />
    <FoldersStack.Screen
      name="FolderDetail"
      component={FolderDetailScreen}
      options={({ route }) => ({ title: route.params.folderName })}
    />
    <FoldersStack.Screen name="NoteDetail" component={NoteDetailScreen} options={{ title: 'Note' }} />
  </FoldersStack.Navigator>
);

// ── Tab navigator ──────────────────────────────────────────────────────────────

type TabIconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_ICONS: Record<keyof AppTabParamList, { active: TabIconName; inactive: TabIconName }> = {
  HomeTab: { active: 'home', inactive: 'home-outline' },
  FoldersTab: { active: 'folder', inactive: 'folder-outline' },
  SearchTab: { active: 'search', inactive: 'search-outline' },
  SettingsTab: { active: 'settings', inactive: 'settings-outline' },
};

export const AppTabNavigator: React.FC = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarStyle: {
        backgroundColor: colors.surface,
        borderTopColor: colors.border,
        borderTopWidth: 1,
      },
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textDisabled,
      tabBarLabelStyle: { fontSize: fontSize.xs, fontWeight: '600' },
      tabBarIcon: ({ focused, color, size }) => {
        const icons = TAB_ICONS[route.name as keyof AppTabParamList];
        const iconName = focused ? icons.active : icons.inactive;
        return <Ionicons name={iconName} size={size} color={color} />;
      },
    })}
  >
    <Tab.Screen name="HomeTab" component={HomeNavigator} options={{ title: 'Home' }} />
    <Tab.Screen name="FoldersTab" component={FoldersNavigator} options={{ title: 'Folders' }} />
    <Tab.Screen name="SearchTab" component={SearchScreen} options={{ title: 'Search' }} />
    <Tab.Screen name="SettingsTab" component={SettingsScreen} options={{ title: 'Settings' }} />
  </Tab.Navigator>
);
