import { io } from 'socket.io-client';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.9:3000'; 

let socket = null;

class SocketService {
  connect(token) {
    if (socket?.connected) {
      console.log('✅ Socket already connected');
      return;
    }

    console.log('🔌 Connecting to socket...');

    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    socket.on('connect', () => console.log('✅ Connected to Socket.io:', socket.id));
    socket.on('disconnect', (reason) => console.log('⚠️ Socket disconnected:', reason));
    socket.on('connect_error', (error) => console.error('❌ Connection error:', error.message));
  }

  disconnect() {
    if (socket) {
      console.log('👋 Disconnecting socket');
      socket.disconnect();
      socket = null;
    }
  }

  // ✅ GENERAL EMIT METHOD
  emit(event, data, callback) {
    if (!socket) {
      console.error('❌ Socket not initialized');
      return;
    }
    
    if (!socket.connected) {
      console.error('❌ Socket not connected');
      return;
    }

    console.log(`📤 Emitting: ${event}`, data);
    
    if (callback) {
      socket.emit(event, data, callback);
    } else {
      socket.emit(event, data);
    }
  }

  // ✅ GENERAL ON METHOD
  on(event, callback) {
    if (!socket) {
      console.error('❌ Socket not initialized for event:', event);
      return;
    }
    socket.on(event, callback);
  }

  // ✅ GENERAL OFF METHOD
  off(event, callback) {
    if (!socket) return;
    if (callback) {
      socket.off(event, callback);
    } else {
      socket.off(event);
    }
  }

  joinConversation(conversationId) {
    this.emit('join_conversation', { conversationId });
  }

  leaveConversation(conversationId) {
    this.emit('leave_conversation', { conversationId });
  }

  sendMessage(payload, callback) {
    this.emit('send_message', payload, callback);
  }

  onNewMessage(callback) {
    this.on('new_message', callback);
  }

  onTyping(callback) {
    this.on('user_typing', callback);
  }

  startTyping(conversationId) {
    this.emit('typing_start', { conversationId });
  }

  stopTyping(conversationId) {
    this.emit('typing_stop', { conversationId });
  }

  removeListener(eventName, callback) {
    this.off(eventName, callback);
  }
  
  // Expose the socket instance getter
  get socket() {
    return socket;
  }
}

export default new SocketService();
