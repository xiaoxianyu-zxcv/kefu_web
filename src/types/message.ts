// src/types/message.ts
export interface Message {
    id: string;
    fromUser: string;
    toUser: string;
    role: 'user' | 'kefu';
    content: string;
    timestamp: number;
    messageType: 'text' | 'image' | 'file';
    status: 'pending' | 'sending' | 'sent' | 'failed';
    // 可选属性，用于前端展示
    fromCustomer?: boolean;
}