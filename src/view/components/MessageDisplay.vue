<!-- MessageDisplay.vue -->
<template>
  <div
      class="message-item"
      :class="{
      'from-customer': fromCustomer,
      'from-service': !fromCustomer
    }"
  >
    <div class="message-content">
      <div class="message-sender">
        {{ sender }}
      </div>

      <!-- 文本消息 -->
      <div v-if="messageType === 'text'" class="message-text">
        {{ content }}
      </div>

      <!-- 图片消息 -->
      <div v-else-if="messageType === 'image'" class="message-image">
        <el-image
            :src="content"
            :preview-src-list="[content]"
            fit="contain"
            class="message-img"
            :initial-index="0"
        >
          <template #placeholder>
            <div class="image-placeholder">
              <el-icon><Picture /></el-icon>
              加载中...
            </div>
          </template>
          <template #error>
            <div class="image-error">
              <el-icon><Warning /></el-icon>
              加载失败
            </div>
          </template>
        </el-image>
      </div>

      <!-- 文件消息 -->
      <div v-else-if="messageType === 'file'" class="message-file">
        <el-button
            type="primary"
            link
            @click="handleFileDownload"
            class="file-button"
        >
          <el-icon><Document /></el-icon>
          <span class="file-name">{{ getFileName }}</span>
        </el-button>
      </div>

      <!-- 发送时间 -->
      <div class="message-time">
        {{ formatTime }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Picture, Document, Warning } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'

interface Props {
  content: string
  fromCustomer: boolean
  messageType: 'text' | 'image' | 'file'
  sender: string
  timestamp?: number
}

const props = defineProps<Props>()

// 格式化时间
const formatTime = computed(() => {
  if (!props.timestamp) return ''
  return new Date(props.timestamp).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  })
})

// 获取文件名
const getFileName = computed(() => {
  if (props.messageType !== 'file') return ''
  try {
    return decodeURIComponent(props.content.split('/').pop() || '未知文件')
  } catch {
    return '未知文件'
  }
})

// 处理文件下载
const handleFileDownload = () => {
  try {
    window.open(props.content, '_blank')
  } catch (error) {
    ElMessage.error('文件下载失败')
  }
}
</script>

<style scoped>
.message-item {
  margin: 12px 0;
  padding: 8px 12px;
  border-radius: 8px;
  max-width: 70%;
}

.from-customer {
  margin-left: auto;
  background: #e6f7ff;
}

.from-service {
  margin-right: auto;
  background: #ffffff;
}

.message-content {
  position: relative;
}

.message-sender {
  font-size: 13px;
  color: #666;
  margin-bottom: 4px;
}

.message-text {
  word-break: break-word;
  line-height: 1.5;
}

.message-image {
  max-width: 240px;
}

.message-img {
  border-radius: 4px;
  max-width: 100%;
}

.image-placeholder, .image-error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  background: #f5f5f5;
  color: #909399;
  font-size: 14px;
}

.message-file {
  display: flex;
  align-items: center;
}

.file-button {
  display: flex;
  align-items: center;
  gap: 4px;
}

.file-name {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.message-time {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}
</style>