
export class WebSocketManager {
    private ws: WebSocket | null = null;          // WebSocket实例
    private readonly url: string;                 // 连接地址
    private reconnectCount: number = 0;           // 重连次数
    private readonly maxReconnectCount: number = 5; // 最大重连次数
    private readonly reconnectInterval: number = 3000; // 重连间隔(ms)
    private timer: NodeJS.Timeout | null = null;  // 心跳定时器
    
    // 消息处理函数集合
    private messageHandlers: ((data: any) => void)[] = [];
    
    constructor(url: string) {
      this.url = url;
    }
    
    // 连接WebSocket
    public connect(): void {
      try {
        this.ws = new WebSocket(this.url);
        this.initWebSocket();
      } catch (error) {
        console.error('WebSocket连接失败:', error);
        this.reconnect();
      }
    }
    
    // 初始化WebSocket事件
    private initWebSocket(): void {
      if (!this.ws) return;
      
      // 连接成功
      this.ws.onopen = () => {
        console.log('WebSocket连接成功');
        this.reconnectCount = 0;
        this.startHeartbeat(); // 开始心跳
      }
      
      // 接收消息
      this.ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // 如果是心跳响应，不做处理
        if (data.type === 'heartbeat') return;
        // 触发所有消息处理函数
        this.messageHandlers.forEach(handler => handler(data));
      }
      
      // 连接关闭
      this.ws.onclose = () => {
        console.log('WebSocket连接关闭');
        this.stopHeartbeat();
        this.reconnect();
      }
      
      // 连接错误
      this.ws.onerror = (error) => {
        console.error('WebSocket错误:', error);
        this.stopHeartbeat();
        this.reconnect();
      }
    }
    
    // 重连机制
    private reconnect(): void {
      if (this.reconnectCount >= this.maxReconnectCount) {
        console.error('WebSocket重连次数超过最大限制');
        return;
      }
      
      setTimeout(() => {
        console.log(`第${this.reconnectCount + 1}次重连`);
        this.reconnectCount++;
        this.connect();
      }, this.reconnectInterval);
    }
    
    // 开始心跳
    private startHeartbeat(): void {
      this.timer = setInterval(() => {
        this.sendMessage({ type: 'heartbeat' });
      }, 30000); // 每30秒发送一次心跳
    }
    
    // 停止心跳
    private stopHeartbeat(): void {
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    }
    
    // 发送消息
    public sendMessage(data: any): void {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(data));
      } else {
        console.error('WebSocket未连接');
      }
    }
    
    // 添加消息处理函数
    public onMessage(handler: (data: any) => void): void {
      this.messageHandlers.push(handler);
    }
    
    // 移除消息处理函数
    public offMessage(handler: (data: any) => void): void {
      this.messageHandlers = this.messageHandlers.filter(h => h !== handler);
    }
    
    // 关闭连接
    public close(): void {
      this.ws?.close();
      this.stopHeartbeat();
    }
  }