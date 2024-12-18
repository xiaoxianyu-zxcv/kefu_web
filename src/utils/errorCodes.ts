// src/utils/errorCodes.ts
import {ErrorMessage} from "../types/error";

export const ErrorCodes = {
    // WebSocket相关错误
    WS_CONNECTION_ERROR: 'WS001',
    WS_SEND_ERROR: 'WS002',
    WS_RECONNECT_FAILED: 'WS003',
    WS_CONNECTION_CLOSED: 'WS004',

    // 消息相关错误
    MESSAGE_EMPTY: 'MSG001',
    MESSAGE_SEND_FAILED: 'MSG002',
    MESSAGE_TYPE_INVALID: 'MSG003',

    // 文件上传相关错误
    UPLOAD_SIZE_EXCEED: 'UP001',
    UPLOAD_TYPE_INVALID: 'UP002',
    UPLOAD_NETWORK_ERROR: 'UP003',
    UPLOAD_SERVER_ERROR: 'UP004',

    // 用户交互相关错误
    USER_NOT_SELECTED: 'USR001',
    USER_OFFLINE: 'USR002',
    USER_INVALID: 'USR003'
} as const;

export const ErrorMessages = {
    [ErrorCodes.WS_CONNECTION_ERROR]: '连接服务器失败，请检查网络连接',
    [ErrorCodes.WS_SEND_ERROR]: '消息发送失败，请重试',
    [ErrorCodes.WS_RECONNECT_FAILED]: '重新连接失败，请刷新页面',
    [ErrorCodes.WS_CONNECTION_CLOSED]: '连接已断开，正在尝试重新连接',

    [ErrorCodes.MESSAGE_EMPTY]: '消息不能为空',
    [ErrorCodes.MESSAGE_SEND_FAILED]: '消息发送失败，请重试',
    [ErrorCodes.MESSAGE_TYPE_INVALID]: '不支持的消息类型',

    [ErrorCodes.UPLOAD_SIZE_EXCEED]: '文件大小超出限制',
    [ErrorCodes.UPLOAD_TYPE_INVALID]: '不支持的文件类型',
    [ErrorCodes.UPLOAD_NETWORK_ERROR]: '文件上传失败，请检查网络连接',
    [ErrorCodes.UPLOAD_SERVER_ERROR]: '服务器处理文件失败，请重试',

    [ErrorCodes.USER_NOT_SELECTED]: '请先选择客户',
    [ErrorCodes.USER_OFFLINE]: '用户已离线',
    [ErrorCodes.USER_INVALID]: '无效的用户信息'
} as const;

// 新增错误处理策略接口
interface ErrorStrategy {
    handle(error: ErrorMessage): void;
}

// 网络错误处理策略
class NetworkErrorStrategy implements ErrorStrategy {
    handle(error: ErrorMessage) {
        // 网络错误特定处理逻辑
        // 例如：自动重试、检查网络状态等
    }
}

// 业务错误处理策略
class BusinessErrorStrategy implements ErrorStrategy {
    handle(error: ErrorMessage) {
        // 业务错误特定处理逻辑
        // 例如：显示错误消息、记录日志等
    }
}


export type ErrorCode = keyof typeof ErrorCodes;
export type ErrorKey = keyof typeof ErrorMessages;