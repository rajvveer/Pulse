import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { useTheme } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";

import ProfileScreen from "../screens/Profile/ProfileScreen";
import EditProfileScreen from "../screens/Profile/EditProfileScreen";
import SettingsScreen from "../screens/Profile/SettingsScreen";
import PrivacyScreen from "../screens/Profile/PrivacyScreen";
import MyPostsScreen from "../screens/Profile/MyPostsScreen";
import AboutScreen from "../screens/Profile/AboutScreen";
import NotificationsScreen from "../screens/Profile/NotificationsScreen";
import ConnectionsScreen from "../screens/Profile/ConnectionsScreen";

const Stack = createStackNavigator();

export const ProfileStack = () => {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
          shadowColor: "transparent", // Modern flat look
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: "700",
          fontSize: 17,
        },
        headerBackTitleVisible: false, // Cleaner iOS back button
        headerBackImage: () => (
          <Ionicons
            name="arrow-back"
            size={24}
            color={colors.text}
            style={{ marginLeft: 16 }}
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
        options={{ title: "Edit Profile" }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: "Settings" }}
      />
      <Stack.Screen
        name="Privacy"
        component={PrivacyScreen}
        options={{ title: "Privacy & Safety" }}
      />
      <Stack.Screen
        name="MyPosts"
        component={MyPostsScreen}
        options={{ title: "My Posts" }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: "Notifications" }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: "About Pulse" }}
      />
      <Stack.Screen
        name="Connections"
        component={ConnectionsScreen}
        options={{ headerShown: false }}
      />
      {/* ❌ REMOVED UserProfileScreen from here */}
    </Stack.Navigator>
  );
};
