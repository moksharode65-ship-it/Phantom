import { create, type UseBoundStore, type StoreApi } from 'zustand'
import { persist } from 'zustand/middleware'

export interface Message {
  id: string
  from: string
  to: string
  content: string
  priority: 'NORMAL' | 'HIGH' | 'URGENT' | 'EMERGENCY'
  route: string[]
  directAvailable: boolean
  status: 'QUEUED' | 'TRANSMITTING' | 'RELAYING' | 'DELIVERED' | 'FAILED' | 'STORED' | 'RECEIVED' | 'READ'
  timestamp: number
  acks: string[]
}

interface MessageState {
  messages: Message[]
  sentMessages: Message[]
  receivedMessages: Message[]
  unreadCount: number
  blockedSenders: string[]

  // Actions
  sendMessage: (message: Omit<Message, 'id' | 'timestamp' | 'status' | 'acks' | 'route'> & { route?: string[] }) => Message
  receiveMessage: (message: Omit<Message, 'status' | 'acks' | 'directAvailable'> & { acks?: string[]; directAvailable?: boolean }) => Message
  markAsRead: (id: string) => void
  markAsReceived: (id: string) => void
  markAllAsRead: () => void
  updateMessageStatus: (id: string, status: Message['status'], acks?: string[]) => void
  getMessageById: (id: string) => Message | undefined
  getSentMessages: () => Message[]
  getReceivedMessages: () => Message[]
  removeMessage: (id: string) => void
  toggleBlockSender: (from: string) => void
  clearHistory: () => void
}

export type MessageStore = UseBoundStore<StoreApi<MessageState>>

export function createMessageStore(persistKey: string) {
  return create<MessageState>()(
    persist(
      (set, get) => ({
      messages: [],
      sentMessages: [],
      receivedMessages: [],
      unreadCount: 0,
      blockedSenders: [],

      sendMessage: (messageData) => {
        const newMessage: Message = {
          ...messageData,
          id: `MSG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          timestamp: Date.now(),
          status: 'QUEUED',
          acks: [],
          route: messageData.route || [messageData.from, messageData.to],
        }

        set((state) => ({
          messages: [newMessage, ...state.messages].slice(0, 100),
          sentMessages: [newMessage, ...state.sentMessages].slice(0, 100),
        }))

        // Simulate message delivery progression
        setTimeout(() => {
          get().updateMessageStatus(newMessage.id, 'TRANSMITTING', ['NODE_RECV'])
        }, 500)

        setTimeout(() => {
          get().updateMessageStatus(newMessage.id, 'RELAYING', ['NODE_RECV', 'RELAY_CONFIRM'])
        }, 1500)

        setTimeout(() => {
          get().updateMessageStatus(newMessage.id, 'DELIVERED', ['NODE_RECV', 'RELAY_CONFIRM', 'E2E_CONFIRM'])
        }, 2500)

        return newMessage
      },

      receiveMessage: (messageData) => {
        const incoming: Message = {
          ...messageData,
          directAvailable: messageData.directAvailable ?? false,
          id: messageData.id || `MSG-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
          timestamp: messageData.timestamp || Date.now(),
          status: 'RECEIVED',
          acks: messageData.acks || ['NODE_RECV', 'RELAY_CONFIRM', 'E2E_CONFIRM'],
          route: messageData.route || [messageData.from, messageData.to],
        }
        set((state) => ({
          messages: [incoming, ...state.messages].slice(0, 100),
          receivedMessages: [incoming, ...state.receivedMessages].slice(0, 100),
          unreadCount: state.unreadCount + 1,
        }))
        return incoming
      },

      markAsRead: (id) => {
        set((state) => ({
          messages: state.messages.map(m => m.id === id ? { ...m, status: 'READ' as const } : m),
          receivedMessages: state.receivedMessages.map(m => m.id === id ? { ...m, status: 'READ' as const } : m),
          unreadCount: Math.max(0, state.unreadCount - 1),
        }))
      },

      markAsReceived: (id) => {
        set((state) => ({
          messages: state.messages.map(m => m.id === id ? { ...m, status: 'RECEIVED' as const } : m),
          receivedMessages: state.receivedMessages.map(m => m.id === id ? { ...m, status: 'RECEIVED' as const } : m),
        }))
      },

      markAllAsRead: () => {
        set((state) => ({
          messages: state.messages.map(m => m.status === 'RECEIVED' ? { ...m, status: 'READ' as const } : m),
          receivedMessages: state.receivedMessages.map(m => m.status === 'RECEIVED' ? { ...m, status: 'READ' as const } : m),
          unreadCount: 0,
        }))
      },

      removeMessage: (id) => {
        const state = get()
        const target = state.receivedMessages.find(m => m.id === id)
        set((s) => ({
          messages: s.messages.filter(m => m.id !== id),
          receivedMessages: s.receivedMessages.filter(m => m.id !== id),
          unreadCount: Math.max(0, s.unreadCount - (target?.status === 'RECEIVED' ? 1 : 0)),
        }))
      },

      toggleBlockSender: (from) => {
        set((state) => ({
          blockedSenders: state.blockedSenders.includes(from)
            ? state.blockedSenders.filter(f => f !== from)
            : [...state.blockedSenders, from],
        }))
      },

      updateMessageStatus: (id, status, acks) => {
        const state = get()
        const target = state.messages.find(m => m.id === id)
        if (!target) return
        if (target.status === status && JSON.stringify(target.acks) === JSON.stringify(acks || target.acks)) {
          return
        }
        set((s) => ({
          messages: s.messages.map(m => 
            m.id === id ? { ...m, status, acks: acks || m.acks } : m
          ),
          sentMessages: s.sentMessages.map(m => 
            m.id === id ? { ...m, status, acks: acks || m.acks } : m
          ),
          receivedMessages: s.receivedMessages.map(m => 
            m.id === id ? { ...m, status, acks: acks || m.acks } : m
          ),
        }))
      },

      getMessageById: (id) => {
        return get().messages.find(m => m.id === id)
      },

      getSentMessages: () => {
        return get().sentMessages
      },

      getReceivedMessages: () => {
        return get().receivedMessages
      },

      clearHistory: () => {
        set({ messages: [], sentMessages: [], receivedMessages: [], unreadCount: 0 })
      },
    }),
    {
      name: persistKey,
      partialize: (state) => ({
        messages: state.messages,
        sentMessages: state.sentMessages,
        receivedMessages: state.receivedMessages,
        unreadCount: state.unreadCount,
        blockedSenders: state.blockedSenders,
      }),
      merge: (persisted, current) => {
        const merged = { ...current, ...(persisted as object) } as MessageState
        if (!merged.blockedSenders) merged.blockedSenders = []
        const settle = (list: Message[]) => list.map(m =>
          m.status === 'TRANSMITTING' || m.status === 'RELAYING'
            ? { ...m, status: 'DELIVERED' as const, acks: ['NODE_RECV', 'RELAY_CONFIRM', 'E2E_CONFIRM'] }
            : m
        )
        merged.messages = settle(merged.messages)
        merged.sentMessages = settle(merged.sentMessages)
        merged.receivedMessages = settle(merged.receivedMessages)
        return merged
      },
    }
  ))
}

export const useMessageStore = createMessageStore('pantom-message-storage')