import React, { useState, useEffect, useRef } from 'react';
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
  StatusBar
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSelector } from 'react-redux';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { useTheme } from '../../contexts/ThemeContext';
import { getTheme } from '../../styles/theme';
import api from '../../services/api';
import socketService from '../../services/socket';
import GifPickerModal from '../../components/GifPickerModal';

const { width, height } = Dimensions.get('window');

const ChatScreen = ({ route, navigation }) => {
  const { conversationId, targetUser } = route.params;
  const { user, token } = useSelector(state => state.auth);
  const { isDark } = useTheme();
  const theme = getTheme(isDark);
  const insets = useSafeAreaInsets();

  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [gifModalVisible, setGifModalVisible] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState(null);
  const [uploading, setUploading] = useState(false);

  const flatListRef = useRef();
  const typingTimeoutRef = useRef(null);
  const scrollY = useRef(new Animated.Value(0)).current;

  // Get current user ID consistently
  const getMyId = () => user?.id || user?.userId || user?._id;
  const getUserId = (userObj) => userObj?.id || userObj?._id || userObj;

  // 1. Initial Load & Socket Connection
  useEffect(() => {
    console.log("🟢 [ChatScreen] Mounted. ID:", conversationId);
    let isMounted = true;
    let retryTimeout = null;

    // Mark as read on server
    const markAsRead = async () => {
      try {
        await api.post(`/chat/${conversationId}/read`);
        console.log("✅ [ChatScreen] Marked as read on server");
      } catch (err) {
        console.error("❌ [ChatScreen] Failed to mark read:", err);
      }
    };

    markAsRead();

    // Load API history
    if (messages.length === 0) fetchMessages();

    // Connect Socket
    if (!socketService.socket && token) {
      socketService.connect(token);
    }

    // Join Room with retry logic
    const attemptJoin = () => {
      if (!isMounted) return;

      if (socketService.socket && socketService.socket.connected) {
        console.log("🚪 [ChatScreen] Joining room:", conversationId);
        socketService.joinConversation(conversationId);
        setupSocketListeners();
      } else {
        if (isMounted) {
          retryTimeout = setTimeout(attemptJoin, 500);
        }
      }
    };

    attemptJoin();

    // Cleanup
    return () => {
      console.log("👋 [ChatScreen] Cleaning up");
      isMounted = false;
      if (retryTimeout) clearTimeout(retryTimeout);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      socketService.leaveConversation(conversationId);
      cleanupSocketListeners();
    };
  }, [conversationId, token]);

  // 2. Setup Socket Listeners
  const setupSocketListeners = () => {
    if (!socketService.socket) return;

    // Remove old listeners
    socketService.socket.off('new_message');
    socketService.socket.off('messages_seen');
    socketService.socket.off('user_typing');

    // New message listener
    socketService.onNewMessage((newMessage) => {
      if (newMessage.conversation === conversationId) {
        const senderId = getUserId(newMessage.sender);
        const myId = getMyId();
        const isFromMe = String(senderId) === String(myId);

        setMessages(prev => {
          // Strict deduplication - check both _id and tempId
          const existingMessage = prev.find(m => {
            if (m._id && newMessage._id && m._id === newMessage._id) return true;
            if (m.tempId && isFromMe && m.content === newMessage.content && 
                Math.abs(new Date(m.createdAt) - new Date(newMessage.createdAt)) < 5000) {
              return true;
            }
            return false;
          });

          if (existingMessage) {
            // Update existing message instead of adding duplicate
            return prev.map(m => 
              (m._id === newMessage._id || 
               (m.tempId && isFromMe && m.content === newMessage.content && 
                Math.abs(new Date(m.createdAt) - new Date(newMessage.createdAt)) < 5000))
                ? { ...newMessage, status: isFromMe ? 'sent' : newMessage.status }
                : m
            );
          }

          // Add new message
          return [newMessage, ...prev];
        });

        // Mark as seen if from other user
        if (!isFromMe) {
          socketService.emit('mark_seen', {
            conversationId,
            messageId: newMessage._id
          });
        }
      }
    });

    // Typing indicator
    socketService.onTyping(({ userId, isTyping: typingStatus }) => {
      const myId = getMyId();
      if (String(userId) !== String(myId)) {
        setIsTyping(typingStatus);
      }
    });

    // Messages seen listener
    socketService.socket.on('messages_seen', ({ userId, messageIds }) => {
      const myId = getMyId();
      
      setMessages(prev => prev.map(msg => {
        const senderId = getUserId(msg.sender);
        const isMine = String(senderId) === String(myId);
        
        // Update my messages to seen
        if (isMine && (!messageIds || messageIds.includes(msg._id))) {
          return { ...msg, status: 'seen' };
        }
        return msg;
      }));
    });
  };

  const cleanupSocketListeners = () => {
    if (socketService.socket) {
      socketService.socket.off('new_message');
      socketService.socket.off('messages_seen');
      socketService.socket.off('user_typing');
    }
  };

  // 3. Fetch Messages
  const fetchMessages = async () => {
    try {
      const res = await api.get(`/chat/${conversationId}/messages`);
      if (res.data.success) {
        setMessages(res.data.data);
      }
    } catch (error) {
      console.error("❌ [ChatScreen] Fetch error:", error);
    } finally {
      setLoading(false);
    }
  };

  // 4. Send Message with Callback
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
      createdAt: new Date().toISOString(),
      status: 'sending'
    };

    setMessages(prev => [tempMessage, ...prev]);

    const payload = {
      conversationId,
      targetUserId: getUserId(targetUser),
      content,
      type,
      media
    };

    socketService.sendMessage(payload, (response) => {
      if (response && response.status === 'ok') {
        console.log("✅ Server acknowledged message");
        setMessages(prev => prev.map(msg =>
          msg.tempId === tempId
            ? { ...response.message, status: 'sent' }
            : msg
        ));
      } else {
        // Handle error
        setMessages(prev => prev.map(msg =>
          msg.tempId === tempId
            ? { ...msg, status: 'failed' }
            : msg
        ));
      }
    });

    // Stop typing
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socketService.stopTyping(conversationId);

    if (type === 'text') setInputText('');
  };

  // 5. Handle Text Change
  const handleTextChange = (text) => {
    setInputText(text);

    socketService.startTyping(conversationId);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketService.stopTyping(conversationId);
    }, 2000);
  };

  // 6. Image Picker
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
        alert('Failed to upload image');
      } finally {
        setUploading(false);
      }
    }
  };

  // 7. GIF Select
  const handleGifSelect = (gif) => {
    sendMessage(gif.url, 'gif', { width: gif.width, height: gif.height });
  };

  // 8. Render Status Icon
  const renderStatus = (item) => {
    const myId = getMyId();
    const senderId = getUserId(item.sender);
    
    if (String(senderId) !== String(myId)) return null;

    const status = item.status || 'sending';

    switch (status) {
      case 'sending':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.6)" />
          </View>
        );
      case 'sent':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        );
      case 'delivered':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-done" size={14} color="rgba(255,255,255,0.7)" />
          </View>
        );
      case 'seen':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="checkmark-done" size={14} color="#4FC3F7" />
          </View>
        );
      case 'failed':
        return (
          <View style={styles.statusContainer}>
            <Ionicons name="alert-circle" size={14} color="#FF5252" />
          </View>
        );
      default:
        return null;
    }
  };

  // 9. Render Message Bubble
  const renderMessageBubble = ({ item, index }) => {
    const senderId = getUserId(item.sender);
    const myId = getMyId();
    const isMe = String(senderId) === String(myId);

    // Group consecutive messages
    const nextMessage = messages[index + 1];
    const nextSenderId = nextMessage ? getUserId(nextMessage.sender) : null;
    const isLastInGroup = !nextMessage || String(nextSenderId) !== String(senderId);

    const messageTime = new Date(item.createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit'
    });

    // Render based on type
    switch (item.type) {
      case 'image':
      case 'gif':
        const aspectRatio = item.media?.width && item.media?.height
          ? item.media.width / item.media.height
          : 1;
        const imageWidth = Math.min(width * 0.7, 300);
        const imageHeight = imageWidth / aspectRatio;

        return (
          <View style={[styles.messageContainer, isMe ? styles.messageMe : styles.messageThem]}>
            <TouchableOpacity
              onPress={() => setFullScreenImage(item.content)}
              activeOpacity={0.9}
            >
              <View style={[
                styles.imageBubble,
                isMe ? styles.bubbleMe : styles.bubbleThem,
                isLastInGroup && (isMe ? styles.bubbleMeLast : styles.bubbleThemLast)
              ]}>
                <Image
                  source={{ uri: item.content }}
                  style={[styles.messageImage, { width: imageWidth, height: imageHeight }]}
                  resizeMode="cover"
                />
                <View style={styles.imageOverlay}>
                  <Text style={styles.timeTextImage}>{messageTime}</Text>
                  {isMe && renderStatus(item)}
                </View>
              </View>
            </TouchableOpacity>
          </View>
        );

      case 'text':
      default:
        return (
          <View style={[styles.messageContainer, isMe ? styles.messageMe : styles.messageThem]}>
            <View style={[
              styles.bubble,
              isMe ? [styles.bubbleMe, { backgroundColor: theme.colors.primary }] : [styles.bubbleThem, { backgroundColor: isDark ? '#2C2C2E' : '#E5E5EA' }],
              isLastInGroup && (isMe ? styles.bubbleMeLast : styles.bubbleThemLast)
            ]}>
              <Text style={[
                styles.messageText,
                isMe ? styles.messageTextMe : { color: isDark ? '#FFFFFF' : '#000000' }
              ]}>
                {item.content}
              </Text>
              <View style={styles.textFooter}>
                <Text style={[styles.timeText, isMe ? styles.timeTextMe : { color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }]}>
                  {messageTime}
                </Text>
                {isMe && renderStatus(item)}
              </View>
            </View>
          </View>
        );
    }
  };

  // 10. Render Header
  const renderHeader = () => (
    <View style={[
      styles.header,
      { 
        backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
        borderBottomColor: isDark ? '#2C2C2E' : '#E5E5EA'
      }
    ]}>
      <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
        <Ionicons name="chevron-back" size={28} color={theme.colors.text} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerInfo} onPress={() => {
        // Navigate to user profile
      }}>
        <Image
          source={{ uri: targetUser.avatar || 'https://via.placeholder.com/40' }}
          style={styles.headerAvatar}
        />
        <View>
          <Text style={[styles.headerName, { color: theme.colors.text }]}>
            {targetUser.username || targetUser.name}
          </Text>
          {isTyping && (
            <Text style={styles.typingText}>typing...</Text>
          )}
        </View>
      </TouchableOpacity>

      <TouchableOpacity style={styles.headerAction}>
        <Ionicons name="call-outline" size={24} color={theme.colors.text} />
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView 
      style={[styles.container, { backgroundColor: isDark ? '#000000' : '#F2F2F7' }]}
      edges={['top']}
    >
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      
      {renderHeader()}

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessageBubble}
        keyExtractor={(item, index) => {
          // Ensure unique keys by combining multiple identifiers
          const baseKey = item._id || item.tempId || `msg_${index}`;
          return `${baseKey}_${item.createdAt}_${index}`;
        }}
        inverted
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: false }
        )}
        ListFooterComponent={loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
          </View>
        ) : null}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <View style={[
          styles.inputContainer,
          {
            backgroundColor: isDark ? '#1C1C1E' : '#FFFFFF',
            borderTopColor: isDark ? '#2C2C2E' : '#E5E5EA',
            paddingBottom: insets.bottom || 8
          }
        ]}>
          <TouchableOpacity
            onPress={handlePickImage}
            style={styles.iconButton}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={theme.colors.primary} />
            ) : (
              <Ionicons name="image-outline" size={26} color={theme.colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setGifModalVisible(true)}
            style={styles.iconButton}
          >
            <Ionicons name="gift-outline" size={26} color={theme.colors.primary} />
          </TouchableOpacity>

          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: isDark ? '#2C2C2E' : '#F2F2F7',
                color: theme.colors.text
              }
            ]}
            placeholder="Message..."
            placeholderTextColor={isDark ? '#8E8E93' : '#8E8E93'}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={2000}
          />

          {inputText.trim() ? (
            <TouchableOpacity
              onPress={() => sendMessage(inputText, 'text')}
              style={[styles.sendButton, { backgroundColor: theme.colors.primary }]}
            >
              <Ionicons name="send" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity style={styles.iconButton}>
              <Ionicons name="mic-outline" size={26} color={theme.colors.primary} />
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAvoidingView>

      {/* GIF Picker Modal */}
      <GifPickerModal
        visible={gifModalVisible}
        onClose={() => setGifModalVisible(false)}
        onSelectGif={handleGifSelect}
      />

      {/* Full Screen Image Modal */}
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
            <Ionicons name="close" size={32} color="#FFFFFF" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 4,
    marginRight: 4,
  },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  headerName: {
    fontSize: 17,
    fontWeight: '600',
  },
  typingText: {
    fontSize: 13,
    color: '#4FC3F7',
    marginTop: 2,
  },
  headerAction: {
    padding: 8,
  },
  messagesList: {
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  loadingContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  messageContainer: {
    marginBottom: 4,
    maxWidth: '80%',
  },
  messageMe: {
    alignSelf: 'flex-end',
  },
  messageThem: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
  },
  bubbleMe: {
    borderBottomRightRadius: 4,
  },
  bubbleThem: {
    borderBottomLeftRadius: 4,
  },
  bubbleMeLast: {
    borderBottomRightRadius: 20,
  },
  bubbleThemLast: {
    borderBottomLeftRadius: 20,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 20,
  },
  messageTextMe: {
    color: '#FFFFFF',
  },
  textFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  timeText: {
    fontSize: 11,
  },
  timeTextMe: {
    color: 'rgba(255,255,255,0.7)',
  },
  statusContainer: {
    marginLeft: 2,
  },
  imageBubble: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  messageImage: {
    borderRadius: 16,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  timeTextImage: {
    fontSize: 11,
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 8,
    borderTopWidth: 0.5,
  },
  iconButton: {
    padding: 6,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginHorizontal: 8,
    maxHeight: 100,
    fontSize: 16,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
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