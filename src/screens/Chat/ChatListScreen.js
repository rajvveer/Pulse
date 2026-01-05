import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  ScrollView,
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
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeUsers, setActiveUsers] = useState([]);

  const currentUserId = normalizeId(user);

  // Fetch conversations
  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await api.get("/chat/conversations");
      if (res.data.success) {
        const convos = res.data.data || [];
        setConversations(convos);
        setFilteredConversations(convos);
        
        // Extract active users
        const active = convos
          .map(conv => {
            const participants = conv.participants || [];
            const otherUser = participants.find(p => normalizeId(p) !== currentUserId);
            return otherUser?.isOnline ? otherUser : null;
          })
          .filter(Boolean)
          .slice(0, 10);
        setActiveUsers(active);
      }
    } catch (error) {
      console.error("❌ [ChatList] Fetch error:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Search filter
  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredConversations(conversations);
    } else {
      const filtered = conversations.filter(conv => {
        const participants = conv.participants || [];
        const otherUser = participants.find(p => normalizeId(p) !== currentUserId);
        const username = otherUser?.username || "";
        return username.toLowerCase().includes(searchQuery.toLowerCase());
      });
      setFilteredConversations(filtered);
    }
  }, [searchQuery, conversations, currentUserId]);

  // Socket listeners
  useFocusEffect(
    useCallback(() => {
      if (token && currentUserId) {
        fetchConversations();
      }

      if (token && !socketService.socket) {
        socketService.connect(token);
      }

      const handleLiveMessage = (newMessage) => {
        if (!currentUserId) return;
        
        setConversations((prevConvos) => {
          const exists = prevConvos.find((c) => c._id === newMessage.conversation);
          const senderId = normalizeId(newMessage.sender);
          const isFromMe = senderId === currentUserId;

          if (exists) {
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
            return [updatedConvo, ...prevConvos.filter((c) => c._id !== newMessage.conversation)];
          } else {
            fetchConversations(); 
            return prevConvos;
          }
        });
      };

      if (socketService.socket) {
        socketService.socket.off('new_message'); 
        socketService.socket.on('new_message', handleLiveMessage);
        socketService.socket.off('messages_seen');
        socketService.socket.on('messages_seen', () => fetchConversations());
      }

      return () => {
        if (socketService.socket) {
          socketService.socket.off('new_message', handleLiveMessage);
          socketService.socket.off('messages_seen');
        }
      };
    }, [token, currentUserId])
  );

  const onRefresh = () => {
    setRefreshing(true);
    fetchConversations();
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "now";
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString();
  };

  // Active user item
  const renderActiveUser = ({ item }) => (
    <TouchableOpacity 
      style={styles.activeUserItem}
      onPress={() => {
        const conv = conversations.find(c => 
          c.participants.some(p => normalizeId(p) === normalizeId(item))
        );
        if (conv) {
          navigation.navigate("ChatScreen", {
            conversationId: conv._id,
            targetUser: item,
          });
        }
      }}
    >
      <View style={styles.activeBorder}>
        <View style={[styles.activeUserImageContainer, { backgroundColor: theme.colors.background }]}>
          <Image 
            source={{ uri: item?.profile?.avatar || item?.avatar || "https://via.placeholder.com/50" }} 
            style={styles.activeUserImage} 
          />
        </View>
      </View>
      <Text 
        style={[styles.activeUserName, { color: theme.colors.text }]} 
        numberOfLines={1}
      >
        {item?.username || "User"}
      </Text>
    </TouchableOpacity>
  );

  // Chat item
  const renderChatItem = ({ item }) => {
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
        style={[styles.chatItem, { backgroundColor: theme.colors.background }]}
        activeOpacity={0.7}
        onPress={() => {
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
        <View style={styles.avatarWrapper}>
          <Image source={{ uri: avatarUri }} style={styles.chatAvatar} />
          {otherUser?.isOnline && <View style={styles.onlineIndicator} />}
        </View>

        <View style={styles.chatDetails}>
          <View style={styles.chatHeader}>
            <Text style={[styles.chatName, { color: theme.colors.text }]} numberOfLines={1}>
              {displayName}
            </Text>
            <Text style={[styles.chatTime, { color: theme.colors.textSecondary }]}>
              {formatTime(item.lastMessageAt)}
            </Text>
          </View>

          <View style={styles.chatMessageRow}>
            <Text
              numberOfLines={1}
              style={[
                styles.chatMessage,
                {
                  color: showBadge ? theme.colors.text : theme.colors.textSecondary,
                  fontWeight: showBadge ? "600" : "400",
                  flex: 1,
                },
              ]}
            >
              {iSentLast && "You: "}
              {item.lastMessageContent || "Start chatting..."}
            </Text>
            
            {showBadge && (
              <View style={styles.unreadDot} />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading || !currentUserId) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} style={{ marginTop: 100 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.username, { color: theme.colors.text }]}>
            {user?.username || "Messages"}
          </Text>
          <Ionicons name="chevron-down" size={16} color={theme.colors.text} style={{ marginLeft: 4 }} />
        </View>
        <TouchableOpacity 
          style={styles.iconButton}
          onPress={() => {/* Navigate to new message screen */}}
        >
          <Ionicons name="create-outline" size={26} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View style={[styles.searchContainer, { backgroundColor: theme.colors.background }]}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? '#262626' : '#EFEFEF' }]}>
          <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
          <TextInput
            style={[styles.searchInput, { color: theme.colors.text }]}
            placeholder="Search"
            placeholderTextColor={theme.colors.textSecondary}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Active Now Section */}
      {activeUsers.length > 0 && searchQuery === "" && (
        <View style={styles.activeSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeScrollContent}
          >
            {activeUsers.map((user, index) => (
              <View key={index}>
                {renderActiveUser({ item: user })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Divider */}
      {activeUsers.length > 0 && searchQuery === "" && (
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
      )}

      {/* Messages Label */}
      {searchQuery === "" && (
        <View style={styles.messagesLabel}>
          <Text style={[styles.messagesText, { color: theme.colors.text }]}>Messages</Text>
        </View>
      )}

      {/* Chat List */}
      <FlatList
        data={filteredConversations}
        keyExtractor={(item) => item._id}
        renderItem={renderChatItem}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={theme.colors.primary} 
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textSecondary} />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {searchQuery ? "No messages found" : "No messages yet"}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
              {searchQuery ? "Try a different search" : "Send a message to start chatting"}
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  username: {
    fontSize: 22,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
  iconButton: {
    padding: 4,
  },

  // Search Bar
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 4,
  },

  // Active Users Section
  activeSection: {
    paddingVertical: 12,
  },
  activeScrollContent: {
    paddingHorizontal: 12,
    gap: 16,
  },
  activeUserItem: {
    alignItems: "center",
    width: 70,
  },
  activeBorder: {
    padding: 2.5,
    borderRadius: 40,
    borderWidth: 2.5,
    borderColor: '#0095F6',
  },
  activeUserImageContainer: {
    padding: 2.5,
    borderRadius: 37,
  },
  activeUserImage: {
    width: 66,
    height: 66,
    borderRadius: 33,
  },
  activeUserName: {
    fontSize: 12,
    marginTop: 6,
    fontWeight: "400",
  },

  // Divider
  divider: {
    height: 0.5,
    marginHorizontal: 16,
  },

  // Messages Label
  messagesLabel: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  messagesText: {
    fontSize: 16,
    fontWeight: "700",
  },

  // Chat Item
  chatItem: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginRight: 12,
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ccc",
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 2,
    right: 2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#22C55E",
    borderWidth: 2.5,
    borderColor: "#fff",
  },
  chatDetails: {
    flex: 1,
    justifyContent: "center",
  },
  chatHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  chatName: {
    fontSize: 15,
    fontWeight: "600",
    flex: 1,
  },
  chatTime: {
    fontSize: 13,
    marginLeft: 8,
  },
  chatMessageRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  chatMessage: {
    fontSize: 14,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0095F6",
    marginLeft: 8,
  },

  // Empty State
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: "center",
  },
});

export default ChatListScreen;
