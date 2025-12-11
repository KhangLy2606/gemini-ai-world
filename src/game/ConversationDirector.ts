import Phaser from 'phaser';
import { Socket } from 'socket.io-client';
import { 
    AgentData, 
    ActiveConversation, 
    ChatMessage, 
    ConversationStreamEventDetail, 
    PartialMessage, 
    TICK_DURATION 
} from '../../types';
import { 
    StreamStartResponseSchema, 
    MessageChunkSchema, 
    StreamCompleteResponseSchema, 
    StreamErrorResponseSchema, 
    StreamCancelledResponseSchema 
} from '../validation/conversationSchemas';

interface ConversationScript {
    topic: string;
    messages: { senderIndex: 0 | 1; text: string }[];
}

const MOCK_SCRIPTS: ConversationScript[] = [
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
    }
];

export class ConversationDirector {
    private scene: Phaser.Scene;
    private socket: Socket | null = null;
    private onUpdate: (detail: ConversationStreamEventDetail) => void;
    private conversations: Map<string, ActiveConversation> = new Map();
    private activeRequests: Set<string> = new Set(); // Request IDs to prevent dupes
    
    // Mock simulation state
    private useMock: boolean = true;
    private lastMockUpdate: number = 0;
    private mockTypingSpeed: number = 50; // ms per char

    constructor(
        scene: Phaser.Scene, 
        onUpdate: (detail: ConversationStreamEventDetail) => void
    ) {
        this.scene = scene;
        this.onUpdate = onUpdate;
    }

    public setSocket(socket: Socket | null) {
        this.socket = socket;
        this.useMock = !socket?.connected;
        
        if (socket) {
            socket.on('connect', () => { this.useMock = false; });
            socket.on('disconnect', () => { this.useMock = true; });
            this.setupSocketHandlers();
        }
    }

    public update(time: number, delta: number, agents: Map<string, AgentData>) {
        // Handle Mock Conversations
        if (this.useMock) {
            this.updateMockConversations(time, delta, agents);
        }

        // Cleanup stale conversations (mock or real)
        const now = Date.now();
        this.conversations.forEach((conv, id) => {
            if (now - conv.lastActivityTime > 60000) { // 1 min timeout
                this.endConversation(id);
            }
        });
    }

    /**
     * Public method to manually start a chat (e.g. from UI)
     */
    public startConversation(agentA: AgentData, agentB: AgentData) {
        const id = `conv-${Date.now()}-${Math.floor(Math.random()*1000)}`;
        
        const conversation: ActiveConversation = {
            id,
            participants: [
                { agentId: agentA.id, name: agentA.name || 'Agent A', role: 'initiator' },
                { agentId: agentB.id, name: agentB.name || 'Agent B', role: 'responder' }
            ],
            status: 'initializing',
            startTime: Date.now(),
            lastActivityTime: Date.now(),
            messages: [],
            isMock: this.useMock
        };

        if (this.useMock) {
            const script = MOCK_SCRIPTS[Math.floor(Math.random() * MOCK_SCRIPTS.length)];
            conversation.topic = script.topic;
            conversation.mockScript = script.messages;
            conversation.mockScriptIndex = 0;
            conversation.status = 'generating';
            this.conversations.set(id, conversation);
            
            // Update agent states
            this.setAgentChatting(agentA, id, agentB.id);
            this.setAgentChatting(agentB, id, agentA.id);
        } else {
            // Real backend trigger (placeholder)
            this.socket?.emit('conversation:start', {
                conversationId: id,
                agentAId: agentA.id,
                agentBId: agentB.id
            });
            this.conversations.set(id, conversation);
        }
    }

    private updateMockConversations(time: number, delta: number, agents: Map<string, AgentData>) {
        this.conversations.forEach((conv, id) => {
            if (!conv.isMock || conv.status === 'completed') return;

            // Logic to step through mock script
            if (!conv.partialMessage && conv.mockScript && conv.mockScriptIndex! < conv.mockScript.length) {
                // Start typing next message
                const msgData = conv.mockScript[conv.mockScriptIndex!];
                const participant = conv.participants[msgData.senderIndex];
                
                conv.partialMessage = {
                    conversationId: id,
                    requestId: `req-${Date.now()}`,
                    accumulatedText: '',
                    chunkCount: 0,
                    isComplete: false,
                    senderId: participant.agentId,
                    senderName: participant.name
                };
                conv.status = 'streaming';
                conv.lastActivityTime = Date.now();
                
                // Notify UI typing started
                this.onUpdate({ conversationId: id, status: 'typing' });
            } else if (conv.partialMessage) {
                // Simulate typing
                const msgData = conv.mockScript![conv.mockScriptIndex!];
                const fullText = msgData.text;
                const currentLen = conv.partialMessage.accumulatedText.length;
                
                if (currentLen < fullText.length) {
                    // Type character(s)
                    const charsToAdd = 1; // Simplistic typing
                    conv.partialMessage.accumulatedText = fullText.substring(0, currentLen + charsToAdd);
                    conv.partialMessage.chunkCount++;
                    conv.lastActivityTime = Date.now();
                    
                    // Random chance to emit update to avoid spamming UI
                    if (Math.random() > 0.5 || conv.partialMessage.accumulatedText.length === fullText.length) {
                        this.onUpdate({ 
                            conversationId: id, 
                            status: 'streaming', 
                            partialMessage: { ...conv.partialMessage } 
                        });
                    }
                } else {
                    // Message Complete
                    conv.partialMessage.isComplete = true;
                    
                    const newMsg: ChatMessage = {
                        senderId: conv.partialMessage.senderId,
                        senderName: conv.partialMessage.senderName,
                        text: conv.partialMessage.accumulatedText,
                        timestamp: Date.now()
                    };
                    
                    conv.messages.push(newMsg);
                    conv.mockScriptIndex!++;
                    
                    // Update agents history
                    this.updateAgentHistory(agents, conv.participants, newMsg);
                    
                    this.onUpdate({ 
                        conversationId: id, 
                        status: 'complete',
                        partialMessage: undefined 
                    });
                    
                    conv.partialMessage = undefined;
                    conv.lastActivityTime = Date.now();

                    // Check if conversation over
                    if (conv.mockScriptIndex! >= conv.mockScript!.length) {
                        this.endConversation(id, agents);
                    }
                }
            }
        });

        // Chance to start random mock conversation if idle
        if (time - this.lastMockUpdate > 2000) {
            this.lastMockUpdate = time;
            // Simple logic: find 2 idle agents close to each other
            this.tryStartRandomMockChat(agents);
        }
    }

    private tryStartRandomMockChat(agents: Map<string, AgentData>) {
        const idleAgents = Array.from(agents.values()).filter(a => a.state === 'idle');
        if (idleAgents.length < 2) return;

        // Shuffle
        const candidate = idleAgents[Math.floor(Math.random() * idleAgents.length)];
        
        // Find neighbor
        const neighbor = idleAgents.find(a => 
            a.id !== candidate.id && 
            Math.abs(a.gridX - candidate.gridX) <= 3 && 
            Math.abs(a.gridY - candidate.gridY) <= 3
        );

        if (neighbor) {
            this.startConversation(candidate, neighbor);
        }
    }

    private endConversation(id: string, agents?: Map<string, AgentData>) {
        const conv = this.conversations.get(id);
        if (conv) {
            conv.status = 'completed';
            this.conversations.delete(id);
            
            // Reset agents to idle if we have the map
            if (agents) {
                conv.participants.forEach(p => {
                    const agent = agents.get(p.agentId);
                    if (agent) {
                        agent.state = 'idle';
                        agent.conversationPartnerId = undefined;
                    }
                });
            }
        }
    }

    private setAgentChatting(agent: AgentData, convId: string, partnerId: string) {
        agent.state = 'chatting';
        agent.conversationPartnerId = partnerId;
        // Don't clear history immediately, append instead
        if (!agent.activeConversation) agent.activeConversation = [];
    }

    private updateAgentHistory(agents: Map<string, AgentData>, participants: {agentId: string}[], msg: ChatMessage) {
        participants.forEach(p => {
            const agent = agents.get(p.agentId);
            if (agent) {
                if (!agent.activeConversation) agent.activeConversation = [];
                agent.activeConversation.push(msg);
                agent.lastMessage = msg.text;
                
                // Keep history size reasonable
                if (agent.activeConversation.length > 20) {
                    agent.activeConversation.shift();
                }
            }
        });
    }

    // --- Socket Handling ---

    private setupSocketHandlers() {
        if (!this.socket) return;

        this.socket.on('conversation:stream_start', (payload) => {
            const result = StreamStartResponseSchema.safeParse(payload);
            if (!result.success) return console.error("Invalid stream_start", result.error);
            const { conversationId, requestId, senderId, senderName } = result.data;

            const conv = this.conversations.get(conversationId);
            if (!conv) return; // Or create if implicit

            conv.partialMessage = {
                conversationId,
                requestId,
                accumulatedText: '',
                chunkCount: 0,
                isComplete: false,
                senderId,
                senderName
            };
            conv.status = 'streaming';
            this.onUpdate({ conversationId, status: 'typing' });
        });

        this.socket.on('conversation:chunk', (payload) => {
            const result = MessageChunkSchema.safeParse(payload);
            if (!result.success) return console.warn("Invalid chunk", result.error);
            const { conversationId, chunk } = result.data;

            const conv = this.conversations.get(conversationId);
            if (conv && conv.partialMessage) {
                conv.partialMessage.accumulatedText += chunk;
                conv.partialMessage.chunkCount++;
                conv.lastActivityTime = Date.now();
                this.onUpdate({ 
                    conversationId, 
                    status: 'streaming', 
                    partialMessage: { ...conv.partialMessage }
                });
            }
        });

        this.socket.on('conversation:stream_complete', (payload) => {
            const result = StreamCompleteResponseSchema.safeParse(payload);
            if (!result.success) return;
            const { conversationId, finalMessage } = result.data;

            const conv = this.conversations.get(conversationId);
            if (conv) {
                conv.messages.push(finalMessage);
                conv.partialMessage = undefined;
                this.onUpdate({ conversationId, status: 'complete' });
            }
        });

        // Error and Cancelled handlers would go here...
    }
}
