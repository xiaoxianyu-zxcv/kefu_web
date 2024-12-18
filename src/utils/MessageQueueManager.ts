import { ref, computed } from 'vue';
import { ErrorHandlerService } from '../services/errorHandler';
import { ErrorCodes } from './errorCodes';

export interface QueuedMessage {
    id: string;
    destination: string;
    body: any;
    status: 'pending' | 'sending' | 'sent' | 'failed';
    timestamp: number;
    retryCount: number;
    lastRetryTime?: number;
}

export class MessageQueueManager {
    private static instance: MessageQueueManager;
    private messageQueue: Map<string, QueuedMessage> = new Map();
    private readonly maxRetries = 3;
    private readonly retryDelays = [1000, 5000, 15000];
    private readonly errorHandler: ErrorHandlerService;

    private _stats = ref({
        pending: 0,
        sending: 0,
        sent: 0,
        failed: 0
    });

    private constructor() {
        this.errorHandler = ErrorHandlerService.getInstance();
        this.initializePeriodicCleanup();
    }

    public static getInstance(): MessageQueueManager {
        if (!MessageQueueManager.instance) {
            MessageQueueManager.instance = new MessageQueueManager();
        }
        return MessageQueueManager.instance;
    }

    public enqueue(destination: string, body: any): string {
        const id = this.generateMessageId();
        const message: QueuedMessage = {
            id,
            destination,
            body,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0
        };

        this.messageQueue.set(id, message);
        this.updateStats();
        return id;
    }

    public async processMessage(
        messageId: string,
        sendFunction: (destination: string, body: any) => Promise<void>
    ): Promise<void> {
        const message = this.messageQueue.get(messageId);
        if (!message || message.status !== 'pending') return;

        try {
            message.status = 'sending';
            this.updateStats();

            await sendFunction(message.destination, message.body);

            message.status = 'sent';
            this.updateStats();

            // 成功发送后延迟删除消息
            this.scheduleMessageDeletion(messageId);

        } catch (error) {
            await this.handleMessageError(message, error);
        }
    }

    private async handleMessageError(message: QueuedMessage, error: any): Promise<void> {
        message.status = 'failed';
        message.retryCount++;
        message.lastRetryTime = Date.now();

        const shouldRetry = message.retryCount < this.maxRetries;
        const delay = shouldRetry ? this.retryDelays[message.retryCount - 1] : 0;

        this.errorHandler.handleError({
            code: ErrorCodes.MESSAGE_SEND_FAILED as "MESSAGE_SEND_FAILED", // 类型断言
            message: shouldRetry
                ? `Message failed, retrying in ${delay / 1000}s (${message.retryCount}/${this.maxRetries})`
                : 'Message failed, reached maximum retry attempts',
            level: shouldRetry ? 'warning' : 'error',
            timestamp: Date.now(),
            details: error
        });

        if (shouldRetry) {
            setTimeout(() => {
                message.status = 'pending';
                this.updateStats();
            }, delay);
        }

        this.updateStats();
    }

    private scheduleMessageDeletion(messageId: string): void {
        setTimeout(() => {
            this.messageQueue.delete(messageId);
            this.updateStats();
        }, 60000);
    }

    public getMessageStatus(messageId: string): QueuedMessage | undefined {
        return this.messageQueue.get(messageId);
    }

    private updateStats(): void {
        const stats = {
            pending: 0,
            sending: 0,
            sent: 0,
            failed: 0
        };

        for (const message of this.messageQueue.values()) {
            stats[message.status]++;
        }

        this._stats.value = stats;
    }

    private initializePeriodicCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            let hasChanges = false;

            for (const [id, message] of this.messageQueue) {
                if (this.shouldDeleteMessage(message, now)) {
                    this.messageQueue.delete(id);
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                this.updateStats();
            }
        }, 300000); // 每5分钟清理一次
    }

    private shouldDeleteMessage(message: QueuedMessage, now: number): boolean {
        return (
            (message.status === 'sent' && now - message.timestamp > 60000) ||
            (message.status === 'failed' && message.retryCount >= this.maxRetries)
        );
    }

    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    public get stats() {
        return computed(() => this._stats.value);
    }

    public resetFailedMessages(): void {
        let hasChanges = false;

        this.messageQueue.forEach(message => {
            if (message.status === 'failed') {
                message.status = 'pending';
                message.retryCount = 0;
                hasChanges = true;
            }
        });

        if (hasChanges) {
            this.updateStats();
        }
    }

    public markMessageReceived(messageId: string): void {
        const message = this.messageQueue.get(messageId);
        if (message && message.status !== 'sent') {
            message.status = 'sent';
            this.updateStats();
            this.scheduleMessageDeletion(messageId);
        }
    }

    public getPendingMessages(): string[] {
        return Array.from(this.messageQueue.entries())
            .filter(([_, message]) => message.status === 'pending')
            .map(([id]) => id);
    }


    // New sendMessage logic with queuing for offline mode
    public async sendMessage(destination: string, body: any, isConnected: boolean, sendFunction: (destination: string, body: any) => Promise<void>): Promise<void> {
        if (isConnected) {
            try {
                await sendFunction(destination, body);
            } catch (error) {
                console.error('[MessageQueue] Message failed to send, queuing it.');
                this.enqueue(destination, body);
            }
        } else {
            console.warn('[MessageQueue] WebSocket disconnected, queuing message.');
            this.enqueue(destination, body);
        }
    }

    // Optimization: Improved atomic updates for concurrency safety
    private atomicUpdate(messageId: string, updateFunction: (message: QueuedMessage) => void): void {
        const message = this.messageQueue.get(messageId);
        if (message) {
            updateFunction(message);
            this.updateStats();
        }
    }

    // Enhanced cleanup logic for better granularity
    private enhancedCleanup(now: number): void {
        for (const [id, message] of this.messageQueue) {
            if (
                (message.status === 'sent' && now - message.timestamp > 60000) ||
                (message.status === 'failed' && message.retryCount >= this.maxRetries) ||
                (message.status === 'pending' && now - message.timestamp > 300000) // Pending messages older than 5 minutes
            ) {
                this.messageQueue.delete(id);
            }
        }
        this.updateStats();
    }

    public enhancedPeriodicCleanup(): void {
        setInterval(() => {
            const now = Date.now();
            this.enhancedCleanup(now);
        }, 300000); // Every 5 minutes
    }
}
