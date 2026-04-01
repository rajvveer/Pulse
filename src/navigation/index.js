import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSelector } from "react-redux";
import { useTheme } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, View, TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme as useAppTheme } from "../contexts/ThemeContext";
import { getTheme } from "../styles/theme";

// Core imports
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
import ReelsScreen from "../screens/ReelsScreen";
import CreateReelScreen from "../screens/CreateReelScreen";

// Feature screens
import WhisperScreen from "../screens/WhisperScreen";
import PulseDropsScreen from "../screens/PulseDropsScreen";
import ChainsScreen from "../screens/ChainsScreen";
import AlterEgoScreen from "../screens/AlterEgoScreen";
import SearchScreen from "../screens/SearchScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import PushNotificationHandler from "../components/Notifications/PushNotificationHandler";
import RouletteScreen from "../screens/RouletteScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

const TAB_ICONS = {
  Feed: { active: 'home', inactive: 'home-outline' },
  Nearby: { active: 'map', inactive: 'map-outline' },
  Reels: { active: 'videocam', inactive: 'videocam-outline' },
  Create: { active: 'add-circle', inactive: 'add-circle-outline' },
  Chat: { active: 'chatbubbles', inactive: 'chatbubbles-outline' },
  Whisper: { active: 'eye-off', inactive: 'eye-off-outline' },
};

const VISIBLE_TABS = ['Feed', 'Nearby', 'Reels', 'Create', 'Chat', 'Whisper'];

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flexDirection: 'row',
      backgroundColor: colors.card,
      paddingTop: 10,
      paddingBottom: Math.max(insets.bottom, 10),
      borderTopWidth: 0,
      elevation: 10,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
    }}>
      {state.routes.map((route, index) => {
        if (!VISIBLE_TABS.includes(route.name)) return null;

        const isFocused = state.index === index;
        const iconSet = TAB_ICONS[route.name];
        if (!iconSet) return null;

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        if (route.name === 'Create') {
          return (
            <TouchableOpacity
              key={route.key}
              onPress={onPress}
              activeOpacity={0.7}
              style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
            >
              <View style={{
                marginTop: -18,
                shadowColor: colors.primary,
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.3,
                shadowRadius: 4,
                elevation: 5,
              }}>
                <Ionicons name={isFocused ? iconSet.active : iconSet.inactive} size={44} color={colors.primary} />
              </View>
            </TouchableOpacity>
          );
        }

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
          >
            <Ionicons
              name={isFocused ? iconSet.active : iconSet.inactive}
              size={24}
              color={isFocused ? colors.primary : colors.text}
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const MainTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tab.Screen name="Feed" component={FeedScreen} />
      <Tab.Screen name="Nearby" component={NearbyScreen} />
      <Tab.Screen name="Reels" component={ReelsScreen} />
      <Tab.Screen name="Create" component={CreatePostScreen} />
      <Tab.Screen name="Chat" component={ChatListScreen} />
      <Tab.Screen name="Whisper" component={WhisperScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} listeners={({ navigation }) => ({ tabPress: (e) => { navigation.navigate("Profile", { screen: "ProfileMain" }); }, })} />
    </Tab.Navigator>
  );
};

export const RootNavigator = () => {
  const isAuthenticated = useSelector((state) => state.auth.isAuthenticated);
  const { isDark } = useAppTheme();
  const appTheme = getTheme(isDark);

  return (
    <>
      {/* Push Notification Handler - must be outside navigator */}
      {isAuthenticated && <PushNotificationHandler />}

      <Stack.Navigator screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: appTheme.colors.background },
      }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />

            {/* REGISTER CREATE REEL SCREEN */}
            <Stack.Screen
              name="CreateReel"
              component={CreateReelScreen}
              options={{ presentation: 'modal' }}
            />

            {/* CORE SCREENS */}
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ presentation: "card" }} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ presentation: "card" }} />
            <Stack.Screen name="Connections" component={ConnectionsScreen} />
            <Stack.Screen name="EditPost" component={EditPostScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="ChatScreen" component={ChatScreen} options={{ presentation: 'card' }} />

            {/* NEW FEATURE SCREENS */}
            <Stack.Screen name="PulseDrops" component={PulseDropsScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Chains" component={ChainsScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="AlterEgo" component={AlterEgoScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Search" component={SearchScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Bookmarks" component={BookmarksScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="Roulette" component={RouletteScreen} options={{ presentation: 'modal' }} />
          </>
        ) : (
          <Stack.Screen name="Auth" component={AuthStack} />
        )}
      </Stack.Navigator>
    </>
  );
};
