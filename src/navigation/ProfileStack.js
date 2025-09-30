import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '@react-navigation/native';
import Ionicons from '@expo/vector-icons/Ionicons';

import ProfileScreen from '../screens/Profile/ProfileScreen';
import EditProfileScreen from '../screens/Profile/EditProfileScreen';
import SettingsScreen from '../screens/Profile/SettingsScreen';
import PrivacyScreen from '../screens/Profile/PrivacyScreen';
import MyPostsScreen from '../screens/Profile/MyPostsScreen';
import AboutScreen from '../screens/Profile/AboutScreen';
import NotificationsScreen from '../screens/Profile/NotificationsScreen';

const Stack = createStackNavigator();

export const ProfileStack = () => {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
          shadowColor: colors.border,
          shadowOpacity: 0.1,
          elevation: 1,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
        },
        headerBackImage: () => (
          <Ionicons 
            name="chevron-back" 
            size={24} 
            color={colors.text} 
            style={{ marginLeft: 8 }}
          />
        ),
      }}
    >
      <Stack.Screen 
        name="ProfileMain" 
        component={ProfileScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="EditProfile" 
        component={EditProfileScreen}
        options={{ title: 'Edit Profile' }}
      />
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <Stack.Screen 
        name="Privacy" 
        component={PrivacyScreen}
        options={{ title: 'Privacy & Safety' }}
      />
      <Stack.Screen 
        name="MyPosts" 
        component={MyPostsScreen}
        options={{ title: 'My Posts' }}
      />
      <Stack.Screen 
        name="About" 
        component={AboutScreen}
        options={{ title: 'About Pulse' }}
      />
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </Stack.Navigator>
  );
};
