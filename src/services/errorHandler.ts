// src/services/errorHandler.ts
import { ElMessage } from 'element-plus'
import type { ErrorMessage, ErrorHandlerOptions, RetryStrategy } from '../types/error'
import { ErrorMessages, ErrorCodes } from '../utils/errorCodes'

export class ErrorHandlerService {
    private static instance: ErrorHandlerService
    private errorLog: ErrorMessage[] = []
    private retryStrategy: RetryStrategy = {
        maxAttempts: 3,
        baseDelay: 1000,
        maxDelay: 30000
    }

    private constructor() {
        // 私有构造函数，确保单例模式
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleError({
                code: ErrorCodes.WS_CONNECTION_ERROR as "WS_CONNECTION_ERROR",
                message: String(message),
                level: 'error',
                timestamp: Date.now(),
                stack: error?.stack
            })
        }
    }

    public static getInstance(): ErrorHandlerService {
        if (!ErrorHandlerService.instance) {
            ErrorHandlerService.instance = new ErrorHandlerService()
        }
        return ErrorHandlerService.instance
    }

    public handleError(error: ErrorMessage, options: ErrorHandlerOptions = { showNotification: true }): void {
        // 记录错误
        this.logError(error)

        // 显示通知
        if (options.showNotification) {
            this.showNotification(error)
        }

        // 执行自定义错误处理
        if (options.onError) {
            options.onError(error)
        }

        // 如果需要重试
        if (options.retry) {
            this.handleRetry(error, options)
        }
    }

    private logError(error: ErrorMessage): void {
        console.error(`[${error.code}] ${error.message}`, {
            timestamp: new Date(error.timestamp).toISOString(),
            level: error.level,
            details: error.details,
            stack: error.stack
        })

        this.errorLog.push(error)

        // 保持错误日志在合理范围内
        if (this.errorLog.length > 100) {
            this.errorLog.shift()
        }
    }

    private showNotification(error: ErrorMessage): void {
        ElMessage({
            type: error.level === 'error' ? 'error' :
                error.level === 'warning' ? 'warning' : 'info',
            message: error.message,
            duration: 3000,
            showClose: true
        })
    }

    private async handleRetry(error: ErrorMessage, options: ErrorHandlerOptions): Promise<void> {
        const maxAttempts = options.retryCount || this.retryStrategy.maxAttempts
        let currentAttempt = 0

        const retry = async () => {
            try {
                currentAttempt++

                // 通知重试回调
                if (options.onRetry) {
                    await options.onRetry(error, currentAttempt)
                }

                // 重试成功
                console.log(`[Retry Success] ${error.code} after ${currentAttempt} attempts`)
            } catch (e) {
                const delay = Math.min(
                    this.retryStrategy.baseDelay * Math.pow(2, currentAttempt),
                    this.retryStrategy.maxDelay
                )

                if (currentAttempt < maxAttempts) {
                    console.log(`[Retry Attempt ${currentAttempt}/${maxAttempts}] Retrying in ${delay}ms`)
                    setTimeout(retry, delay)
                } else {
                    this.handleError({
                        ...error,
                        message: `${error.message} (重试${maxAttempts}次后失败)`,
                        timestamp: Date.now()
                    })
                }
            }
        }

        await retry()
    }

    // 获取错误日志
    public getErrorLog(): ErrorMessage[] {
        return [...this.errorLog]
    }

    // 清除错误日志
    public clearErrorLog(): void {
        this.errorLog = []
    }

    // 更新重试策略
    public updateRetryStrategy(strategy: Partial<RetryStrategy>): void {
        this.retryStrategy = {
            ...this.retryStrategy,
            ...strategy
        }
    }
}