import { createRouter, createWebHistory } from 'vue-router'
import ChatRoom from '../view/chatRoom/chatRoom.vue'
import HelloWorld from '../components/HelloWorld.vue'
const routes = [

    {
        path: '/',
        name: 'Home',
        component: HelloWorld
    },
    {
        path: '/chatRoom',
        name: 'ChatRoom',
        component: ChatRoom
    }

]

const router = createRouter({
    history: createWebHistory(),
    routes
})

export default router