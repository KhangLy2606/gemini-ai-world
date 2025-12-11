import { 
    ActiveConversation, 
    ChatMessage, 
    AgentData,
    ConversationStreamEventDetail,
    PartialMessage,
    ConversationParticipant
} from '../../types';
import { ConversationQueue } from './ConversationQueue';
import { ConversationStore } from './ConversationStore';
import { RouterService, RouterMode, StreamingUpdate } from './RouterService';

/**
 * Configuration options for the ChatOrchestrator.
 */
export interface OrchestratorConfig {
    /** Maximum number of simultaneous active conversations (default: 10) */
    maxConcurrentConversations: number;
    /** Maximum conversations per agent at once (default: 1) */
    maxConversationsPerAgent: number;
    /** Conversation timeout in ms (default: 60000) */
    conversationTimeout: number;
    /** Enable mock mode for development (default: true) */
    enableMockMode: boolean;
    /** Boost priority for user-initiated conversations (default: true) */
    priorityBoostForUserInitiated: boolean;
    /** Queue processing interval in ms (default: 100) */
    processInterval: number;
}

export type OrchestratorEventType = 
    | 'conversation:created'
    | 'conversation:updated'
    | 'conversation:ended'
    | 'conversation:error'
    | 'message:received'
    | 'message:streaming'
    | 'queue:updated'
    | 'agent:busy'
    | 'agent:available';

type OrchestratorEventCallback = (data: any) => void;

/**
 * ChatOrchestrator - Central hub for managing multi-agent conversations.
 * 
 * This is a pure TypeScript class (framework-agnostic) that can be used from
 * both React and Phaser. It manages conversation lifecycle, priority queuing,
 * message routing, and agent availability.
 * 
 * @example
 * ```typescript
 * const orchestrator = new ChatOrchestrator({ enableMockMode: true });
 * orchestrator.on('conversation:updated', (data) => console.log(data));
 * orchestrator.start();
 * orchestrator.requestConversation('agent1', 'agent2', { userInitiated: true });
 * ```
 */
export class ChatOrchestrator {
    private config: OrchestratorConfig;
    private queue: ConversationQueue;
    private store: ConversationStore;
    private router: RouterService;
    private agents: Map<string, AgentData> = new Map();
    private isRunning: boolean = false;
    private processIntervalId: ReturnType<typeof setInterval> | null = null;
    
    // Simple event emitter
    private listeners: Map<OrchestratorEventType, OrchestratorEventCallback[]> = new Map();

    constructor(config: Partial<OrchestratorConfig> = {}) {
        this.config = {
            maxConcurrentConversations: 10,
            maxConversationsPerAgent: 1,
            conversationTimeout: 60000,
            enableMockMode: true,
            priorityBoostForUserInitiated: true,
            processInterval: 100,
            ...config
        };

        this.queue = new ConversationQueue(this.config.maxConcurrentConversations);
        this.store = new ConversationStore(this.config.conversationTimeout);
        this.router = new RouterService(this.config.enableMockMode ? 'mock' : 'socket');
        
        this.setupRouterListeners();
    }

    // --- Event Emitter ---

    /**
     * Register an event listener.
     */
    public on(event: OrchestratorEventType, callback: OrchestratorEventCallback): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }

    /**
     * Remove an event listener.
     */
    public off(event: OrchestratorEventType, callback: OrchestratorEventCallback): void {
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
    private emit(event: OrchestratorEventType, data: any): void {
        const callbacks = this.listeners.get(event);
        if (callbacks) {
            callbacks.forEach(cb => {
                try {
                    cb(data);
                } catch (e) {
                    console.error(`Orchestrator event handler error for ${event}:`, e);
                }
            });
        }
    }

    // --- Lifecycle ---
    
    /**
     * Start the orchestrator. Begins processing the conversation queue.
     */
    public start(): void {
        if (this.isRunning) return;
        this.isRunning = true;
        
        // Process queue at configured interval for fast response
        this.processIntervalId = setInterval(
            () => this.processQueue(), 
            this.config.processInterval
        );
        
        console.log('[ChatOrchestrator] Started');
    }

    /**
     * Stop the orchestrator. Cleans up timers and pending operations.
     */
    public stop(): void {
        this.isRunning = false;
        if (this.processIntervalId) {
            clearInterval(this.processIntervalId);
            this.processIntervalId = null;
        }
        this.router.disconnect();
        
        console.log('[ChatOrchestrator] Stopped');
    }

    /**
     * Check if orchestrator is running.
     */
    public getIsRunning(): boolean {
        return this.isRunning;
    }

    // --- Agent Management ---
    
    /**
     * Register an agent with the orchestrator.
     */
    public registerAgent(agent: AgentData): void {
        this.agents.set(agent.id, agent);
        this.emit('agent:available', { agentId: agent.id, agent });
    }

    /**
     * Update an agent's data.
     */
    public updateAgent(agentId: string, updates: Partial<AgentData>): void {
        const agent = this.agents.get(agentId);
        if (agent) {
            Object.assign(agent, updates);
        }
    }

    /**
     * Unregister an agent and end all their conversations.
     */
    public unregisterAgent(agentId: string): void {
        this.agents.delete(agentId);
        // End all conversations involving this agent
        this.store.getConversationsForAgent(agentId).forEach(conv => {
            this.endConversation(conv.id, 'agent_left');
        });
    }

    /**
     * Sync all agents from an external source (e.g., Phaser scene).
     */
    public syncAgents(agents: Map<string, AgentData>): void {
        this.agents = agents;
    }

    /**
     * Get an agent by ID.
     */
    public getAgent(agentId: string): AgentData | undefined {
        return this.agents.get(agentId);
    }

    // --- Conversation Management ---
    
    /**
     * Request a new conversation between two agents.
     * 
     * @param initiatorId - ID of the agent initiating the conversation
     * @param targetId - ID of the target agent
     * @param options - Optional configuration
     * @returns Conversation ID if request was accepted, null otherwise
     */
    public requestConversation(
        initiatorId: string, 
        targetId: string, 
        options: { 
            topic?: string; 
            priority?: 'low' | 'normal' | 'high';
            userInitiated?: boolean;
        } = {}
    ): string | null {
        const initiator = this.agents.get(initiatorId);
        const target = this.agents.get(targetId);

        if (!initiator || !target) {
            console.warn('[ChatOrchestrator] Missing agent(s) for conversation request');
            return null;
        }

        // Check if agents are available
        if (!this.isAgentAvailable(initiatorId)) {
            this.emit('agent:busy', { agentId: initiatorId, reason: 'already_chatting' });
            return null;
        }
        
        if (!this.isAgentAvailable(targetId)) {
            this.emit('agent:busy', { agentId: targetId, reason: 'already_chatting' });
            return null;
        }

        // Generate conversation ID
        const conversationId = `conv-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

        // Create participants
        const participants: ConversationParticipant[] = [
            { agentId: initiatorId, name: initiator.name || 'Agent A', role: 'initiator' },
            { agentId: targetId, name: target.name || 'Agent B', role: 'responder' }
        ];

        // Create conversation object
        const conversation: ActiveConversation = {
            id: conversationId,
            participants,
            status: 'initializing',
            startTime: Date.now(),
            lastActivityTime: Date.now(),
            messages: [],
            topic: options.topic,
            isMock: this.config.enableMockMode
        };

        // Calculate priority (higher number = higher priority)
        let priority = options.priority === 'high' ? 3 : options.priority === 'low' ? 1 : 2;
        if (options.userInitiated && this.config.priorityBoostForUserInitiated) {
            priority += 1;
        }

        // Add to queue and store
        this.queue.enqueue(conversation, priority);
        this.store.add(conversation);
        
        this.emit('conversation:created', { conversation, priority });
        this.emit('queue:updated', { queueLength: this.queue.size() });

        return conversationId;
    }

    /**
     * End a conversation.
     * 
     * @param conversationId - ID of the conversation to end
     * @param reason - Reason for ending (for logging/analytics)
     */
    public endConversation(conversationId: string, reason: string = 'completed'): void {
        const conversation = this.store.get(conversationId);
        if (!conversation) return;

        conversation.status = 'completed';
        
        // Release agents
        conversation.participants.forEach(p => {
            const agent = this.agents.get(p.agentId);
            if (agent) {
                agent.state = 'idle';
                agent.conversationPartnerId = undefined;
            }
        });

        // Cancel any pending router operations
        this.router.cancelConversation(conversationId);

        // Remove from queue if still pending
        this.queue.remove(conversationId);

        this.emit('conversation:ended', { 
            conversationId, 
            reason,
            messageCount: conversation.messages.length,
            duration: Date.now() - conversation.startTime
        });
    }

    /**
     * Get a conversation by ID.
     */
    public getConversation(id: string): ActiveConversation | undefined {
        return this.store.get(id);
    }

    /**
     * Get all conversations.
     */
    public getAllConversations(): ActiveConversation[] {
        return this.store.getAll();
    }

    /**
     * Get count of active conversations.
     */
    public getActiveConversationCount(): number {
        return this.store.getActiveCount();
    }

    /**
     * Get queue length.
     */
    public getQueueLength(): number {
        return this.queue.size();
    }

    /**
     * Get conversation statistics.
     */
    public getStats() {
        return this.store.getStats();
    }

    /**
     * Get the router service (for socket configuration).
     */
    public getRouter(): RouterService {
        return this.router;
    }

    // --- Queue Processing ---
    
    private processQueue(): void {
        if (!this.isRunning) return;

        // Check for stale conversations
        const staleIds = this.store.cleanup();
        staleIds.forEach(id => {
            this.endConversation(id, 'timeout');
        });

        // Purge old completed conversations periodically
        this.store.purgeOld(300000); // 5 minutes

        // Process pending conversations if we have capacity
        while (this.store.getActiveCount() < this.config.maxConcurrentConversations) {
            const next = this.queue.dequeue();
            if (!next) break;

            this.startConversation(next);
        }
    }

    private startConversation(conversation: ActiveConversation): void {
        const [p1, p2] = conversation.participants;
        const agent1 = this.agents.get(p1.agentId);
        const agent2 = this.agents.get(p2.agentId);

        if (!agent1 || !agent2) {
            this.endConversation(conversation.id, 'agents_unavailable');
            return;
        }

        // Double-check availability (agents might have become busy)
        if (!this.isAgentAvailable(p1.agentId) || !this.isAgentAvailable(p2.agentId)) {
            // Re-queue with slight delay
            conversation.lastActivityTime = Date.now();
            this.queue.enqueue(conversation, 2);
            return;
        }

        // Mark agents as chatting
        agent1.state = 'chatting';
        agent1.conversationPartnerId = p2.agentId;
        agent1.activeConversation = [];
        
        agent2.state = 'chatting';
        agent2.conversationPartnerId = p1.agentId;
        agent2.activeConversation = [];

        // Update conversation status
        conversation.status = 'generating';
        conversation.lastActivityTime = Date.now();

        // Notify router to start the conversation
        this.router.startConversation(conversation, agent1, agent2);
        
        this.emit('conversation:updated', { 
            conversation, 
            status: 'generating' 
        });
    }

    // --- Helpers ---
    
    private isAgentAvailable(agentId: string): boolean {
        const agent = this.agents.get(agentId);
        if (!agent) return false;
        
        // Check if agent is already in active conversations
        const activeConvs = this.store.getConversationsForAgent(agentId);
        
        return (
            activeConvs.length < this.config.maxConversationsPerAgent && 
            agent.state === 'idle'
        );
    }

    private setupRouterListeners(): void {
        // Handle streaming updates from router
        this.router.on('streaming', (data: StreamingUpdate) => {
            const conversation = this.store.get(data.conversationId);
            if (!conversation) return;

            conversation.lastActivityTime = Date.now();
            
            if (data.partialMessage) {
                conversation.partialMessage = data.partialMessage;
                conversation.status = 'streaming';
                
                // Update agent histories with partial message
                this.updateAgentPartialMessage(conversation, data.partialMessage);
            }

            this.emit('conversation:updated', { 
                conversation, 
                status: data.status,
                partialMessage: data.partialMessage
            });
        });

        // Handle complete messages
        this.router.on('message', (data: { conversationId: string; message: ChatMessage }) => {
            const conversation = this.store.get(data.conversationId);
            if (!conversation) return;

            conversation.messages.push(data.message);
            conversation.partialMessage = undefined;
            conversation.lastActivityTime = Date.now();

            // Update agent conversation histories
            this.updateAgentHistory(conversation, data.message);

            this.emit('message:received', data);
            this.emit('conversation:updated', { 
                conversation, 
                status: 'complete'
            });
        });

        // Handle conversation completion
        this.router.on('complete', (data: { conversationId: string }) => {
            const conversation = this.store.get(data.conversationId);
            if (conversation) {
                this.endConversation(data.conversationId, 'natural_end');
            }
        });

        // Handle errors
        this.router.on('error', (data: { conversationId: string; error: string }) => {
            this.emit('conversation:error', data);
            this.endConversation(data.conversationId, 'error');
        });
    }

    private updateAgentHistory(conversation: ActiveConversation, message: ChatMessage): void {
        conversation.participants.forEach(p => {
            const agent = this.agents.get(p.agentId);
            if (agent) {
                if (!agent.activeConversation) agent.activeConversation = [];
                agent.activeConversation.push(message);
                agent.lastMessage = message.text;
                
                // Keep history size reasonable
                if (agent.activeConversation.length > 20) {
                    agent.activeConversation.shift();
                }
            }
        });
    }

    private updateAgentPartialMessage(conversation: ActiveConversation, partial: PartialMessage): void {
        conversation.participants.forEach(p => {
            const agent = this.agents.get(p.agentId);
            if (agent && agent.id !== partial.senderId) {
                // The receiving agent sees the typing indicator
                agent.lastMessage = `${partial.senderName} is typing...`;
            }
        });
    }
}
