import React, { useState, useCallback, useEffect } from "react";
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
import CreateGroupModal from "../../components/CreateGroupModal";

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
  const [activeTab, setActiveTab] = useState("all"); // all, dms, groups
  const [activeUsers, setActiveUsers] = useState([]);
  const [messageRequests, setMessageRequests] = useState(0);
  const [showGroupModal, setShowGroupModal] = useState(false);

  const currentUserId = normalizeId(user);

  const fetchConversations = async () => {
    if (!token) return;
    try {
      const res = await api.get("/chat/conversations");
      if (res.data.success) {
        const convos = res.data.data || [];
        setConversations(convos);
        filterConversations(activeTab, convos, searchQuery);
        
        // Extract active users from DMs only
        const active = convos
          .filter(conv => conv.type === 'direct')
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

  const filterConversations = (tab, convos = conversations, query = searchQuery) => {
    let filtered = convos;

    // Filter by tab
    if (tab === "dms") {
      filtered = convos.filter(c => c.type === 'direct');
    } else if (tab === "groups") {
      filtered = convos.filter(c => c.type === 'group');
    }

    // Filter by search
    if (query.trim() !== "") {
      filtered = filtered.filter(conv => {
        if (conv.type === 'group') {
          return conv.groupName?.toLowerCase().includes(query.toLowerCase());
        } else {
          const participants = conv.participants || [];
          const otherUser = participants.find(p => normalizeId(p) !== currentUserId);
          const username = otherUser?.username || "";
          return username.toLowerCase().includes(query.toLowerCase());
        }
      });
    }

    setFilteredConversations(filtered);
  };

  useEffect(() => {
    filterConversations(activeTab);
  }, [searchQuery, conversations, activeTab, currentUserId]);

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

  const handleGroupCreated = (newGroup) => {
    setConversations(prev => [newGroup, ...prev]);
    navigation.navigate("ChatScreen", {
      conversationId: newGroup._id,
      conversation: newGroup
    });
  };

  const renderChatItem = ({ item }) => {
    if (!currentUserId) return null;

    const isGroup = item.type === 'group';
    let displayName, avatarUri, isOnline = false;

    if (isGroup) {
      displayName = item.groupName || "Group Chat";
      avatarUri = item.groupAvatar || "https://via.placeholder.com/50";
    } else {
      const participants = item.participants || [];
      let otherUser = participants.find((p) => normalizeId(p) !== currentUserId);
      if (!otherUser && participants.length > 0) otherUser = participants[0];
      
      displayName = otherUser?.username || "Unknown";
      avatarUri = otherUser?.profile?.avatar || otherUser?.avatar || "https://via.placeholder.com/50";
      isOnline = otherUser?.isOnline || false;
    }
    
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
            conversation: item,
            targetUser: !isGroup ? item.participants.find(p => normalizeId(p) !== currentUserId) : null
          });
        }}
        onLongPress={() => {
          if (isGroup) {
            navigation.navigate("GroupInfoScreen", { groupId: item._id });
          }
        }}
      >
        <View style={styles.avatarWrapper}>
          {isGroup ? (
            <View style={styles.groupAvatarContainer}>
              <Image source={{ uri: avatarUri }} style={styles.chatAvatar} />
              <View style={styles.groupBadge}>
                <Ionicons name="people" size={12} color="#FFF" />
              </View>
            </View>
          ) : (
            <>
              <Image source={{ uri: avatarUri }} style={styles.chatAvatar} />
              {isOnline && <View style={styles.onlineIndicator} />}
            </>
          )}
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
        <View style={styles.headerRight}>
          <TouchableOpacity style={styles.iconButton}>
            <Ionicons name="videocam-outline" size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={() => setShowGroupModal(true)}
          >
            <Ionicons name="people-outline" size={26} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
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

      {/* Tabs */}
      {searchQuery === "" && (
        <View style={[styles.tabsContainer, { borderBottomColor: theme.colors.border }]}>
          <TouchableOpacity 
            style={styles.tab}
            onPress={() => setActiveTab("all")}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === "all" ? theme.colors.text : theme.colors.textSecondary },
              activeTab === "all" && styles.activeTabText
            ]}>
              All
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tab}
            onPress={() => setActiveTab("dms")}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === "dms" ? theme.colors.text : theme.colors.textSecondary },
              activeTab === "dms" && styles.activeTabText
            ]}>
              DMs
            </Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.tab}
            onPress={() => setActiveTab("groups")}
          >
            <Text style={[
              styles.tabText, 
              { color: activeTab === "groups" ? theme.colors.text : theme.colors.textSecondary },
              activeTab === "groups" && styles.activeTabText
            ]}>
              Groups
            </Text>
          </TouchableOpacity>
          <View style={[
            styles.tabIndicator, 
            { backgroundColor: theme.colors.text },
            activeTab === "dms" && { left: '33.33%' },
            activeTab === "groups" && { left: '66.66%' }
          ]} />
        </View>
      )}

      {/* Active Now (only for DMs) */}
      {activeUsers.length > 0 && searchQuery === "" && activeTab !== "groups" && (
        <View style={styles.activeSection}>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.activeScrollContent}
          >
            {activeUsers.map((user, index) => (
              <TouchableOpacity 
                key={index}
                style={styles.activeUserItem}
                onPress={() => {
                  const conv = conversations.find(c => 
                    c.type === 'direct' && c.participants.some(p => normalizeId(p) === normalizeId(user))
                  );
                  if (conv) {
                    navigation.navigate("ChatScreen", {
                      conversationId: conv._id,
                      conversation: conv,
                      targetUser: user
                    });
                  }
                }}
              >
                <View style={styles.activeBorder}>
                  <View style={[styles.activeUserImageContainer, { backgroundColor: theme.colors.background }]}>
                    <Image 
                      source={{ uri: user?.profile?.avatar || user?.avatar || "https://via.placeholder.com/50" }} 
                      style={styles.activeUserImage} 
                    />
                  </View>
                </View>
                <Text 
                  style={[styles.activeUserName, { color: theme.colors.text }]} 
                  numberOfLines={1}
                >
                  {user?.username || "User"}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Divider */}
      {activeUsers.length > 0 && searchQuery === "" && activeTab !== "groups" && (
        <View style={[styles.divider, { backgroundColor: theme.colors.border }]} />
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
            <Ionicons 
              name={activeTab === "groups" ? "people-outline" : "chatbubbles-outline"} 
              size={64} 
              color={theme.colors.textSecondary} 
            />
            <Text style={[styles.emptyText, { color: theme.colors.textSecondary }]}>
              {searchQuery ? "No results found" : 
               activeTab === "groups" ? "No groups yet" : "No messages yet"}
            </Text>
            <Text style={[styles.emptySubtext, { color: theme.colors.textSecondary }]}>
              {searchQuery ? "Try a different search" : 
               activeTab === "groups" ? "Create a group to start chatting" : "Send a message to start chatting"}
            </Text>
          </View>
        }
      />

      {/* Create Group Modal */}
      <CreateGroupModal
        visible={showGroupModal}
        onClose={() => setShowGroupModal(false)}
        onGroupCreated={handleGroupCreated}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  
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
  headerRight: {
    flexDirection: "row",
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },

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

  tabsContainer: {
    flexDirection: "row",
    position: "relative",
    borderBottomWidth: 0.5,
  },
  tab: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
  },
  tabText: { fontSize: 16, fontWeight: "500" },
  activeTabText: { fontWeight: "700" },
  tabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    width: "33.33%",
    height: 1.5,
  },

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

  divider: {
    height: 0.5,
    marginHorizontal: 16,
  },

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
  groupAvatarContainer: {
    position: 'relative',
  },
  chatAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#ccc",
  },
  groupBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
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
