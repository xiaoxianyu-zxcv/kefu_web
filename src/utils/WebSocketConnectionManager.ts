import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ref } from 'vue';
import { ErrorHandlerService } from '../services/errorHandler';
import { MessageQueueManager } from './MessageQueueManager';
import { ErrorCodes } from './errorCodes';
import type { ErrorMessage } from '../types/error';

export class WebSocketManager {
    private client: Client | null = null;
    private reconnectAttempts = 0;
    private readonly maxReconnectAttempts = 5;
    private readonly initialDelay = 1000;
    private readonly maxDelay = 30000;
    private timerId: number | null = null;
    private errorHandler: ErrorHandlerService;
    private messageQueue: MessageQueueManager;
    private processingQueue = false;

    private _isConnected = ref(false);
    private _isConnecting = ref(false);
    private subscriptions: Map<string, () => void> = new Map();


    private isManualDisconnect = false;

    constructor(private readonly serverUrl: string) {
        this.errorHandler = ErrorHandlerService.getInstance();
        this.messageQueue = MessageQueueManager.getInstance();
    }

    public get isConnected() {
        return this._isConnected;
    }

    public get isConnecting() {
        return this._isConnecting;
    }

    public async connect(): Promise<void> {
        this.isManualDisconnect = false;

        if (this._isConnecting.value || this._isConnected.value) {
            return;
        }

        this._isConnecting.value = true;

        try {
            const socket = new SockJS(this.serverUrl);
            this.client = new Client({
                webSocketFactory: () => socket,
                onConnect: this.handleConnect.bind(this),
                onStompError: this.handleError.bind(this),
                onDisconnect: this.handleDisconnect.bind(this),

                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,
                debug: function(str) {
                    console.log('STOMP: ' + str);
                }

            });

            await this.client.activate();
        } catch (error) {
            const errorMessage: ErrorMessage = {
                code: ErrorCodes.WS_CONNECTION_ERROR,
                message: '连接服务器失败，正在尝试重新连接',
                level: 'error',
                timestamp: Date.now(),
                details: error
            };

            this.errorHandler.handleError(errorMessage, {
                showNotification: true,
                retry: true,
                retryCount: this.maxReconnectAttempts,
                onRetry: () => this.connect()
            });
        }
    }

    private handleDisconnect = (): void => {
        this._isConnected.value = false;
        this._isConnecting.value = false;

        // 只有在非主动断开的情况下才进行重连
        if (!this.isManualDisconnect) {
            this.errorHandler.handleError({
                code: ErrorCodes.WS_CONNECTION_CLOSED,
                message: '连接已断开，正在尝试重新连接',
                level: 'warning',
                timestamp: Date.now()
            }, {
                showNotification: true,
                retry: true,
                retryCount: this.maxReconnectAttempts,
                onRetry: () => this.scheduleReconnect()
            });
        }
    }

    private handleConnect(): void {
        console.log('[WebSocket] 连接成功');
        this._isConnected.value = true;
        this._isConnecting.value = false;
        this.reconnectAttempts = 0;

        // 重新订阅之前的主题
        this.resubscribe();

        // 开始处理消息队列
        this.processMessageQueue();
    }

    private async processMessageQueue(): Promise<void> {
        if (this.processingQueue || !this._isConnected.value) return;

        this.processingQueue = true;

        try {
            // 遍历消息队列中的所有消息
            for (const [messageId, message] of this.messageQueue.getMessages()) {
                if (message.status === 'pending') {
                    await this.messageQueue.processMessage(messageId, async (destination, body) => {
                        if (!this.client?.connected) {
                            throw new Error('WebSocket未连接');
                        }

                        await this.sendMessageToServer(destination, body, messageId);
                    });
                }
            }
        } catch (error) {
            console.error('处理消息队列时出错:', error);
        } finally {
            this.processingQueue = false;

            // 如果队列中还有待处理的消息，继续处理
            const pendingMessages = this.messageQueue.stats.value.pending;
            if (pendingMessages > 0) {
                setTimeout(() => this.processMessageQueue(), 100);
            }
        }
    }


    private sendMessageToServer(destination: string, body: any, messageId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.client!.publish({
                    destination,
                    body: JSON.stringify(body),
                    headers: { 'message-id': messageId }
                });
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    public send(destination: string, body: any): string {
        // 将消息加入队列并获取消息ID
        const messageId = this.messageQueue.enqueue(destination, body);

        // 如果已连接，立即开始处理消息队列
        if (this._isConnected.value && !this.processingQueue) {
            this.processMessageQueue();
        }

        return messageId;
    }

    public subscribe(topic: string, callback: (message: any) => void): void {
        if (!this.client?.connected) {
            this.subscriptions.set(topic, () => this.subscribe(topic, callback));
            return;
        }

        try {
            const subscription = this.client.subscribe(topic, (message) => {
                try {
                    const messageId = message.headers['message-id'];
                    if (messageId) {
                        // 更新消息状态
                        this.messageQueue.markMessageReceived(messageId);
                    }
                    callback(message);
                } catch (error) {
                    this.errorHandler.handleError({
                        code: ErrorCodes.MESSAGE_TYPE_INVALID,
                        message: '消息处理失败',
                        level: 'error',
                        timestamp: Date.now(),
                        details: error
                    });
                }
            });

            this.subscriptions.set(topic, () => {
                subscription.unsubscribe();
                this.subscribe(topic, callback);
            });
        } catch (error) {
            this.errorHandler.handleError({
                code: ErrorCodes.WS_SEND_ERROR,
                message: '订阅主题失败',
                level: 'error',
                timestamp: Date.now(),
                details: error
            });
        }
    }

    private resubscribe(): void {
        this.subscriptions.forEach((subscribe) => {
            subscribe();
        });
    }

    private handleError(frame: any): void {
        this.errorHandler.handleError({
            code: ErrorCodes.WS_SEND_ERROR,
            message: 'WebSocket连接错误',
            level: 'error',
            timestamp: Date.now(),
            details: frame
        });
    }

    public disconnect(): void {
        this.isManualDisconnect = true;
        if (this.timerId) {
            window.clearTimeout(this.timerId);
        }
        this.client?.deactivate();
        this.subscriptions.clear();
        this._isConnected.value = false;
        this._isConnecting.value = false;
    }

    // 获取消息状态
    public getMessageStatus(messageId: string) {
        return this.messageQueue.getMessageStatus(messageId);
    }

    // 获取队列统计信息
    public get queueStats() {
        return this.messageQueue.stats;
    }
}