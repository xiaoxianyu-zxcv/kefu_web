import { Client, IFrame, StompSubscription } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import { ref } from 'vue';
import { ErrorHandlerService } from '../services/errorHandler';
import { MessageQueueManager } from './MessageQueueManager';
import { ErrorCodes } from './errorCodes';

export class WebSocketManager {
    private client: Client | null = null;
    private errorHandler: ErrorHandlerService;
    private messageQueue: MessageQueueManager;
    private _isConnected = ref(false);
    private _isConnecting = ref(false);
    private subscriptions: Map<string, StompSubscription> = new Map();
    private messageHandlers: Map<string, (message: IFrame) => void> = new Map();

    constructor(private readonly serverUrl: string) {
        this.errorHandler = ErrorHandlerService.getInstance();
        this.messageQueue = MessageQueueManager.getInstance();

        // 输出初始配置信息
        console.info('[WebSocket] 初始化配置:', {
            serverUrl,
            reconnectDelay: 5000,
            heartbeatIncoming: 4000,
            heartbeatOutgoing: 4000
        });
    }

    // 状态获取器
    public get isConnected() { return this._isConnected; }
    public get isConnecting() { return this._isConnecting; }
    public get queueStats() { return this.messageQueue.stats; }

    public async connect(): Promise<void> {
        if (this._isConnected.value || this._isConnecting.value) return;

        try {
            this._isConnecting.value = true;

            this.client = new Client({
                webSocketFactory: () => new SockJS(this.serverUrl),

                // 连接相关配置
                connectHeaders: {},
                disconnectHeaders: {},
                reconnectDelay: 5000,
                heartbeatIncoming: 4000,
                heartbeatOutgoing: 4000,

                // 事件处理器
                onConnect: this.handleConnect.bind(this),
                onDisconnect: this.handleDisconnect.bind(this),
                onStompError: this.handleStompError.bind(this),
                onWebSocketError: this.handleWebSocketError.bind(this),
                onWebSocketClose: this.handleWebSocketClose.bind(this),

                // 调试模式
                debug: (str) => console.debug('[STOMP Debug]', str)
            });

            await this.client.activate();

        } catch (error) {
            this.handleConnectionError(error);
        }
    }

    private handleConnect(frame: IFrame): void {
        console.info('[WebSocket] 连接成功建立');

        this._isConnected.value = true;
        this._isConnecting.value = false;

        // 重新建立所有订阅
        this.reestablishSubscriptions();

        // 重置失败的消息
        this.messageQueue.resetFailedMessages();

        // 处理可能在断线期间积累的待发送消息
        this.processPendingMessages();
    }

    private handleDisconnect(frame: IFrame): void {
        console.warn('[WebSocket] 连接断开');
        this._isConnected.value = false;
        this._isConnecting.value = false;
    }

    private handleStompError(frame: IFrame): void {
        console.error('[WebSocket] STOMP协议错误:', frame.body);
        this.errorHandler.handleError({
            code: ErrorCodes.WS_SEND_ERROR,
            message: `STOMP协议错误: ${frame.body}`,
            level: 'error',
            timestamp: Date.now(),
            details: frame
        });
    }

    private handleWebSocketError(event: Event): void {
        console.error('[WebSocket] WebSocket错误:', event);
        this.errorHandler.handleError({
            code: ErrorCodes.WS_CONNECTION_ERROR,
            message: 'WebSocket连接错误',
            level: 'error',
            timestamp: Date.now(),
            details: event
        });
    }

    private handleWebSocketClose(event: CloseEvent): void {
        console.warn('[WebSocket] WebSocket关闭:', event);
        this._isConnected.value = false;
    }

    private handleConnectionError(error: any): void {
        this._isConnecting.value = false;
        this._isConnected.value = false;

        this.errorHandler.handleError({
            code: ErrorCodes.WS_CONNECTION_ERROR,
            message: '建立WebSocket连接失败',
            level: 'error',
            timestamp: Date.now(),
            details: error
        });
    }

    public send(destination: string, body: any): string {
        const messageId = this.messageQueue.enqueue(destination, body);

        if (this._isConnected.value && this.client?.connected) {
            this.sendQueuedMessage(messageId);
        }

        return messageId;
    }

    private async sendQueuedMessage(messageId: string): Promise<void> {
        const message = this.messageQueue.getMessageStatus(messageId);
        if (!message || message.status !== 'pending') return;

        try {
            await this.messageQueue.processMessage(messageId, async (destination, body) => {
                if (!this.client?.connected) {
                    throw new Error('WebSocket未连接');
                }

                this.client.publish({
                    destination,
                    body: JSON.stringify(body),
                    headers: { 'message-id': messageId }
                });
            });
        } catch (error) {
            console.error('[WebSocket] 发送消息失败:', error);
        }
    }

    private async processPendingMessages(): Promise<void> {
        const messages = this.messageQueue.getPendingMessages();
        for (const messageId of messages) {
            await this.sendQueuedMessage(messageId);
        }
    }

    public subscribe(topic: string, callback: (message: IFrame) => void): void {
        this.messageHandlers.set(topic, callback);

        if (this.client?.connected) {
            this.createSubscription(topic, callback);
        }
    }

    private createSubscription(topic: string, callback: (message: IFrame) => void): void {
        const subscription = this.client!.subscribe(topic, (message) => {
            const messageId = message.headers['message-id'];
            if (messageId) {
                this.messageQueue.markMessageReceived(messageId);
            }
            callback(message);
        });

        this.subscriptions.set(topic, subscription);
    }

    private reestablishSubscriptions(): void {
        this.messageHandlers.forEach((callback, topic) => {
            this.createSubscription(topic, callback);
        });
    }

    public disconnect(): void {
        this.subscriptions.forEach(subscription => subscription.unsubscribe());
        this.subscriptions.clear();
        this.messageHandlers.clear();
        this.client?.deactivate();
        this._isConnected.value = false;
        this._isConnecting.value = false;
    }

    public getMessageStatus(messageId: string) {
        return this.messageQueue.getMessageStatus(messageId);
    }
}