import React, { useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import { useSelector } from "react-redux";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useTheme } from "../../contexts/ThemeContext";
import { getTheme } from "../../styles/theme";
import api from "../../services/api";
import socketService from "../../services/socket";

// Helper: Normalize ID
const normalizeId = (idOrObject) => {
  if (!idOrObject) return "";
  if (typeof idOrObject === 'string' || typeof idOrObject === 'number') {
    return String(idOrObject);
  } else if (typeof idOrObject === 'object') {
    return String(idOrObject.id || idOrObject._id || idOrObject.userId || "");
  }
  return "";
};

const ChatListScreen = ({ navigation }) => {
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const { user, token } = useSelector((state) => state.auth);

  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // We use a Ref to ensure the listener function is stable across renders
  const currentUserId = normalizeId(user, "CurrentUser");

  // 1. Fetch Logic
  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await api.get("/chat/conversations");
      if (res.data.success) {
        setConversations(res.data.data || []);
      }
    } catch (error) {
      console.error("❌ [ChatList] Fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 2. ✅ CRITICAL FIX: Manage Socket Listener in useFocusEffect
  // This ensures the listener is RE-ATTACHED every time you view this screen.
  useFocusEffect(
    useCallback(() => {
      // A. Fetch latest data on focus
      if (token && currentUserId) {
        fetchConversations();
      }

      // B. Connect Socket if needed
      if (token && !socketService.socket) {
        socketService.connect(token);
      }

      // C. Define the Listener
      const handleLiveMessage = (newMessage) => {
        if (!currentUserId) return;
        
        console.log("⚡ [ChatList] Live Update Triggered:", newMessage.content);

        setConversations((prevConvos) => {
          const exists = prevConvos.find((c) => c._id === newMessage.conversation);
          const senderId = normalizeId(newMessage.sender);
          const isFromMe = senderId === currentUserId;

          if (exists) {
            // Update existing conversation
            const updatedConvo = {
              ...exists,
              lastMessageContent: newMessage.content,
              lastMessageAt: newMessage.createdAt,
              lastMessageSender: senderId,
              unreadCounts: isFromMe 
                ? { ...exists.unreadCounts, [currentUserId]: 0 } 
                : {
                    ...exists.unreadCounts,
                    [currentUserId]: (exists.unreadCounts?.[currentUserId] || 0) + 1,
                  }
            };
            // Move to top
            return [updatedConvo, ...prevConvos.filter((c) => c._id !== newMessage.conversation)];
          } else {
            // New conversation? Fetch all to be safe and accurate
            fetchConversations(); 
            return prevConvos;
          }
        });
      };

      // D. Attach Listeners
      if (socketService.socket) {
        // Remove any existing listeners first to avoid duplicates
        socketService.socket.off('new_message'); 
        socketService.socket.on('new_message', handleLiveMessage);
        
        // Listen for reads
        socketService.socket.off('messages_seen');
        socketService.socket.on('messages_seen', () => fetchConversations());
      }

      // E. Cleanup when screen loses focus
      return () => {
        if (socketService.socket) {
            // Optional: You can choose NOT to remove this if you want background updates
            // But removing it prevents the "ChatScreen" conflict
            socketService.socket.off('new_message', handleLiveMessage);
            socketService.socket.off('messages_seen');
        }
      };
    }, [token, currentUserId]) // Re-run if user/token changes
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const renderItem = ({ item }) => {
    if (!currentUserId) return null;

    const participants = item.participants || [];
    let otherUser = participants.find((p) => normalizeId(p) !== currentUserId);
    if (!otherUser && participants.length > 0) otherUser = participants[0];

    const displayName = otherUser?.username || "Unknown";
    const avatarUri = otherUser?.profile?.avatar || otherUser?.avatar || "https://via.placeholder.com/50";
    
    const lastSenderId = normalizeId(item.lastMessageSender);
    const iSentLast = lastSenderId === currentUserId;
    const unreadCount = item.unreadCounts?.[currentUserId] || 0;
    const showBadge = unreadCount > 0 && !iSentLast;

    return (
      <TouchableOpacity
        style={[styles.chatItem, { backgroundColor: theme.colors.surface }]}
        onPress={() => {
          // Optimistic update
          setConversations(prev => prev.map(c => 
             c._id === item._id 
             ? { ...c, unreadCounts: { ...c.unreadCounts, [currentUserId]: 0 } }
             : c
          ));
          
          navigation.navigate("ChatScreen", {
            conversationId: item._id,
            targetUser: otherUser,
          });
        }}
      >
        <View style={styles.avatarContainer}>
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
          {otherUser?.isOnline && <View style={styles.onlineBadge} />}
        </View>

        <View style={styles.chatContent}>
          <View style={styles.topRow}>
            <Text style={[styles.name, { color: theme.colors.text }]}>{displayName}</Text>
            <Text style={[styles.time, { color: theme.colors.textSecondary }]}>
              {item.lastMessageAt ? new Date(item.lastMessageAt).toLocaleDateString() : ""}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
              {iSentLast && (
                <Text style={{ color: theme.colors.textSecondary, fontSize: 14, marginRight: 4 }}>
                  You:
                </Text>
              )}
              <Text
                numberOfLines={1}
                style={[
                  styles.lastMessage,
                  {
                    color: showBadge ? theme.colors.text : theme.colors.textSecondary,
                    fontWeight: showBadge ? "700" : "400",
                  },
                ]}
              >
                {item.lastMessageContent || "Start chatting..."}
              </Text>
            </View>
            
            {showBadge && (
              <View style={[styles.unreadBadge, { backgroundColor: theme.colors.primary }]}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading || !currentUserId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background, justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Messages</Text>
        <TouchableOpacity>
           <Ionicons name="create-outline" size={24} color={theme.colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item._id}
        renderItem={renderItem}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={{ color: theme.colors.textSecondary, marginTop: 10 }}>No messages yet</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1 },
  headerTitle: { fontSize: 24, fontWeight: "700" },
  chatItem: { flexDirection: "row", padding: 16, borderBottomWidth: 0.5, borderBottomColor: "rgba(0,0,0,0.1)" },
  avatarContainer: { position: "relative" },
  avatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: "#ccc" },
  onlineBadge: { position: "absolute", bottom: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: "#4CAF50", borderWidth: 2, borderColor: "#fff" },
  chatContent: { flex: 1, marginLeft: 16, justifyContent: "center" },
  topRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 4 },
  name: { fontSize: 16, fontWeight: "600" },
  time: { fontSize: 12 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMessage: { fontSize: 14, flexShrink: 1 },
  unreadBadge: { minWidth: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center", paddingHorizontal: 6, marginLeft: 8 },
  unreadText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  emptyContainer: { alignItems: "center", marginTop: 100 },
});

export default ChatListScreen;