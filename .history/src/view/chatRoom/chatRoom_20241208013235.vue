<template>
  
  <el-container class="chat-room-container" style="height: 100%; border: 1px solid #dcdcdc;">
    <!-- 左侧客户列表 -->
    <el-aside width="200px" style="border-right: 1px solid #ebebeb;">
      <div class="customer-list">
        <el-input 
          v-model="searchKeyword" 
          placeholder="搜索客户"
          clearable 
          size="small"
          style="margin:10px;"
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
              {{ customer.name }}
            </el-menu-item>
          </el-menu>
        </el-scrollbar>
      </div>
    </el-aside>

    <!-- 中间消息框 -->
    <el-container>
      <el-header style="border-bottom:1px solid #ebebeb;">
        <div class="chat-header">
          <span v-if="currentCustomer">{{ currentCustomer.name }} 的对话</span>
          <span v-else>请选择客户</span>
        </div>
      </el-header>
      <el-main style="padding:0; position:relative;">
        <div class="messages-container" style="padding:10px; height:calc(100% - 60px); overflow:auto;">
          <div v-for="(msg, index) in messages" :key="index" class="message-item" :class="{'from-customer': msg.fromCustomer}">
            <div class="message-content">
              <div class="message-sender">{{ msg.fromCustomer ? currentCustomer?.name : '客服' }}：</div>
              <div class="message-text">{{ msg.content }}</div>
            </div>
          </div>
        </div>
      </el-main>
      <el-footer style="height:60px; border-top:1px solid #ebebeb; display:flex; align-items:center; padding:0 10px;">
        <el-input
          v-model="newMessage"
          placeholder="输入消息..."
          clearable
          @keyup.enter="sendMessage"
          style="flex:1; margin-right:10px;"
        />
        <el-button type="primary" @click="sendMessage">发送</el-button>
      </el-footer>
    </el-container>

    <!-- 右侧客户信息 -->
    <el-aside width="200px" style="border-left: 1px solid #ebebeb;">
      <div class="customer-info" style="padding:10px;">
        <h3>客户信息</h3>
        <div v-if="currentCustomer">
          <p><strong>姓名：</strong>{{ currentCustomer.name }}</p>
          <p><strong>ID：</strong>{{ currentCustomer.id }}</p>
          <!-- 其他可扩展的客户信息 -->
        </div>
        <div v-else>
          <p>暂无客户信息</p>
        </div>
      </div>
    </el-aside>
  </el-container>
</template>

<script lang="ts" setup>
import { ref, computed ,onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Client } from '@stomp/stompjs';


// TODO: 后续会在这里与后端建立 WebSocket 连接
// 示例：const socket = new WebSocket('ws://example.com/chat');

// 模拟客户列表
const customers = ref([
  { id: 'c001', name: '张三' },
  { id: 'c002', name: '李四' },
  { id: 'c003', name: '王五' },
])

// 当前选中的客户ID
const selectedCustomerId = ref<string>('')

// 搜索关键字
const searchKeyword = ref('')

// 根据搜索关键字过滤客户列表
const filteredCustomers = computed(() => {
  if (!searchKeyword.value.trim()) return customers.value
  return customers.value.filter(c => c.name.includes(searchKeyword.value))
})

// 当前选中的客户信息
const currentCustomer = computed(() => {
  return customers.value.find(c => c.id === selectedCustomerId.value) || null
})

// // 模拟消息列表
// // 这里的 fromCustomer 表示消息是否来自客户（true）还是客服（false）
const messages = ref([
  { content: '你好，我想咨询一下商品的价格。', fromCustomer: true },
  { content: '好的，请问您想咨询哪款商品？', fromCustomer: false }
])

// 新消息输入框
const newMessage = ref('')

// 选择客户
function handleSelectCustomer(customerId: string) {
  selectedCustomerId.value = customerId
  // TODO: 根据选中客户加载相应聊天记录（可通过接口或 WebSocket 请求）
}

// 发送消息
function sendMessage() {
  if (!newMessage.value.trim()) return
  if (!currentCustomer.value) {
    ElMessage.warning('请先选择客户！')
    return
  }
  
  // 将消息加入本地列表，模拟客服发送消息
  messages.value.push({
    content: newMessage.value,
    fromCustomer: false
  })

  // TODO: 通过 WebSocket 将该消息发送给后端，以转发给客户
  
  newMessage.value = ''
}



// TODO: 在onMounted中与WebSocket建立连接
onMounted(() => {
  // 创建 STOMP 客户端实例
  const stompClient = new Client({
    brokerURL: 'ws://localhost:8080/ws', 
    // 这里的URL是Stomp endpoint, /ws是后端定义的端点，加上 /websocket 是SockJS fallback后的实际端点之一
    // 如果你在后端启用了SockJS，那么URL可能需要适配，通常StompJS会自动处理。
    // 如有问题，可在后端将 withSockJS() 去掉，直接使用 ws://localhost:8080/ws
    // 那么这里就直接 ws://localhost:8080/ws 就行。

    onConnect: () => {
      console.log('Connected to WebSocket');
      // 订阅服务器推送的消息
      stompClient.subscribe('/topic/chat', (message) => {
        const payload = JSON.parse(message.body);
        messages.value.push({
          content: payload.content,
          fromCustomer: payload.from === 'customer' // 简单示例，从属性判断
        });
      });
    },
    onStompError: (frame) => {
      console.error('Broker reported error: ' + frame.headers['message']);
      console.error('Additional details: ' + frame.body);
    },
    onWebSocketClose: () => {
      console.log('WebSocket connection closed');
    }
  });

  stompClient.activate();

  // 可以保存在全局或者组件变量中，以便发送消息时使用
  // 在此仅演示流程，可根据实际情况进行抽取
});

// 发送消息示例函数
function sendMessageToServer() {
  // 假设 stompClient 是我们在 onMounted 中创建的客户端，需要存在组件全局变量中以便使用
  // 这里示范，实际代码中请将 stompClient 抽取到组件级的变量中
  // messages.value.push({ content: '客服消息...', fromCustomer: false });

  // TODO: 使用 stompClient.send('/app/sendMessage', {}, JSON.stringify({from:'support', content:'你想咨询哪款商品？'}))
  // 这样就能将消息发送给后端，再由后端广播给所有订阅者。
}


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
}
.message-item {
  margin: 5px 0;
  padding: 5px;
  border-radius: 4px;
  max-width: 60%;
  background: #ffffff;
}
.message-item.from-customer {
  background: #e6f7ff;
}
.message-sender {
  font-weight: bold;
}
</style>
