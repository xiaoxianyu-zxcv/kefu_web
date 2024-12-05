// types.ts
export interface Session {
    id: string
    name: string
    avatar: string
    lastMessage: string
    lastTime: string
    unread: number
    customerId: string
    registerTime: string
    lastLoginTime: string
    vipLevel: 'success' | 'warning' | 'danger'
    orders: Order[]
}

export interface Message {
    id: string
    sessionId: string
    content: string
    time: string
    isSelf: boolean
    avatar: string
}

export interface Order {
    id: string
    amount: number
    status: {
        type: 'success' | 'warning' | 'danger'
        text: string
    }
}