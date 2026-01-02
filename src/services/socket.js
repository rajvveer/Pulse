import { io } from 'socket.io-client';
import Constants from 'expo-constants';

const API_URL = Constants.expoConfig?.extra?.apiUrl || 'http://192.168.1.8:3000'; 

let socket = null;

class SocketService {
  connect(token) {
    if (socket?.connected) return;

    socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: 5,
    });

    socket.on('connect', () => console.log('✅ Connected to Socket.io:', socket.id));
    socket.on('disconnect', (reason) => console.log('⚠️ Socket disconnected:', reason));
  }

  disconnect() {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  }

  joinConversation(conversationId) {
    if (socket) socket.emit('join_conversation', conversationId);
  }

  leaveConversation(conversationId) {
    if (socket) socket.emit('leave_conversation', conversationId);
  }

  // ✅ UPDATED: Now accepts a 'callback'
  sendMessage(payload, callback) {
    if (socket) {
        socket.emit('send_message', payload, callback);
    }
  }

  onNewMessage(callback) {
    if (socket) socket.on('new_message', callback);
  }

  onTyping(callback) {
    if (socket) socket.on('user_typing', callback);
  }

  startTyping(conversationId) {
    if (socket) socket.emit('typing_start', { conversationId });
  }

  stopTyping(conversationId) {
    if (socket) socket.emit('typing_stop', { conversationId });
  }

  removeListener(eventName) {
    if (socket) socket.off(eventName);
  }
  
  // Expose the socket instance getter
  get socket() {
    return socket;
  }
}

export default new SocketService();