import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Image,
  ActivityIndicator,
  Modal,
  Dimensions,
  Animated,
  PanResponder,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';
import socketService from '../../services/socket';
import GifPickerModal from '../../components/GifPickerModal';

const { width, height } = Dimensions.get('window');
const SWIPE_THRESHOLD = 60;

const ChatScreen = ({ route, navigation }) => {
  const { conversationId, targetUser, conversation } = route.params;
  const { user, token } = useSelector(state => state.auth);
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const insets = useSafeAreaInsets();

  // ✅ Group Chat Detection
  const isGroup = conversation?.type === 'group';

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [selectedMessage, setSelectedMessage] = useState(null);
  const [showActions, setShowActions] = useState(false);

  const flatListRef = useRef();
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);

  const getMyId = () => user?.id || user?.userId || user?._id;
  const getUserId = (userObj) => userObj?.id || userObj?._id || userObj;

  useEffect(() => {
    console.log("🟢 [ChatScreen] Mounted. ID:", conversationId, "IsGroup:", isGroup);
    let isMounted = true;

    const markAsRead = async () => {
      try {
        await api.post(`/chat/${conversationId}/read`);
        console.log("✅ Marked as read on server");
      } catch (err) {
        console.error("❌ Failed to mark read:", err);
      }
    };

    markAsRead();
    fetchMessages();

    if (!socketService.socket && token) {
      socketService.connect(token);
    }

    const attemptJoin = () => {
      if (!isMounted) return;
      if (socketService.socket && socketService.socket.connected) {
        console.log("🚪 Joining room:", conversationId);
        socketService.joinConversation(conversationId);
        setupSocketListeners();
      } else {
        setTimeout(attemptJoin, 500);
      }
    };

    attemptJoin();

    return () => {
      console.log("👋 Cleaning up");
      isMounted = false;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketService.leaveConversation(conversationId);
      cleanupSocketListeners();
    };
  }, [conversationId, token]);

  const setupSocketListeners = () => {
    if (!socketService.socket) return;

    socketService.socket.off('new_message');
    socketService.socket.off('messages_seen');
    socketService.socket.off('user_typing');
    socketService.socket.off('message_reaction');
    socketService.socket.off('message_deleted');

    socketService.onNewMessage((newMessage) => {
      if (newMessage.conversation === conversationId) {
        const senderId = getUserId(newMessage.sender);
        const myId = getMyId();
        const isFromMe = String(senderId) === String(myId);

        console.log("📨 New message received:", {
          isFromMe,
          content: newMessage.content,
          messageId: newMessage._id
        });

        setMessages(prev => {
          if (isFromMe) {
            const tempIndex = prev.findIndex(m => 
              m.tempId && 
              m.content === newMessage.content &&
              Math.abs(new Date(m.createdAt) - new Date(newMessage.createdAt)) < 5000
            );

            if (tempIndex !== -1) {
              console.log("✅ Replacing temp message with real one");
              const updated = [...prev];
              updated[tempIndex] = { ...newMessage, status: 'sent' };
              return updated;
            }
            
            console.log("⚠️ No temp message found, skipping");
            return prev;
          }

          const exists = prev.find(m => m._id === newMessage._id);
          if (exists) {
            console.log("⚠️ Message already exists, skipping");
            return prev;
          }

          console.log("✅ Adding new message from other user");
          return [newMessage, ...prev];
        });

        if (!isFromMe) {
          setTimeout(() => {
            socketService.emit('mark_seen', {
              conversationId,
              messageId: newMessage._id
            });
          }, 500);
        }
      }
    });

    socketService.onTyping(({ userId, isTyping: typingStatus }) => {
      const myId = getMyId();
      if (String(userId) !== String(myId)) {
        setIsTyping(typingStatus);
      }
    });

    socketService.socket.on('messages_seen', ({ userId, messageIds }) => {
      const myId = getMyId();
      setMessages(prev => prev.map(msg => {
        const senderId = getUserId(msg.sender);
        const isMine = String(senderId) === String(myId);
        if (isMine && (!messageIds || messageIds.length === 0 || messageIds.includes(msg._id))) {
          return { ...msg, status: 'seen' };
        }
        return msg;
      }));
    });

    socketService.socket.on('message_reaction', ({ messageId, reaction, userId }) => {
      setMessages(prev => prev.map(msg => {
        if (msg._id === messageId) {
          const newReactions = { ...msg.reactions };
          if (reaction) {
            newReactions[userId] = reaction;
          } else {
            delete newReactions[userId];
          }
          return { ...msg, reactions: newReactions };
        }
        return msg;
      }));
    });

    socketService.socket.on('message_deleted', ({ messageId }) => {
      setMessages(prev => prev.map(msg =>
        msg._id === messageId
          ? { ...msg, isDeleted: true, content: 'This message was deleted' }
          : msg
      ));
    });
  };

  const cleanupSocketListeners = () => {
    if (socketService.socket) {
      socketService.socket.off('new_message');
      socketService.socket.off('messages_seen');
      socketService.socket.off('user_typing');
      socketService.socket.off('message_reaction');
      socketService.socket.off('message_deleted');
    }
  };

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/chat/${conversationId}/messages`);
      if (res.data.success) {
        setMessages(res.data.data);
      }
    } catch (error) {
      console.error("❌ Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = (content, type = 'text', media = null) => {
    if (!content && !media) return;

    const tempId = `temp_${Date.now()}_${Math.random()}`;
    const tempMessage = {
      _id: tempId,
      tempId: tempId,
      conversation: conversationId,
      sender: user,
      content: content,
      type: type,
      media: media,
      replyTo: replyTo,
      createdAt: new Date().toISOString(),
      status: 'sending',
      reactions: {}
    };

    console.log("📤 Sending message:", { tempId, content, replyTo: replyTo?._id, isGroup });

    setMessages(prev => [tempMessage, ...prev]);
    setReplyTo(null);

    // ✅ Updated payload for groups
    const payload = {
      conversationId,
      content,
      type,
      media,
      replyTo: replyTo?._id
    };

    // Only add targetUserId for DMs
    if (!isGroup && targetUser) {
      payload.targetUserId = getUserId(targetUser);
    }

    socketService.sendMessage(payload, (response) => {
      console.log("📬 Server response:", response);
      
      if (response && response.status === 'ok') {
        console.log("✅ Message acknowledged by server");
      } else {
        console.error("❌ Send failed");
        setMessages(prev => prev.map(msg =>
          msg.tempId === tempId
            ? { ...msg, status: 'failed' }
            : msg
        ));
      }
    });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketService.stopTyping(conversationId);
    if (type === 'text') setInputText('');
  };

  const handleTextChange = (text) => {
    setInputText(text);
    socketService.startTyping(conversationId);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(conversationId);
    }, 2000);
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      setUploading(true);

      const formData = new FormData();
      formData.append('file', {
        uri: asset.uri,
        type: 'image/jpeg',
        name: 'upload.jpg'
      });

      try {
        const res = await api.post('/media/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        if (res.data.success) {
          const { url, width, height } = res.data.data;
          sendMessage(url, 'image', { width, height });
        }
      } catch (err) {
        console.error("Upload failed", err);
        Alert.alert('Error', 'Failed to upload image');
      } finally {
        setUploading(false);
      }
    }
  };

  const handleGifSelect = (gif) => {
    sendMessage(gif.url, 'gif', { width: gif.width, height: gif.height });
    setGifModalVisible(false);
  };

  const handleReaction = (messageId, reaction) => {
    socketService.emit('add_reaction', {
      conversationId,
      messageId,
      reaction
    });
    setShowActions(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleReply = (message) => {
    setReplyTo(message);
    setShowActions(false);
    inputRef.current?.focus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleLongPress = (message) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSelectedMessage(message);
    setShowActions(true);
  };

  const handleDelete = async (messageId) => {
    socketService.emit('delete_message', { conversationId, messageId }, (response) => {
      if (response.status === 'ok') {
        setShowActions(false);
      } else {
        Alert.alert('Error', 'Failed to delete message');
      }
    });
  };

  // ✅ Updated Header for Group Support
  const renderHeader = () => {
    let displayName, avatarUri, subtitle = '';

    if (isGroup) {
      displayName = conversation?.groupName || "Group Chat";
      avatarUri = conversation?.groupAvatar || "https://via.placeholder.com/40";
      subtitle = `${conversation?.participants?.length || 0} members`;
    } else {
      displayName = targetUser?.username || targetUser?.name || "User";
      avatarUri = targetUser?.profile?.avatar || targetUser?.avatar || "https://via.placeholder.com/40";
      if (isTyping) {
        subtitle = "typing...";
      } else if (targetUser?.isOnline) {
        subtitle = "Active now";
      }
    }

    return (
      <View style={[styles.header, {
        backgroundColor: isDark ? '#000' : '#FFF',
        borderBottomColor: isDark ? '#262626' : '#DBDBDB'
      }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={30} color={theme.colors.text} />
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.headerCenter} 
          activeOpacity={0.7}
          onPress={() => {
            if (isGroup) {
              navigation.navigate('GroupInfoScreen', { groupId: conversationId });
            }
          }}
        >
          <View style={styles.headerAvatarContainer}>
            <Image
              source={{ uri: avatarUri }}
              style={styles.headerAvatar}
            />
            {isGroup && (
              <View style={styles.groupHeaderBadge}>
                <Ionicons name="people" size={10} color="#FFF" />
              </View>
            )}
          </View>
          <View style={styles.headerInfo}>
            <Text style={[styles.headerName, { color: theme.colors.text }]}>
              {displayName}
            </Text>
            {subtitle && (
              <Text style={[
                styles.headerSubtitle,
                { color: isTyping ? '#0095F6' : theme.colors.textSecondary }
              ]}>
                {subtitle}
              </Text>
            )}
          </View>
        </TouchableOpacity>

        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="call-outline" size={24} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerBtn}>
            <Ionicons name="videocam-outline" size={26} color={theme.colors.text} />
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.headerBtn}
            onPress={() => {
              if (isGroup) {
                navigation.navigate('GroupInfoScreen', { groupId: conversationId });
              }
            }}
          >
            <Ionicons name="information-circle-outline" size={26} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item, index }) => {
    const senderId = getUserId(item.sender);
    const myId = getMyId();
    const isMe = String(senderId) === String(myId);

    const nextMessage = messages[index + 1];
    const nextSenderId = nextMessage ? getUserId(nextMessage.sender) : null;
    const isLastInGroup = !nextMessage || String(nextSenderId) !== String(senderId);

    return (
      <SwipeableMessage
        message={item}
        isMe={isMe}
        isLastInGroup={isLastInGroup}
        onSwipe={() => handleReply(item)}
        onLongPress={() => handleLongPress(item)}
        onImagePress={() => (item.type === 'image' || item.type === 'gif') && setFullScreenImage(item.content)}
        theme={theme}
        isDark={isDark}
        targetUser={targetUser}
        currentUser={user}
        isGroup={isGroup}
        conversation={conversation}
      />
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#000' : '#FFF' }]} edges={['top']}>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />

      {renderHeader()}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item, index) => item._id || item.tempId || `msg_${index}`}
        inverted
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        ListFooterComponent={loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null}
      />

      {replyTo && (
        <View style={[styles.replyBar, { 
          backgroundColor: isDark ? '#1A1A1A' : '#F0F0F0',
          borderTopColor: isDark ? '#262626' : '#DBDBDB'
        }]}>
          <View style={styles.replyContent}>
            <Ionicons name="return-up-forward" size={16} color={theme.colors.textSecondary} />
            <View style={styles.replyTextContainer}>
              <Text style={[styles.replyName, { color: theme.colors.primary }]}>
                {getUserId(replyTo.sender) === getMyId() 
                  ? 'You' 
                  : (replyTo.sender?.username || targetUser?.username || 'User')}
              </Text>
              <Text style={[styles.replyText, { color: theme.colors.textSecondary }]} numberOfLines={1}>
                {replyTo.content || 'Photo'}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)}>
            <Ionicons name="close" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[styles.inputContainer, {
          backgroundColor: isDark ? '#000' : '#FFF',
          borderTopColor: isDark ? '#262626' : '#DBDBDB',
          paddingBottom: insets.bottom || 8
        }]}>
          <TouchableOpacity style={styles.inputIcon}>
            <Ionicons name="camera-outline" size={26} color={theme.colors.primary} />
          </TouchableOpacity>

          <View style={[styles.inputWrapper, {
            backgroundColor: isDark ? '#262626' : '#F0F0F0'
          }]}>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.colors.text }]}
              placeholder="Message..."
              placeholderTextColor={theme.colors.textSecondary}
              value={inputText}
              onChangeText={handleTextChange}
              multiline
              maxLength={2000}
            />

            <View style={styles.inputActions}>
              <TouchableOpacity onPress={() => setGifModalVisible(true)}>
                <Ionicons name="happy-outline" size={22} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickImage} disabled={uploading}>
                {uploading ? (
                  <ActivityIndicator size="small" color={theme.colors.primary} />
                ) : (
                  <Ionicons name="image-outline" size={22} color={theme.colors.textSecondary} style={{ marginLeft: 8 }} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          {inputText.trim() ? (
            <TouchableOpacity onPress={() => sendMessage(inputText, 'text')}>
              <Text style={[styles.sendText, { color: theme.colors.primary }]}>Send</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.inputIcon}>
              <Ionicons name="mic-outline" size={26} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      <Modal
        visible={showActions}
        transparent
        animationType="fade"
        onRequestClose={() => setShowActions(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowActions(false)}
        >
          <View style={[styles.actionsMenu, { backgroundColor: isDark ? '#262626' : '#FFF' }]}>
            <View style={styles.reactionsRow}>
              {['❤️', '😂', '😮', '😢', '👍', '🔥'].map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  style={styles.reactionBtn}
                  onPress={() => handleReaction(selectedMessage?._id, emoji)}
                >
                  <Text style={styles.reactionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.actionItem, { borderTopColor: isDark ? '#3A3A3A' : '#E0E0E0' }]}
              onPress={() => handleReply(selectedMessage)}
            >
              <Ionicons name="arrow-undo-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.actionText, { color: theme.colors.text }]}>Reply</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionItem, { borderTopColor: isDark ? '#3A3A3A' : '#E0E0E0' }]}
              onPress={() => setShowActions(false)}
            >
              <Ionicons name="copy-outline" size={20} color={theme.colors.text} />
              <Text style={[styles.actionText, { color: theme.colors.text }]}>Copy</Text>
            </TouchableOpacity>

            {selectedMessage && getUserId(selectedMessage.sender) === getMyId() && (
              <TouchableOpacity
                style={[styles.actionItem, { borderTopColor: isDark ? '#3A3A3A' : '#E0E0E0' }]}
                onPress={() => handleDelete(selectedMessage._id)}
              >
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.actionText, { color: '#FF3B30' }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <GifPickerModal
        visible={gifModalVisible}
        onClose={() => setGifModalVisible(false)}
        onSelectGif={handleGifSelect}
      />

      <Modal
        visible={!!fullScreenImage}
        transparent
        animationType="fade"
        onRequestClose={() => setFullScreenImage(null)}
      >
        <View style={styles.fullScreenContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setFullScreenImage(null)}
          >
            <Ionicons name="close" size={32} color="#FFF" />
          </TouchableOpacity>

          {fullScreenImage && (
            <Image
              source={{ uri: fullScreenImage }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
};

// ✅ Updated Swipeable Message Component with Group Support
const SwipeableMessage = ({ 
  message, 
  isMe, 
  isLastInGroup, 
  onSwipe, 
  onLongPress, 
  onImagePress, 
  theme, 
  isDark, 
  targetUser, 
  currentUser,
  isGroup,
  conversation 
}) => {
  const translateX = useRef(new Animated.Value(0)).current;
  const replyIconOpacity = useRef(new Animated.Value(0)).current;
  const replyIconScale = useRef(new Animated.Value(0.5)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return Math.abs(gestureState.dx) > 10 && Math.abs(gestureState.dy) < 10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (isMe && gestureState.dx < 0) {
          translateX.setValue(Math.max(gestureState.dx, -SWIPE_THRESHOLD));
          const progress = Math.min(Math.abs(gestureState.dx) / SWIPE_THRESHOLD, 1);
          replyIconOpacity.setValue(progress);
          replyIconScale.setValue(0.5 + progress * 0.5);
        } else if (!isMe && gestureState.dx > 0) {
          translateX.setValue(Math.min(gestureState.dx, SWIPE_THRESHOLD));
          const progress = Math.min(gestureState.dx / SWIPE_THRESHOLD, 1);
          replyIconOpacity.setValue(progress);
          replyIconScale.setValue(0.5 + progress * 0.5);
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        const swipeDistance = Math.abs(gestureState.dx);
        if (swipeDistance > SWIPE_THRESHOLD * 0.6) {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onSwipe();
        }

        Animated.parallel([
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 100,
            friction: 10
          }),
          Animated.timing(replyIconOpacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true
          }),
          Animated.timing(replyIconScale, {
            toValue: 0.5,
            duration: 200,
            useNativeDriver: true
          })
        ]).start();
      }
    })
  ).current;

  const messageTime = new Date(message.createdAt).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });

  // ✅ Show sender name in groups for others' messages
  const showSenderName = isGroup && !isMe && message.type !== 'system';
  const senderName = showSenderName ? (message.sender?.username || 'Unknown') : null;

  const renderReplyPreview = () => {
    if (!message.replyTo) return null;
    
    const replyContent = typeof message.replyTo === 'object' 
      ? (message.replyTo.content || (message.replyTo.type === 'image' ? '📷 Photo' : 'Message'))
      : 'Message';

    return (
      <View style={[styles.replyPreview, {
        backgroundColor: isMe ? 'rgba(0,0,0,0.2)' : (isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
      }]}>
        <View style={[styles.replyBorder, { backgroundColor: isMe ? '#FFF' : theme.colors.primary }]} />
        <Text style={[styles.replyPreviewText, {
          color: isMe ? '#FFF' : theme.colors.text
        }]} numberOfLines={1}>
          {replyContent}
        </Text>
      </View>
    );
  };

  const renderReactions = () => {
    if (!message.reactions || Object.keys(message.reactions).length === 0) return null;
    const reactions = Object.values(message.reactions);
    return (
      <View style={[styles.reactionsContainer, isMe ? styles.reactionsMe : styles.reactionsThem]}>
        {reactions.slice(0, 3).map((reaction, i) => (
          <Text key={i} style={styles.reactionItem}>{reaction}</Text>
        ))}
      </View>
    );
  };

  const renderStatus = () => {
    if (!isMe) return null;

    switch (message.status) {
      case 'sending':
        return <Ionicons name="time-outline" size={14} color="rgba(255,255,255,0.6)" style={{ marginLeft: 4 }} />;
      case 'sent':
        return <Ionicons name="checkmark-circle" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
      case 'delivered':
        return <Ionicons name="checkmark-done-circle" size={14} color="rgba(255,255,255,0.7)" style={{ marginLeft: 4 }} />;
      case 'seen':
        return (
          <Image
            source={{ uri: targetUser?.profile?.avatar || targetUser?.avatar || 'https://via.placeholder.com/14' }}
            style={styles.seenAvatar}
          />
        );
      case 'failed':
        return <Ionicons name="alert-circle" size={14} color="#FF3B30" style={{ marginLeft: 4 }} />;
      default:
        return null;
    }
  };

  // ✅ System Message Rendering (for group events)
  if (message.type === 'system') {
    return (
      <View style={styles.systemMessageContainer}>
        <Text style={[styles.systemMessage, { color: theme.colors.textSecondary }]}>
          {message.content}
        </Text>
      </View>
    );
  }

  const renderMessageContent = () => {
    if (message.isDeleted) {
      return (
        <View style={[
          styles.textBubble,
          isMe
            ? [styles.bubbleMe, { backgroundColor: isDark ? '#262626' : '#EFEFEF' }]
            : [styles.bubbleThem, { backgroundColor: isDark ? '#262626' : '#EFEFEF' }],
          isLastInGroup && (isMe ? styles.bubbleLastMe : styles.bubbleLastThem)
        ]}>
          <Text style={[
            styles.messageText,
            { color: theme.colors.textSecondary, fontStyle: 'italic' }
          ]}>
            This message was deleted
          </Text>
        </View>
      );
    }

    switch (message.type) {
      case 'image':
      case 'gif':
        const aspectRatio = message.media?.width && message.media?.height
          ? message.media.width / message.media.height
          : 1;
        const imageWidth = Math.min(width * 0.65, 250);
        const imageHeight = imageWidth / aspectRatio;

        return (
          <View>
            {showSenderName && (
              <Text style={[styles.senderName, { color: theme.colors.primary }]}>
                {senderName}
              </Text>
            )}
            <TouchableOpacity onPress={onImagePress} activeOpacity={0.9}>
              <View style={[
                styles.imageBubble,
                isLastInGroup && (isMe ? styles.bubbleLastMe : styles.bubbleLastThem)
              ]}>
                {renderReplyPreview()}
                <Image
                  source={{ uri: message.content }}
                  style={[styles.messageImage, { width: imageWidth, height: Math.min(imageHeight, 350) }]}
                  resizeMode="cover"
                />
                <View style={styles.imageTimeOverlay}>
                  <Text style={styles.imageTime}>{messageTime}</Text>
                  {renderStatus()}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        );

      case 'text':
      default:
        return (
          <View>
            {showSenderName && (
              <Text style={[styles.senderName, { color: theme.colors.primary }]}>
                {senderName}
              </Text>
            )}
            <View style={[
              styles.textBubble,
              isMe
                ? [styles.bubbleMe, { backgroundColor: theme.colors.primary }]
                : [styles.bubbleThem, { backgroundColor: isDark ? '#262626' : '#EFEFEF' }],
              isLastInGroup && (isMe ? styles.bubbleLastMe : styles.bubbleLastThem)
            ]}>
              {renderReplyPreview()}
              <Text style={[
                styles.messageText,
                { color: isMe ? '#FFF' : theme.colors.text }
              ]}>
                {message.content}
              </Text>
              <View style={styles.timeRow}>
                <Text style={[
                  styles.timeText,
                  { color: isMe ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }
                ]}>
                  {messageTime}
                </Text>
                {renderStatus()}
              </View>
            </View>
          </View>
        );
    }
  };

  return (
    <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
      <Animated.View
        style={[
          styles.replyIcon,
          isMe ? styles.replyIconMe : styles.replyIconThem,
          {
            opacity: replyIconOpacity,
            transform: [{ scale: replyIconScale }]
          }
        ]}
      >
        <Ionicons name="arrow-undo-outline" size={20} color={theme.colors.textSecondary} />
      </Animated.View>

      <Animated.View
        style={[
          styles.messageWrapper,
          { transform: [{ translateX }] }
        ]}
        {...panResponder.panHandlers}
      >
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={onLongPress}
          delayLongPress={200}
        >
          {renderMessageContent()}
          {renderReactions()}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: 0.5,
  },
  backBtn: { padding: 4 },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 4,
  },
  headerAvatarContainer: {
    position: 'relative',
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  groupHeaderBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#0095F6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  headerInfo: { marginLeft: 10 },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
  },
  headerSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  typingIndicator: {
    fontSize: 12,
    color: '#0095F6',
    marginTop: 2,
  },
  activeStatus: {
    fontSize: 12,
    color: '#8E8E93',
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: { padding: 6 },

  messagesList: {
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },

  messageRow: {
    marginBottom: 3,
    position: 'relative',
  },
  messageRowMe: { alignItems: 'flex-end' },
  messageRowThem: { alignItems: 'flex-start' },
  messageWrapper: {
    maxWidth: '75%',
  },

  // ✅ System Message
  systemMessageContainer: {
    alignItems: 'center',
    marginVertical: 8,
  },
  systemMessage: {
    fontSize: 12,
    fontStyle: 'italic',
    paddingHorizontal: 16,
    paddingVertical: 6,
    textAlign: 'center',
  },

  // ✅ Sender Name (for group chats)
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginLeft: 12,
  },

  replyIcon: {
    position: 'absolute',
    top: '50%',
    marginTop: -12,
  },
  replyIconMe: { left: 8 },
  replyIconThem: { right: 8 },

  textBubble: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    borderBottomLeftRadius: 4,
  },
  bubbleLastMe: {
    borderBottomRightRadius: 20,
  },
  bubbleLastThem: {
    borderBottomLeftRadius: 20,
  },

  messageText: {
    fontSize: 15,
    lineHeight: 20,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  timeText: {
    fontSize: 11,
  },
  seenAvatar: {
    width: 14,
    height: 14,
    borderRadius: 7,
    marginLeft: 4,
  },

  imageBubble: {
    borderRadius: 18,
    overflow: 'hidden',
  },
  messageImage: {
    borderRadius: 18,
  },
  imageTimeOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  imageTime: {
    fontSize: 11,
    color: '#FFF',
  },

  replyPreview: {
    paddingLeft: 10,
    paddingRight: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  replyBorder: {
    width: 3,
    height: '100%',
    borderRadius: 2,
    marginRight: 8,
  },
  replyPreviewText: {
    fontSize: 13,
    flex: 1,
  },

  reactionsContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: -8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  reactionsMe: { alignSelf: 'flex-end', marginRight: 8 },
  reactionsThem: { alignSelf: 'flex-start', marginLeft: 8 },
  reactionItem: {
    fontSize: 14,
    marginHorizontal: 2,
  },

  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  replyContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  replyTextContainer: {
    marginLeft: 10,
    flex: 1,
  },
  replyName: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  replyText: {
    fontSize: 13,
  },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  inputIcon: {
    padding: 6,
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginHorizontal: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    maxHeight: 100,
  },
  inputActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  sendText: {
    fontSize: 16,
    fontWeight: '600',
    paddingHorizontal: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionsMenu: {
    width: width * 0.85,
    borderRadius: 14,
    overflow: 'hidden',
  },
  reactionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
  },
  reactionBtn: {
    padding: 8,
  },
  reactionEmoji: {
    fontSize: 28,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 0.5,
  },
  actionText: {
    fontSize: 16,
    marginLeft: 16,
  },

  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'black',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: width,
    height: height,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
  },
});

export default ChatScreen;
