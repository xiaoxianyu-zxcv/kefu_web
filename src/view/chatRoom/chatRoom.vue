<template>

  <el-container class="chat-room-container" style="height: 100%; border: 1px solid #dcdcdc;">
    <!-- 左侧客户列表 -->
    <el-aside width="200px" style="border-right: 1px solid #ebebeb;">
      <div class="customer-list">
        <el-input
          v-model="searchKeyword"
          placeholder="搜索客户"
          clearable
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
              <div class="message-text">
                <template v-if="msg.messageType === 'text'">
                  {{ msg.content }}
                </template>
                <template v-else-if="msg.messageType === 'image'">
                  <img :src="msg.content" alt="image message" style="max-width:200px;"/>
                </template>
                <template v-else-if="msg.messageType === 'file'">
                  <a :href="msg.content" target="_blank">下载文件</a>
                </template>
              </div>

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
        <el-button @click="sendMockImage">发送测试图片</el-button>

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
import {ref, computed, onMounted, onUnmounted} from 'vue'
import { ElMessage } from 'element-plus'
import { Client } from '@stomp/stompjs';
import SockJS from 'sockjs-client';
import axios from 'axios';

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


// 新消息输入框
const newMessage = ref('')

// 选择客户
// async function handleSelectCustomer(customerId: string) {
//   selectedCustomerId.value = customerId;
//   // 从后端拉取该用户的历史消息
//   const { data } = await axios.get(`http://localhost:8080/api/messages?userId=${customerId}`);
//   // data 应该是数组格式的消息列表
//   console.log('data', data)
//   messages.value = data.map((msg: any) => {
//     return {
//       content: msg.content,
//       fromCustomer: msg.role === 'user' // 根据消息角色判断消息显示样式
//     }
//   });
// }

// 添加一个标记来控制定时器
const simulationTimer = ref<number | null>(null)

// 模拟用户发送消息
function simulateUserMessage() {
  if (!currentCustomer.value) return

  const simulatedMessage = {
    fromUser: currentCustomer.value.id,
    toUser: 'kefu1',
    role: 'user',
    content: `我是${currentCustomer.value.name}，这是一条模拟消息 - ${new Date().toLocaleTimeString()}`,
    timestamp: Date.now()
  }

  if (stompClient && stompClient.connected) {
    stompClient.publish({
      destination: '/app/userSend',
      body: JSON.stringify(simulatedMessage)
    })
  }
}




const baseURL = 'http://localhost:8080';
// 选择客户
async function handleSelectCustomer(customerId: string) {
  try {
    selectedCustomerId.value = customerId;
    const { data } = await axios.get(`${baseURL}/api/messages`, {
      params: { userId: customerId },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    // 添加错误处理
    if (!Array.isArray(data)) {
      console.error('返回的data有问题', data);
      ElMessage.error('获取历史消息失败');
      return;
    }

    messages.value = data.map((msg: any) => {
      return {
        content: msg.content,
        fromCustomer: msg.role === 'user',
        messageType: msg.massageType || 'text'
      }
    });


    // 在获取历史消息成功后订阅对应的topic
    if (stompClient && stompClient.connected) {
      stompClient.subscribe(`/topic/kefu/${customerId}`, (message) => {
        const payload = JSON.parse(message.body);
        console.log('收到消息', payload);
        messages.value.push({
          content: payload.content,
          fromCustomer: payload.role === 'user',
          messageType: payload.messageType || 'text'
        });
      });
    }



  } catch (error) {
    console.error('请求错误:', error);
    ElMessage.error('获取历史消息失败');
  }
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
    fromCustomer: false,
  })

  // 调用已有的发送消息方法
  sendMessageToServer(newMessage.value, currentCustomer.value.id)
  
  newMessage.value = ''
}
const messages = ref([]); // 用于存储收到的消息

let stompClient: Client | null = null;


onMounted(() => {
  console.log('onMounted is triggered')

  // 创建SockJS连接
  const socket = new SockJS('http://localhost:8080/ws');
  // 注意这里使用http开头，SockJS内部会自动升级或者采用合适的协议

  // 创建STOMP客户端
  stompClient = new Client({
    webSocketFactory: () => socket,
    onConnect: (frame) => {
      // 订阅服务端广播的消息
      // stompClient?.subscribe('/topic/chat', (message) => {
      //   const payload = JSON.parse(message.body);
      //   messages.value.push({
      //     content: payload.content,
      //     fromCustomer: payload.from === 'customer'
      //   });
      // });

      //方便以后客服订阅某个客户
      stompClient?.subscribe(`/topic/kefu/${userId}`, (message) => {
        const payload = JSON.parse(message.body);
        console.log('收到消息', payload);
        messages.value.push({
          content: payload.content,
          fromCustomer: payload.role === 'user'
        });
      });


    },
    onStompError: (frame) => {
      console.error('STOMP Broker error: ', frame.headers['message']);
      console.error('Details: ', frame.body);
    }
  });

  // 激活STOMP客户端
  stompClient.activate();


});

// 发送消息函数
function sendMessageToServer(content: string, userId: string) {
  if (stompClient && stompClient.connected) {
    //todo: 这里的fromUser和toUser需要根据实际情况修改
    const message =
        { fromUser: 'kefu1',  // 改为 fromUser
          toUser: userId,     // 改为 toUser
          role: 'kefu',
          content: content,
          timestamp: Date.now()  };
    stompClient.publish({ destination: '/app/kefuSend', body: JSON.stringify(message) });
  } else {
    console.warn('Not connected, cannot send message');
  }
}

// 在组件卸载时清理定时器
onUnmounted(() => {
  if (simulationTimer.value) {
    clearInterval(simulationTimer.value)
  }
})


async function sendMockImage() {
  const { data } = await axios.get('http://localhost:8080/api/mockUpload');
  const fileUrl = data.url;
  console.log('mock image url:', fileUrl);
  // 通过 sendMessageToServerWithType 发送消息
  sendMessageToServerWithType(fileUrl, 'image');
}

function sendMessageToServerWithType(content: string, messageType: string) {
  if (stompClient && stompClient.connected && currentCustomer.value) {
    const message = {
      fromUser: 'kefu1',
      toUser: currentCustomer.value.id,
      role: 'kefu',
      content: content,
      timestamp: Date.now(),
      messageType: messageType
    };
    stompClient.publish({ destination: '/app/kefuSend', body: JSON.stringify(message) });
    messages.value.push({
      content: message.content,
      fromCustomer: false,
      messageType: messageType
    })
  } else {
    console.warn('Not connected or no customer selected');
  }
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
