// src/types/error.ts
import type { ErrorCode } from '../utils/errorCodes';

export interface ErrorMessage {
    code: ErrorCode;
    message: string;
    level: 'error' | 'warning' | 'info';
    timestamp: number;
    details?: any;
    // 添加堆栈信息，方便调试
    stack?: string;
}

export interface ErrorHandlerOptions {
    showNotification: boolean;
    retry?: boolean;
    retryCount?: number;
    retryDelay?: number;
    // 添加自定义处理函数
    onRetry?: (error: ErrorMessage, retryCount: number) => void;
    onError?: (error: ErrorMessage) => void;
}

// 定义重试策略
export interface RetryStrategy {
    maxAttempts: number;
    baseDelay: number;
    maxDelay: number;
}

export type ErrorHandler = (error: ErrorMessage, options?: ErrorHandlerOptions) => void;