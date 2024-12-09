<template>
  <el-container class="cs-container">
    <!-- 左侧会话列表 -->
    <el-aside width="300px" class="cs-sidebar">
      <el-container>
        <el-header height="70px" class="cs-header">
          <el-input
              v-model="searchQuery"
              placeholder="搜索会话"
              prefix-icon="Search"
          />
        </el-header>
        <el-main class="cs-session-list">
          <el-scrollbar>
            <el-card
                v-for="session in filteredSessions"
                :key="session.id"
                :class="['cs-session-item', { active: currentSession?.id === session.id }]"
                @click="switchSession(session)"
                shadow="hover"
                :body-style="{ padding: '10px' }"
            >
              <div class="cs-session-content">
                <el-avatar :src="session.avatar" />
                <div class="cs-session-info">
                  <div class="cs-session-name">{{ session.name }}</div>
                  <div class="cs-session-preview">{{ session.lastMessage }}</div>
                </div>
                <div class="cs-session-meta">
                  <div class="cs-session-time">{{ session.lastTime }}</div>
                  <el-badge
                      v-if="session.unread"
                      :value="session.unread"
                      class="cs-unread-badge"
                      type="danger"
                  />
                </div>
              </div>
            </el-card>
          </el-scrollbar>
        </el-main>
      </el-container>
    </el-aside>

    <!-- 中间聊天区域 -->
    <el-container class="cs-chat">
      <el-header v-if="currentSession" height="60px" class="cs-chat-header">
        <span>{{ currentSession.name }}</span>
        <el-tag size="small" type="success">在线</el-tag>
      </el-header>

      <el-main class="cs-chat-messages" ref="messageContainer">
        <el-scrollbar v-if="currentSession">
          <div
              v-for="msg in currentMessages"
              :key="msg.id"
              :class="['cs-message', { 'cs-message-self': msg.isSelf }]"
          >
            <el-avatar :src="msg.avatar" />
            <el-card class="cs-message-card" shadow="never">
              <div class="cs-message-text">{{ msg.content }}</div>
              <div class="cs-message-time">{{ msg.time }}</div>
            </el-card>
          </div>
        </el-scrollbar>
        <el-empty v-else description="请选择会话" />
      </el-main>

      <el-footer v-if="currentSession" height="150px" class="cs-chat-input">
        <el-card shadow="never">
          <el-space class="cs-toolbar">
            <el-button-group>
              <el-button :icon="Picture" />
              <el-button :icon="Files" />
              <el-button :icon="VideoCamera" />
            </el-button-group>
          </el-space>
          <el-input
              v-model="messageInput"
              type="textarea"
              rows="3"
              placeholder="输入消息..."
              @keyup.enter.prevent="sendMessage"
          />
          <div class="cs-send-bar">
            <el-button type="primary" @click="sendMessage">发送消息</el-button>
          </div>
        </el-card>
      </el-footer>
    </el-container>

    <!-- 右侧客户信息 -->
    <el-aside v-if="currentSession" width="300px" class="cs-info">
      <el-container>
        <el-header height="60px" class="cs-info-header">
          <span>客户信息</span>
        </el-header>
        <el-main class="cs-info-content">
          <el-scrollbar>
            <el-descriptions :column="1" border>
              <el-descriptions-item label="客户ID">
                {{ currentSession.customerId }}
              </el-descriptions-item>
              <el-descriptions-item label="注册时间">
                {{ currentSession.registerTime }}
              </el-descriptions-item>
              <el-descriptions-item label="最近登录">
                {{ currentSession.lastLoginTime }}
              </el-descriptions-item>
              <el-descriptions-item label="消费等级">
                <el-tag :type="currentSession.vipLevel">
                  VIP {{ currentSession.vipLevel }}
                </el-tag>
              </el-descriptions-item>
            </el-descriptions>

            <el-divider>历史订单</el-divider>

            <el-table :data="currentSession.orders" stripe>
              <el-table-column prop="id" label="订单号" width="100" />
              <el-table-column prop="amount" label="金额" width="100" />
              <el-table-column prop="status" label="状态">
                <template #default="scope">
                  <el-tag :type="scope.row.status.type">
                    {{ scope.row.status.text }}
                  </el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-scrollbar>
        </el-main>
      </el-container>
    </el-aside>
  </el-container>
</template>

<script lang="ts" setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { Picture, Files, VideoCamera } from '@element-plus/icons-vue'
import type { Session, Message } from '../types/chatType'

// 状态定义
const searchQuery = ref('')
const messageInput = ref('')
const currentSession = ref<Session | null>(null)
const sessions = ref<Session[]>([])
const messages = ref<Message[]>([])
const messageContainer = ref<HTMLElement | null>(null)

// 计算属性
const filteredSessions = computed(() => {
  const query = searchQuery.value.toLowerCase()
  return sessions.value.filter(session =>
      session.name.toLowerCase().includes(query) ||
      session.lastMessage.toLowerCase().includes(query)
  )
})

const currentMessages = computed(() =>
    messages.value.filter(msg => msg.sessionId === currentSession.value?.id)
)

// 方法
const switchSession = (session: Session) => {
  currentSession.value = session
  loadMessages(session.id)
}

const loadMessages = async (sessionId: string) => {
  // 这里应该调用API加载消息
  await nextTick()
  scrollToBottom()
}

const sendMessage = () => {
  if (!messageInput.value.trim() || !currentSession.value) return

  const message: Message = {
    id: Date.now().toString(),
    sessionId: currentSession.value.id,
    content: messageInput.value,
    time: new Date().toLocaleTimeString(),
    isSelf: true,
    avatar: 'customer-service-avatar.jpg'
  }

  messages.value.push(message)
  messageInput.value = ''

  nextTick(() => {
    scrollToBottom()
  })
}

const scrollToBottom = () => {
  if (messageContainer.value) {
    messageContainer.value.scrollTop = messageContainer.value.scrollHeight
  }
}

// 生命周期钩子
onMounted(() => {
  // 这里应该调用API加载会话列表
})
</script>

<style scoped>

.cs-container {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  height: 100vh;
  width: 100vw;
  background-color: #f5f7fa;
}

.el-container,
.el-aside,
.el-main {
  height: 100%;
}

/* 调整消息区域的高度 */
.cs-chat-messages {
  height: calc(100vh - 210px);
  overflow-y: auto;
}

/* 确保滚动条容器也是撑满的 */
.el-scrollbar {
  height: 100%;
}

/* 调整会话列表的高度 */
.cs-session-list {
  height: calc(100vh - 70px);
}


.cs-sidebar {
  border-right: 1px solid #dcdfe6;
  background-color: #fff;
}

.cs-header {
  padding: 16px;
  border-bottom: 1px solid #dcdfe6;
}

.cs-session-content {
  display: flex;
  align-items: center;
}

.cs-session-info {
  flex: 1;
  margin-left: 12px;
  overflow: hidden;
}

.cs-session-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.cs-session-preview {
  font-size: 12px;
  color: #909399;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cs-session-meta {
  text-align: right;
}

.cs-session-time {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
}

.cs-chat {
  background-color: #fff;
  margin: 0 1px;
}

.cs-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid #dcdfe6;
}

.cs-message {
  display: flex;
  margin-bottom: 16px;
  align-items: flex-start;
}

.cs-message-self {
  flex-direction: row-reverse;
}

.cs-message-card {
  margin: 0 12px;
  max-width: 60%;
}

.cs-message-self .cs-message-card {
  background-color: #e6f6ff;
}

.cs-message-time {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  text-align: right;
}

.cs-send-bar {
  display: flex;
  justify-content: flex-end;
  margin-top: 8px;
}

.cs-info {
  border-left: 1px solid #dcdfe6;
  background-color: #fff;
}

.cs-info-header {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #dcdfe6;
}

.el-main {
  padding: 16px;
}

.cs-toolbar {
  margin-bottom: 8px;
}

.cs-session-item {
  margin-bottom: 8px;
}

.cs-session-item.active {
  border: 1px solid #409eff;
}
</style>