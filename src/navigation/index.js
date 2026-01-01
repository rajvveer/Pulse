import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSelector } from "react-redux";
import { useTheme } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, View } from "react-native";
// 1. ✅ IMPORT SAFE AREA HOOK
import { useSafeAreaInsets } from "react-native-safe-area-context";

import AuthStack from "./AuthStack";
import { ProfileStack } from "./ProfileStack";
import FeedScreen from "../screens/FeedScreen";
import CreatePostScreen from "../screens/CreatePostScreen";
import NearbyScreen from "../screens/NearbyScreen";
import PostDetailScreen from "../screens/PostDetailScreen";
import UserProfileScreen from "../screens/Profile/UserProfileScreen"; 
import ConnectionsScreen from "../screens/Profile/ConnectionsScreen";
import EditPostScreen from "../screens/Profile/EditPostScreen";

import ChatListScreen from "../screens/Chat/ChatListScreen";
import ChatScreen from "../screens/Chat/ChatScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const MainTabs = () => {
  const { colors } = useTheme();
  // 2. ✅ GET THE INSETS (Calculates the bottom bar height)
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false, 
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === "Feed") {
            iconName = focused ? "home" : "home-outline";
          } else if (route.name === "Nearby") {
            iconName = focused ? "map" : "map-outline";
          } else if (route.name === "Create") {
            iconName = focused ? "add-circle" : "add-circle-outline";
            if (route.name === "Create")
              return (
                <View style={{
                  top: -10, 
                  shadowColor: colors.primary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.3,
                  shadowRadius: 4,
                }}>
                  <Ionicons name={iconName} size={42} color={colors.primary} />
                </View>
              );
          } else if (route.name === "Chat") {
            iconName = focused ? "chatbubbles" : "chatbubbles-outline";
          } else if (route.name === "Profile") {
            iconName = focused ? "person" : "person-outline";
          }

          return <Ionicons name={iconName} size={24} color={color} />;
        },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopWidth: 0,
          elevation: 10,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 4,
          
          // 3. ✅ CRITICAL FIX: DYNAMIC HEIGHT & PADDING
          // If insets.bottom exists (new Androids), add it. Otherwise use default 10px.
          height: Platform.OS === "ios" 
            ? 85 
            : 60 + (insets.bottom > 0 ? insets.bottom : 10), 
            
          paddingTop: 8,
          
          paddingBottom: Platform.OS === "ios" 
            ? 25 
            : (insets.bottom > 0 ? insets.bottom : 10),
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
      })}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Nearby" component={NearbyScreen} />
      <Tab.Screen name="Create" component={CreatePostScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            navigation.navigate("Profile", { screen: "ProfileMain" });
          },
        })}
      />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {isAuthenticated ? (
        <>
          <Stack.Screen name="Main" component={MainTabs} />

          {/* GLOBAL SCREENS */}
          <Stack.Screen
            name="PostDetail"
            component={PostDetailScreen}
            options={{ presentation: "card" }}
          />

          <Stack.Screen
            name="UserProfile"
            component={UserProfileScreen}
            options={{ presentation: "card" }}
          />
          
          <Stack.Screen
            name="Connections"
            component={ConnectionsScreen}
          />

          <Stack.Screen 
            name="EditPost" 
            component={EditPostScreen}
            options={{ presentation: 'modal' }}
          />

          <Stack.Screen 
            name="ChatScreen" 
            component={ChatScreen}
            options={{ presentation: 'card' }}
          />
          
        </>
      ) : (
        <Stack.Screen name="Auth" component={AuthStack} />
      )}
    </Stack.Navigator>
  );
};