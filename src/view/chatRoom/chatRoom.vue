<template>
  <el-container class="chat-room-container" style="height: 100%; border: 1px solid #dcdcdc;">
    <el-aside width="200px" style="border-right: 1px solid #ebebeb;">
      <div class="customer-list">
        <el-input
            v-model="searchKeyword"
            placeholder="搜索客户"
            clearable
            @input="handleSearchInput"
        />
        <el-scrollbar style="height: calc(100% - 50px);">
          <el-menu
              :default-active="selectedCustomerId"
              @select="handleSelectCustomer"
              style="border:none;"
          >
            <el-menu-item
                v-for="customer in filteredCustomers"
                :key="customer.id"
                :index="customer.id"
            >
              <el-badge :is-dot="hasUnreadMessage(customer.id)">
                {{ customer.name }}
              </el-badge>
            </el-menu-item>
          </el-menu>
        </el-scrollbar>
      </div>
    </el-aside>

    <el-container>
      <el-header>
        <div class="chat-header">
          <div class="header-left">
            <span v-if="currentCustomer">
              {{ currentCustomer.name }} 的对话
              <el-tag size="small" :type="connectionStatusType">
                {{ connectionStatusText }}
              </el-tag>
            </span>
            <span v-else>请选择客户</span>
          </div>
          <!-- 新增：消息队列状态展示 -->
          <div class="header-right" v-if="currentCustomer">
            <el-tooltip placement="bottom">
              <template #content>
                <div>待发送: {{ queueStats.pending }}</div>
                <div>发送中: {{ queueStats.sending }}</div>
                <div>已发送: {{ queueStats.sent }}</div>
                <div>失败: {{ queueStats.failed }}</div>
              </template>
              <el-badge :value="queueStats.pending + queueStats.failed" :max="99" v-if="queueStats.pending + queueStats.failed > 0">
                <el-button size="small" :type="queueStats.failed > 0 ? 'danger' : 'warning'">
                  消息队列
                </el-button>
              </el-badge>
            </el-tooltip>
          </div>
        </div>
      </el-header>

      <el-main>
        <div ref="messagesContainer" class="messages-container" @scroll="handleScroll">
          <message-display
              v-for="message in messages"
              :key="message.id"
              :content="message.content"
              :from-customer="message.fromCustomer"
              :message-type="message.messageType"
              :sender="message.fromCustomer ? currentCustomer?.name : '客服'"
              :timestamp="message.timestamp"
              :status="message.status"
              @retry="handleMessageRetry(message)"
          />
        </div>
      </el-main>

      <el-footer>
        <div class="message-input-container">
          <el-input
              v-model="newMessage"
              placeholder="输入消息..."
              @keyup.enter="sendMessage"
              type="textarea"
              :rows="3"
              :maxlength="1000"
              show-word-limit
          >
            <template #append>
              <el-button-group>
                <el-button
                    type="primary"
                    :disabled="!isInputEnabled"
                    @click="sendMessage"
                >
                  发送
                </el-button>
                <el-upload
                    class="upload-button"
                    :action="uploadUrl"
                    :headers="headers"
                    :before-upload="handleBeforeUpload"
                    :on-success="handleUploadSuccess"
                    :on-error="handleUploadError"
                    :disabled="!isInputEnabled"
                    :show-file-list="false"
                >
                  <el-button :disabled="!isInputEnabled">
                    <el-icon><Upload /></el-icon>
                  </el-button>
                </el-upload>
              </el-button-group>
            </template>
          </el-input>
        </div>
      </el-footer>
    </el-container>

    <el-aside width="200px" style="border-left: 1px solid #ebebeb;">
      <div class="customer-info" style="padding:10px;">
        <h3>客户信息</h3>
        <div v-if="currentCustomer">
          <p><strong>姓名：</strong>{{ currentCustomer.name }}</p>
          <p><strong>ID：</strong>{{ currentCustomer.id }}</p>
          <p><strong>状态：</strong>{{ connectionStatusText }}</p>
        </div>
        <div v-else>
          <p>暂无客户信息</p>
        </div>
      </div>
    </el-aside>
  </el-container>
</template>

<script setup lang="ts">
import MessageDisplay from '../components/MessageDisplay.vue'
import {WebSocketManager} from '../../utils/WebSocketConnectionManager'
import {ErrorHandlerService} from '../../services/errorHandler'
import {ErrorCodes} from '../../utils/errorCodes'
import {computed, onMounted, onUnmounted, ref, watch ,nextTick} from 'vue';
import type {Message} from '../../types/message';
import {Upload} from '@element-plus/icons-vue';


// 初始化服务
const errorHandler = ErrorHandlerService.getInstance()
const wsManager = new WebSocketManager('http://localhost:8080/ws')

// 状态管理
const customers = ref([
  { id: 'c001', name: '张三' },
  { id: 'c002', name: '李四' },
  { id: 'c003', name: '王五' },
])

// 状态和引用
const messages = ref<Message[]>([]);
const newMessage = ref('');
const messagesContainer = ref<HTMLElement | null>(null);
const autoScroll = ref(true);
const selectedCustomerId = ref<string>('')
const searchKeyword = ref('')
const unreadMessages = ref<Set<string>>(new Set())

// 计算属性
const queueStats = computed(() => wsManager.queueStats.value);
const isInputEnabled = computed(() =>
    currentCustomer.value && wsManager.isConnected.value
);


// 计算属性
const filteredCustomers = computed(() => {
  const keyword = searchKeyword.value.trim().toLowerCase()
  if (!keyword) return customers.value
  return customers.value.filter(c =>
      c.name.toLowerCase().includes(keyword) ||
      c.id.toLowerCase().includes(keyword)
  )
})

const currentCustomer = computed(() => {
  return customers.value.find(c => c.id === selectedCustomerId.value) || null
})

const connectionStatusType = computed(() => {
  if (wsManager.isConnected.value) return 'success'
  if (wsManager.isConnecting.value) return 'warning'
  return 'danger'
})

const connectionStatusText = computed(() => {
  if (wsManager.isConnected.value) return '在线'
  if (wsManager.isConnecting.value) return '连接中'
  return '离线'
})

// 消息处理相关方法
async function handleSelectCustomer(customerId: string) {
  try {
    selectedCustomerId.value = customerId
    await loadCustomerMessages(customerId)
    subscribeToCustomerMessages(customerId)
    unreadMessages.value.delete(customerId)
  } catch (error) {
    errorHandler.handleError({
      code: ErrorCodes.USER_INVALID,
      message: '加载客户消息失败',
      level: 'error',
      timestamp: Date.now(),
      details: error
    })
  }
}

async function loadCustomerMessages(customerId: string) {
  try {
    const response = await fetch(`http://localhost:8080/api/messages?userId=${customerId}`, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    })

    if (!response.ok) throw new Error('Failed to fetch messages')

    const data = await response.json()
    messages.value = data.map(transformMessage)

    await nextTick()
    scrollToBottom()
  } catch (error) {
    throw error
  }
}

function transformMessage(msg: any) {
  console.log('消息:', msg)
  return {
    content: msg.content,
    fromCustomer: msg.role === 'user',
    messageType: msg.messageType || 'text',
    timestamp: msg.timestamp
  }
}

function subscribeToCustomerMessages(customerId: string) {
  wsManager.subscribe(`/topic/kefu/${customerId}`, (message) => {
    try {
      const payload = JSON.parse(message.body)
      messages.value.push(transformMessage(payload))

      if (payload.fromCustomer && selectedCustomerId.value !== customerId) {
        unreadMessages.value.add(customerId)
      }

      if (autoScroll.value) {
        nextTick(() => scrollToBottom())
      }
    } catch (error) {
      errorHandler.handleError({
        code: ErrorCodes.MESSAGE_TYPE_INVALID,
        message: '消息格式错误',
        level: 'error',
        timestamp: Date.now(),
        details: error
      })
    }
  })
}

// 消息发送处理
async function sendMessage() {
  if (!validateMessage()) return;

  const messageData = {
    // id: crypto.randomUUID(),
    fromUser: 'kefu1',
    toUser: currentCustomer.value!.id,
    role: 'kefu',
    content: newMessage.value,
    timestamp: Date.now(),
    messageType: 'text',
    status: 'pending'
  };

  console.log('发送消息:', messageData);
  try {
    // 发送消息并获取消息ID
    const messageId = wsManager.send('/app/kefuSend', messageData);

    console.log('消息ID:', messageId);
    // 添加到本地消息列表
    messages.value.push({
      ...messageData,
      id: messageId,
    });

    newMessage.value = '';
    autoScroll.value = true;

    // 监听消息状态变化
    watchMessageStatus(messageId);
  } catch (error) {
    errorHandler.handleError({
      code: ErrorCodes.MESSAGE_SEND_FAILED,
      message: '消息发送失败',
      level: 'error',
      timestamp: Date.now(),
      details: error
    });
  }
}


// 监听消息状态
function watchMessageStatus(messageId: string) {
  const checkStatus = () => {
    const status = wsManager.getMessageStatus(messageId);
    if (status) {
      const index = messages.value.findIndex(m => m.id === messageId);
      if (index !== -1) {
        messages.value[index].status = status.status;
      }

      if (status.status === 'sent' || status.status === 'failed') {
        return;
      }
      setTimeout(checkStatus, 1000);
    }
  };

  checkStatus();
}


// 消息重试处理
function handleMessageRetry(message: Message) {
  if (message.status === 'failed') {
    const messageId = wsManager.send('/app/kefuSend', {
      ...message,
      timestamp: Date.now(),
      status: 'pending'
    });

    // 更新消息ID和状态
    const index = messages.value.findIndex(m => m.id === message.id);
    if (index !== -1) {
      messages.value[index].id = messageId;
      messages.value[index].status = 'pending';
      watchMessageStatus(messageId);
    }
  }
}


// 文件上传处理
const uploadUrl = 'http://localhost:8080/api/upload'
const headers = { 'Accept': 'application/json' }

function handleBeforeUpload(file: File) {
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isLt5M) {
    errorHandler.handleError({
      code: ErrorCodes.UPLOAD_SIZE_EXCEED,
      message: '文件大小不能超过 5MB',
      level: 'warning',
      timestamp: Date.now()
    })
    return false
  }

  return true
}

function handleUploadSuccess(response: any, file: File) {

  console.log('上传响应:', response);
  console.log('文件对象:', file);
  const fileUrl = response.url
  if (!fileUrl || !currentCustomer.value) return

  const isImage = file.raw?.type?.startsWith('image/');
  const messageData = {
    fromUser: 'kefu1',
    toUser: currentCustomer.value.id,
    role: 'kefu',
    content: fileUrl,
    timestamp: Date.now(),
    messageType: isImage ? 'image' : 'file'
  }

  wsManager.send('/app/kefuSend', messageData)
}

function handleUploadError(error: any) {
  errorHandler.handleError({
    code: ErrorCodes.UPLOAD_SERVER_ERROR,
    message: '文件上传失败',
    level: 'error',
    timestamp: Date.now(),
    details: error
  })
}

// 辅助方法
function validateMessage() {
  if (!newMessage.value.trim()) {
    errorHandler.handleError({
      code: ErrorCodes.MESSAGE_EMPTY,
      message: '消息不能为空',
      level: 'warning',
      timestamp: Date.now()
    })
    return false
  }

  if (!currentCustomer.value) {
    errorHandler.handleError({
      code: ErrorCodes.USER_NOT_SELECTED,
      message: '请先选择客户',
      level: 'warning',
      timestamp: Date.now()
    })
    return false
  }

  return true
}

function scrollToBottom() {
  if (!messagesContainer.value) return
  messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}

function handleScroll(event: Event) {
  const target = event.target as HTMLElement
  autoScroll.value = target.scrollHeight - target.scrollTop <= target.clientHeight + 100
}

function hasUnreadMessage(customerId: string): boolean {
  return unreadMessages.value.has(customerId)
}

// 生命周期钩子
onMounted(() => {
  wsManager.connect();
});

onUnmounted(() => {
  wsManager.disconnect();
});

// 监听连接状态变化
watch(() => wsManager.isConnected.value, (newValue) => {
  if (newValue && selectedCustomerId.value) {
    subscribeToCustomerMessages(selectedCustomerId.value)
  }
})
</script>

<style scoped>
.chat-room-container {
  height: 80vh;
  width: 80vw;
}

.customer-list {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.messages-container {
  background: #f5f5f5;
  scroll-behavior: smooth;
}

.chat-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.message-input-container {
  display: flex;
  padding: 10px;
}

.messages-container {
  height: 100%;
  overflow-y: auto;
  padding: 10px;
}

.upload-button {
  display: inline-block;
}

/* 添加消息状态样式 */
.message-status {
  font-size: 12px;
  margin-left: 8px;
}

.status-pending {
  color: #909399;
}

.status-sending {
  color: #409eff;
}

.status-sent {
  color: #67c23a;
}

.status-failed {
  color: #f56c6c;
}
</style>