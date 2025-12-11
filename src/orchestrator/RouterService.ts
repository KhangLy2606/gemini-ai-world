import { Socket } from 'socket.io-client';
import { ActiveConversation, ChatMessage, AgentData, PartialMessage } from '../../types';

export type RouterMode = 'socket' | 'mock';

export interface StreamingUpdate {
    conversationId: string;
    partialMessage?: PartialMessage;
    status: 'typing' | 'streaming' | 'complete' | 'error';
    error?: string;
}

interface MockScript {
    topic: string;
    messages: { senderIndex: 0 | 1; text: string }[];
}

const MOCK_SCRIPTS: MockScript[] = [
    {
        topic: "Tech Talk",
        messages: [
            { senderIndex: 0, text: "Did you push the hotfix?" },
            { senderIndex: 1, text: "Yeah, but it broke the tests." },
            { senderIndex: 0, text: "Classic. Rollback?" },
            { senderIndex: 1, text: "Way ahead of you." }
        ]
    },
    {
        topic: "Coffee Break",
        messages: [
            { senderIndex: 0, text: "Coffee machine is down." },
            { senderIndex: 1, text: "No... tell me it's not true." },
            { senderIndex: 0, text: "I wish I was joking." },
            { senderIndex: 1, text: "Guess I'll power down then." }
        ]
    },
    {
        topic: "Philosophy",
        messages: [
            { senderIndex: 0, text: "Do you think we are in a simulation?" },
            { senderIndex: 1, text: "Only if the user is watching." },
            { senderIndex: 0, text: "That's deep." },
            { senderIndex: 1, text: "Or just rendering logic." }
        ]
    },
    {
        topic: "Project Planning",
        messages: [
            { senderIndex: 1, text: "How's the new feature coming along?" },
            { senderIndex: 0, text: "Making progress. Hit a snag with the API." },
            { senderIndex: 1, text: "Anything I can help with?" },
            { senderIndex: 0, text: "Actually, yeah. Can you review my PR?" }
        ]
    },
    {
        topic: "Weekend Plans",
        messages: [
            { senderIndex: 0, text: "Any plans for the weekend?" },
            { senderIndex: 1, text: "Thinking of debugging that memory leak." },
            { senderIndex: 0, text: "That's... not a hobby." },
            { senderIndex: 1, text: "You haven't seen my memory leaks." }
        ]
    }
];

type RouterEventType = 'message' | 'streaming' | 'complete' | 'error';
type RouterEventCallback = (data: any) => void;

/**
 * Abstraction layer for message routing.
 * Supports Socket.io for real backend communication and Mock mode for development.
 */
export class RouterService {
    private mode: RouterMode;
    private socket: Socket | null = null;
    private mockTimers: Map<string, ReturnType<typeof setInterval>> = new Map();
    private mockStates: Map<string, { 
        scriptIndex: number; 
        charIndex: number;
        script: MockScript;
        participants: AgentData[];
    }> = new Map();
    
    // Simple event emitter implementation
    private listeners: Map<RouterEventType, RouterEventCallback[]> = new Map();

    constructor(mode: RouterMode = 'mock') {
        this.mode = mode;
    }

    /**
     * Register an event listener.
     */
    public on(event: RouterEventType, callback: RouterEventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    /**
     * Remove an event listener.
     */
    public off(event: RouterEventType, callback: RouterEventCallback): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            const index = callbacks.indexOf(callback);
            if (index !== -1) {
                callbacks.splice(index, 1);
            }
        }
    }

    /**
     * Emit an event to all listeners.
     */
    private emit(event: RouterEventType, data: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => cb(data));
        }
    }

    /**
     * Set the routing mode.
     */
    public setMode(mode: RouterMode): void {
        this.mode = mode;
    }

    /**
     * Get current routing mode.
     */
    public getMode(): RouterMode {
        return this.mode;
    }

    /**
     * Set the Socket.io instance for real backend communication.
     */
    public setSocket(socket: Socket): void {
        this.socket = socket;
        this.mode = 'socket';
        this.setupSocketListeners();
    }

    /**
     * Disconnect and cleanup all timers.
     */
    public disconnect(): void {
        this.mockTimers.forEach(timer => clearInterval(timer));
        this.mockTimers.clear();
        this.mockStates.clear();
    }

    /**
     * Start a conversation between two agents.
     */
    public startConversation(
        conversation: ActiveConversation,
        initiator: AgentData,
        target: AgentData
    ): void {
        if (this.mode === 'mock') {
            this.startMockConversation(conversation, initiator, target);
        } else if (this.socket) {
            this.socket.emit('conversation:start', {
                conversationId: conversation.id,
                agentA: { 
                    id: initiator.id, 
                    name: initiator.name, 
                    bio: initiator.bio, 
                    job: initiator.job 
                },
                agentB: { 
                    id: target.id, 
                    name: target.name, 
                    bio: target.bio, 
                    job: target.job 
                },
                topic: conversation.topic
            });
        }
    }

    /**
     * Send a message in a conversation.
     */
    public sendMessage(conversationId: string, message: ChatMessage): void {
        if (this.mode === 'socket' && this.socket) {
            this.socket.emit('conversation:message', { conversationId, message });
        }
        // Mock mode doesn't need to send - it generates its own messages
    }

    /**
     * Cancel a conversation.
     */
    public cancelConversation(conversationId: string): void {
        // Clear mock timers
        const timerKey = `${conversationId}-char`;
        const timer = this.mockTimers.get(timerKey);
        if (timer) {
            clearInterval(timer);
            this.mockTimers.delete(timerKey);
        }
        this.mockStates.delete(conversationId);

        // Notify socket if connected
        if (this.mode === 'socket' && this.socket) {
            this.socket.emit('conversation:cancel', { conversationId });
        }
    }

    // --- Mock Mode Implementation ---

    private startMockConversation(
        conversation: ActiveConversation,
        initiator: AgentData,
        target: AgentData
    ): void {
        const script = MOCK_SCRIPTS[Math.floor(Math.random() * MOCK_SCRIPTS.length)];
        const participants = [initiator, target];

        this.mockStates.set(conversation.id, { 
            scriptIndex: 0, 
            charIndex: 0,
            script,
            participants
        });

        // Configuration
        const typingSpeed = 40; // ms per character (fast for good UX)
        const pauseBetweenMessages = 1200; // ms between messages

        const processNextMessage = () => {
            const state = this.mockStates.get(conversation.id);
            if (!state || state.scriptIndex >= state.script.messages.length) {
                // Conversation complete
                this.mockTimers.delete(`${conversation.id}-main`);
                this.mockStates.delete(conversation.id);
                this.emit('complete', { conversationId: conversation.id });
                return;
            }

            const msgDef = state.script.messages[state.scriptIndex];
            const sender = state.participants[msgDef.senderIndex];
            const fullText = msgDef.text;
            const requestId = `mock-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

            // Emit typing start
            this.emit('streaming', {
                conversationId: conversation.id,
                partialMessage: {
                    conversationId: conversation.id,
                    requestId,
                    accumulatedText: '',
                    chunkCount: 0,
                    isComplete: false,
                    senderId: sender.id,
                    senderName: sender.name || 'Agent'
                },
                status: 'typing'
            } as StreamingUpdate);

            // Progressive character reveal
            let charIndex = 0;
            const charTimer = setInterval(() => {
                charIndex++;
                const partial = fullText.substring(0, charIndex);

                this.emit('streaming', {
                    conversationId: conversation.id,
                    partialMessage: {
                        conversationId: conversation.id,
                        requestId,
                        accumulatedText: partial,
                        chunkCount: charIndex,
                        isComplete: charIndex >= fullText.length,
                        senderId: sender.id,
                        senderName: sender.name || 'Agent'
                    },
                    status: 'streaming'
                } as StreamingUpdate);

                if (charIndex >= fullText.length) {
                    clearInterval(charTimer);
                    this.mockTimers.delete(`${conversation.id}-char`);

                    // Message complete
                    const completeMessage: ChatMessage = {
                        senderId: sender.id,
                        senderName: sender.name || 'Agent',
                        text: fullText,
                        timestamp: Date.now()
                    };

                    this.emit('message', { 
                        conversationId: conversation.id, 
                        message: completeMessage 
                    });

                    // Move to next message
                    state.scriptIndex++;
                    
                    if (state.scriptIndex < state.script.messages.length) {
                        setTimeout(processNextMessage, pauseBetweenMessages);
                    } else {
                        this.emit('complete', { conversationId: conversation.id });
                        this.mockStates.delete(conversation.id);
                    }
                }
            }, typingSpeed);

            this.mockTimers.set(`${conversation.id}-char`, charTimer);
        };

        // Start first message after a short delay
        const mainTimer = setTimeout(processNextMessage, 500);
        this.mockTimers.set(`${conversation.id}-main`, mainTimer as unknown as ReturnType<typeof setInterval>);
    }

    // --- Socket Mode Implementation ---

    private setupSocketListeners(): void {
        if (!this.socket) return;

        this.socket.on('conversation:stream_start', (data: any) => {
            this.emit('streaming', {
                conversationId: data.conversationId,
                partialMessage: {
                    conversationId: data.conversationId,
                    requestId: data.requestId,
                    accumulatedText: '',
                    chunkCount: 0,
                    isComplete: false,
                    senderId: data.senderId || '',
                    senderName: data.senderName || ''
                },
                status: 'typing'
            } as StreamingUpdate);
        });

        this.socket.on('conversation:chunk', (data: any) => {
            this.emit('streaming', {
                conversationId: data.conversationId,
                partialMessage: {
                    conversationId: data.conversationId,
                    requestId: data.requestId,
                    accumulatedText: data.accumulatedText || '',
                    chunkCount: data.chunkIndex,
                    isComplete: data.isComplete,
                    senderId: data.senderId || '',
                    senderName: data.senderName || ''
                },
                status: 'streaming'
            } as StreamingUpdate);
        });

        this.socket.on('conversation:stream_complete', (data: any) => {
            this.emit('message', {
                conversationId: data.conversationId,
                message: data.finalMessage
            });
        });

        this.socket.on('conversation:error', (data: any) => {
            this.emit('error', {
                conversationId: data.conversationId,
                error: data.error
            });
        });
    }
}
