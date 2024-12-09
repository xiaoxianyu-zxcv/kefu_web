// src/types/websocketTypes.ts

// WebSocket消息基础类型
export interface WSBaseMessage {
  type: MessageType;
  timestamp: number;
}

// 消息类型枚举
export enum MessageType {
  CHAT = 'chat',           // 聊天消息
  SYSTEM = 'system',       // 系统消息
  STATUS = 'status',       // 状态变更
  HEARTBEAT = 'HEARTBEAT', // 心跳消息
}

// 聊天消息
export interface ChatMessage extends WSBaseMessage {
  type: MessageType.CHAT;
  id: string;
  sessionId: string;
  senderId: string;
  content: string;
  contentType: 'text' | 'image' | 'file';
  isSelf: boolean;
  avatar: string;
}

// 系统消息
export interface SystemMessage extends WSBaseMessage {
  type: MessageType.SYSTEM;
  content: string;
  level: 'info' | 'warning' | 'error';
}

// 状态变更消息
export interface StatusMessage extends WSBaseMessage {
  type: MessageType.STATUS;
  userId: string;
  status: 'online' | 'offline' | 'busy';
}

// 心跳消息
export interface HeartbeatMessage extends WSBaseMessage {
  type: MessageType.HEARTBEAT;
}

// 所有消息类型的联合类型
export type WebSocketMessage = 
  | ChatMessage 
  | SystemMessage 
  | StatusMessage 
  | HeartbeatMessage;