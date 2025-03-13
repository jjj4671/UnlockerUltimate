import { create } from 'zustand';

// Define the message type
interface WebSocketMessage {
  type: string;
  requestId: string;
  instanceNum: number;
  result: any;
  isComplete?: boolean;
  timestamp?: string;
}

// Define the store state
interface WebSocketState {
  connected: boolean;
  messages: WebSocketMessage[];
  addMessage: (message: WebSocketMessage) => void;
  clearMessages: () => void;
  clearMessagesForRequest: (requestId: string) => void;
}

// Create the store
export const useWebSocketStore = create<WebSocketState>((set) => ({
  connected: false,
  messages: [],
  addMessage: (message) => set((state) => ({ 
    messages: [...state.messages, message] 
  })),
  clearMessages: () => set({ messages: [] }),
  clearMessagesForRequest: (requestId) => set((state) => ({
    messages: state.messages.filter(msg => msg.requestId !== requestId)
  })),
}));

// Helper function to get messages for a specific request
export const getMessagesForRequest = (requestId: string): WebSocketMessage[] => {
  const { messages } = useWebSocketStore.getState();
  return messages.filter(msg => msg.requestId === requestId);
};

// Initialize WebSocket connection
let socket: WebSocket | null = null;

export const initializeWebSocket = () => {
  if (socket && socket.readyState === WebSocket.OPEN) return;

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.hostname}:5001`;
  
  socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    console.log('WebSocket connection established');
    useWebSocketStore.setState({ connected: true });
  };
  
  socket.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('Received WebSocket message:', data);
      
      if (data.type === 'unlocker_test_update') {
        useWebSocketStore.getState().addMessage(data);
      }
    } catch (error) {
      console.error('Error processing WebSocket message:', error);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
    useWebSocketStore.setState({ connected: false });
  };
  
  socket.onclose = () => {
    console.log('WebSocket connection closed');
    useWebSocketStore.setState({ connected: false });
    
    // Try to reconnect after a delay
    setTimeout(() => {
      initializeWebSocket();
    }, 3000);
  };
};

// Close WebSocket connection
export const closeWebSocket = () => {
  if (socket) {
    socket.close();
    socket = null;
  }
};

// Initialize WebSocket on module load
if (typeof window !== 'undefined') {
  initializeWebSocket();
  
  // Reconnect when the window regains focus
  window.addEventListener('focus', () => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      initializeWebSocket();
    }
  });
} 