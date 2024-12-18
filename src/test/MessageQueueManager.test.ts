import { MessageQueueManager, QueuedMessage } from '../utils/MessageQueueManager';
// import { ErrorHandlerService } from '../services/errorHandler';


const mockErrorHandler = {
    handleError: jest.fn(),
};

jest.mock('../services/errorHandler', () => ({
    ErrorHandlerService: {
        getInstance: jest.fn(() => mockErrorHandler),
    },
}));
// mockErrorHandler.handleError = jest.fn();

describe('MessageQueueManager', () => {
    let queueManager: MessageQueueManager;

    beforeEach(() => {
        queueManager = MessageQueueManager.getInstance();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('enqueue adds a message to the queue', () => {
        const destination = '/test';
        const body = { content: 'Hello' };
        const messageId = queueManager.enqueue(destination, body);

        const message = queueManager.getMessageStatus(messageId);
        expect(message).toBeDefined();
        expect(message?.destination).toBe(destination);
        expect(message?.body).toEqual(body);
        expect(message?.status).toBe('pending');
        expect(queueManager.stats.value.pending).toBe(1);
    });

    test('processMessage transitions message states correctly', async () => {
        const destination = '/test';
        const body = { content: 'Test Message' };
        const messageId = queueManager.enqueue(destination, body);

        const mockSendFunction = jest.fn().mockResolvedValueOnce(undefined);

        await queueManager.processMessage(messageId, mockSendFunction);

        const message = queueManager.getMessageStatus(messageId);
        expect(mockSendFunction).toHaveBeenCalledWith(destination, body);
        expect(message?.status).toBe('sent');
        expect(queueManager.stats.value.sent).toBe(1);
    });

    test('processMessage retries on failure and respects maxRetries', async () => {
        const destination = '/test';
        const body = { content: 'Retry Test' };
        const messageId = queueManager.enqueue(destination, body);

        const mockSendFunction = jest.fn().mockRejectedValueOnce(new Error('Failed'));

        await queueManager.processMessage(messageId, mockSendFunction);

        const message = queueManager.getMessageStatus(messageId);
        expect(mockSendFunction).toHaveBeenCalledWith(destination, body);
        expect(message?.status).toBe('failed');
        expect(message?.retryCount).toBe(1);

        jest.advanceTimersByTime(1000);
        await queueManager.processMessage(messageId, mockSendFunction);

        expect(message?.retryCount).toBe(2);
        expect(queueManager.stats.value.failed).toBe(1);
    });

    test('initializePeriodicCleanup removes expired messages', () => {
        jest.useFakeTimers();
        const now = Date.now();
        jest.setSystemTime(now);

        const destination = '/test';
        const body = { content: 'Cleanup Test' };
        const sentMessageId = queueManager.enqueue(destination, body);
        const pendingMessageId = queueManager.enqueue(destination, body);

        const sentMessage = queueManager.getMessageStatus(sentMessageId);
        if (sentMessage) {
            sentMessage.status = 'sent';
            sentMessage.timestamp = now - 61000; // Mark as expired
        }

        const pendingMessage = queueManager.getMessageStatus(pendingMessageId);
        if (pendingMessage) {
            pendingMessage.status = 'pending';
            pendingMessage.timestamp = now - 310000; // Mark as expired
        }

        queueManager['initializePeriodicCleanup']();
        jest.advanceTimersByTime(300000);

        expect(queueManager.getMessageStatus(sentMessageId)).toBeUndefined();
        expect(queueManager.getMessageStatus(pendingMessageId)).toBeUndefined();
        expect(queueManager.stats.value.sent).toBe(0);
        expect(queueManager.stats.value.pending).toBe(0);

        jest.useRealTimers();
    });
});
