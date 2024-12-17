import { ref, computed } from 'vue'
import { ErrorHandlerService } from '../services/errorHandler'
import { ErrorCodes } from './errorCodes'
import type { ErrorMessage } from '../types/error'

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
    private static instance: MessageQueueManager
    private messageQueue: Map<string, QueuedMessage> = new Map()
    private readonly maxRetries = 3
    private readonly retryDelays = [1000, 5000, 15000] // 递增的重试延迟
    private readonly errorHandler: ErrorHandlerService

    // 消息状态统计
    private _stats = ref({
        pending: 0,
        sending: 0,
        sent: 0,
        failed: 0
    })

    private constructor() {
        this.errorHandler = ErrorHandlerService.getInstance()
        this.initializePeriodicCleanup()
    }

    public static getInstance(): MessageQueueManager {
        if (!MessageQueueManager.instance) {
            MessageQueueManager.instance = new MessageQueueManager()
        }
        return MessageQueueManager.instance
    }

    // 添加消息到队列
    public enqueue(destination: string, body: any): string {
        const id = this.generateMessageId()
        const message: QueuedMessage = {
            id,
            destination,
            body,
            status: 'pending',
            timestamp: Date.now(),
            retryCount: 0
        }

        this.messageQueue.set(id, message)
        this.updateStats()
        return id
    }

    // 处理消息发送
    public async processMessage(messageId: string, sendFunction: (destination: string, body: any) => Promise<void>): Promise<void> {
        const message = this.messageQueue.get(messageId)
        if (!message) return

        try {
            message.status = 'sending'
            this.updateStats()

            await sendFunction(message.destination, message.body)

            message.status = 'sent'
            this.updateStats()

            // 发送成功后延迟删除消息
            setTimeout(() => {
                this.messageQueue.delete(messageId)
                this.updateStats()
            }, 60000) // 保留1分钟用于状态查询

        } catch (error) {
            await this.handleMessageError(message, error)
        }
    }

    // 处理消息发送错误
    private async handleMessageError(message: QueuedMessage, error: any): Promise<void> {
        message.status = 'failed'
        message.retryCount++
        message.lastRetryTime = Date.now()

        if (message.retryCount < this.maxRetries) {
            const delay = this.retryDelays[message.retryCount - 1] || this.retryDelays[this.retryDelays.length - 1]

            this.errorHandler.handleError({
                code: ErrorCodes.MESSAGE_SEND_FAILED,
                message: `消息发送失败，${delay/1000}秒后重试(${message.retryCount}/${this.maxRetries})`,
                level: 'warning',
                timestamp: Date.now(),
                details: error
            })

            setTimeout(() => {
                message.status = 'pending'
                this.updateStats()
            }, delay)

        } else {
            this.errorHandler.handleError({
                code: ErrorCodes.MESSAGE_SEND_FAILED,
                message: '消息发送失败，已达到最大重试次数',
                level: 'error',
                timestamp: Date.now(),
                details: error
            })
        }

        this.updateStats()
    }

    // 获取消息状态
    public getMessageStatus(messageId: string): QueuedMessage | undefined {
        return this.messageQueue.get(messageId)
    }

    // 更新状态统计
    private updateStats(): void {
        const stats = {
            pending: 0,
            sending: 0,
            sent: 0,
            failed: 0
        }

        for (const message of this.messageQueue.values()) {
            stats[message.status]++
        }

        this._stats.value = stats
    }

    // 定期清理过期消息
    private initializePeriodicCleanup(): void {
        setInterval(() => {
            const now = Date.now()
            for (const [id, message] of this.messageQueue) {
                if (message.status === 'sent' && now - message.timestamp > 60000) {
                    this.messageQueue.delete(id)
                } else if (message.status === 'failed' && message.retryCount >= this.maxRetries) {
                    this.messageQueue.delete(id)
                }
            }
            this.updateStats()
        }, 300000) // 每5分钟清理一次
    }

    // 生成唯一消息ID
    private generateMessageId(): string {
        return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }

    // 获取队列统计信息
    public get stats() {
        return computed(() => this._stats.value)
    }
    public getMessages(): Map<string, QueuedMessage> {
        return this.messageQueue;
    }
}