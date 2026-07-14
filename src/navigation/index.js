import React from "react";
import { createStackNavigator } from "@react-navigation/stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSelector } from "react-redux";
import { useTheme } from "@react-navigation/native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { Platform, View, TouchableOpacity, StyleSheet } from "react-native";
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
import CreateSnapScreen from "../screens/CreateSnapScreen";
import SnapSendScreen from "../screens/SnapSendScreen";
import SnapViewerScreen from "../screens/SnapViewerScreen";

// Feature screens
import WhisperScreen from "../screens/WhisperScreen";
import PulseDropsScreen from "../screens/PulseDropsScreen";
import ChainsScreen from "../screens/ChainsScreen";
import AlterEgoScreen from "../screens/AlterEgoScreen";
import SearchScreen from "../screens/SearchScreen";
import BookmarksScreen from "../screens/BookmarksScreen";
import PushNotificationHandler from "../components/Notifications/PushNotificationHandler";
import RouletteScreen from "../screens/RouletteScreen";
import GroupInfoScreen from "../screens/GroupInfoScreen";
import IncomingCallScreen from "../screens/Call/IncomingCallScreen";
import OutgoingCallScreen from "../screens/Call/OutgoingCallScreen";
import CallScreen from "../screens/Call/CallScreen";

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Create is intentionally absent here — it's still a registered Tab.Screen so
// navigation.navigate('Create') works, but it's reached via the "+" FAB on the
// Feed (and other screens), not the bottom bar. Keeps the bar to 5 tabs.
const TAB_ICONS = {
  Feed: { active: 'home', inactive: 'home-outline', label: 'Home' },
  Nearby: { active: 'map', inactive: 'map-outline', label: 'Nearby' },
  Reels: { active: 'videocam', inactive: 'videocam-outline', label: 'Reels' },
  Chat: { active: 'chatbubble', inactive: 'chatbubble-outline', label: 'Chat' },
  Whisper: { active: 'eye-off', inactive: 'eye-off-outline', label: 'Whisper' },
};

const VISIBLE_TABS = ['Feed', 'Nearby', 'Reels', 'Chat', 'Whisper'];

const CustomTabBar = ({ state, descriptors, navigation }) => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={{
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      paddingTop: 8,
      paddingBottom: Math.max(insets.bottom, 12),
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
      // Soft lift off the content, slightly stronger than a card.
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -3 },
      shadowOpacity: 0.08,
      shadowRadius: 12,
      elevation: 12,
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

        // Neutral active state — active = full-strength text color, inactive =
        // muted tertiary. No blue tint in the bar. The "+" Create tab is a plain
        // icon like every other tab (icon name set in TAB_ICONS).
        const tint = isFocused ? colors.text : colors.textTertiary;

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={iconSet.label}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4 }}
          >
            <Ionicons
              name={isFocused ? iconSet.active : iconSet.inactive}
              size={26}
              color={tint}
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

            {/* SNAP (ephemeral stories + direct disappearing snaps) */}
            <Stack.Screen name="CreateSnap" component={CreateSnapScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="SnapSend" component={SnapSendScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="SnapViewer" component={SnapViewerScreen} options={{ presentation: 'modal', animationEnabled: true }} />

            {/* CORE SCREENS */}
            <Stack.Screen name="PostDetail" component={PostDetailScreen} options={{ presentation: "card" }} />
            <Stack.Screen name="UserProfile" component={UserProfileScreen} options={{ presentation: "card" }} />
            <Stack.Screen name="Connections" component={ConnectionsScreen} />
            <Stack.Screen name="EditPost" component={EditPostScreen} options={{ presentation: 'modal' }} />
            <Stack.Screen name="ChatScreen" component={ChatScreen} options={{ presentation: 'card' }} />
            <Stack.Screen name="GroupInfoScreen" component={GroupInfoScreen} options={{ presentation: 'card' }} />

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
