
import React, { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { ChatOrchestrator, OrchestratorConfig } from '../orchestrator';
import { ActiveConversation } from '../../types';

interface OrchestratorStats {
    activeConversations: number;
    queuedConversations: number;
    completed: number;
    avgDuration: number;
}

interface OrchestratorContextValue {
    orchestrator: ChatOrchestrator | null;
    conversations: ActiveConversation[];
    stats: OrchestratorStats;
    isConnected: boolean;
    requestConversation: (initiatorId: string, targetId: string, options?: {
        topic?: string;
        priority?: 'low' | 'normal' | 'high';
        userInitiated?: boolean;
    }) => string | null;
    endConversation: (conversationId: string) => void;
}

const defaultStats: OrchestratorStats = {
    activeConversations: 0,
    queuedConversations: 0,
    completed: 0,
    avgDuration: 0
};

const OrchestratorContext = createContext<OrchestratorContextValue | null>(null);

interface Props {
    children: ReactNode;
    config?: Partial<OrchestratorConfig>;
}

/**
 * React Context Provider for the ChatOrchestrator.
 * Provides access to the orchestrator and reactive conversation state.
 * 
 * @example
 * ```tsx
 * <ChatOrchestratorProvider config={{ enableMockMode: true }}>
 *   <App />
 * </ChatOrchestratorProvider>
 * ```
 */
export const ChatOrchestratorProvider: React.FC<Props> = ({ children, config }) => {
    const orchestratorRef = useRef<ChatOrchestrator | null>(null);
    const [conversations, setConversations] = useState<ActiveConversation[]>([]);
    const [stats, setStats] = useState<OrchestratorStats>(defaultStats);
    const [isConnected, setIsConnected] = useState(false);

    useEffect(() => {
        // Create orchestrator instance
        const orchestrator = new ChatOrchestrator(config);
        orchestratorRef.current = orchestrator;

        // Subscribe to conversation updates
        const handleConversationCreated = () => {
            setConversations(orchestrator.getAllConversations());
            updateStats(orchestrator);
        };

        const handleConversationUpdated = () => {
            setConversations(orchestrator.getAllConversations());
            updateStats(orchestrator);
        };

        const handleConversationEnded = () => {
            setConversations(orchestrator.getAllConversations());
            updateStats(orchestrator);
        };

        const handleQueueUpdated = () => {
            updateStats(orchestrator);
        };

        orchestrator.on('conversation:created', handleConversationCreated);
        orchestrator.on('conversation:updated', handleConversationUpdated);
        orchestrator.on('conversation:ended', handleConversationEnded);
        orchestrator.on('queue:updated', handleQueueUpdated);

        // Start the orchestrator
        orchestrator.start();
        setIsConnected(true);

        // Cleanup on unmount
        return () => {
            orchestrator.off('conversation:created', handleConversationCreated);
            orchestrator.off('conversation:updated', handleConversationUpdated);
            orchestrator.off('conversation:ended', handleConversationEnded);
            orchestrator.off('queue:updated', handleQueueUpdated);
            orchestrator.stop();
            orchestratorRef.current = null;
        };
    }, []);

    const updateStats = (orchestrator: ChatOrchestrator) => {
        const storeStats = orchestrator.getStats();
        setStats({
            activeConversations: storeStats.active,
            queuedConversations: orchestrator.getQueueLength(),
            completed: storeStats.completed,
            avgDuration: storeStats.avgDuration
        });
    };

    const requestConversation = (
        initiatorId: string, 
        targetId: string, 
        options?: {
            topic?: string;
            priority?: 'low' | 'normal' | 'high';
            userInitiated?: boolean;
        }
    ): string | null => {
        if (!orchestratorRef.current) return null;
        return orchestratorRef.current.requestConversation(initiatorId, targetId, options);
    };

    const endConversation = (conversationId: string): void => {
        if (!orchestratorRef.current) return;
        orchestratorRef.current.endConversation(conversationId);
    };

    const value: OrchestratorContextValue = {
        orchestrator: orchestratorRef.current,
        conversations,
        stats,
        isConnected,
        requestConversation,
        endConversation
    };

    return (
        <OrchestratorContext.Provider value={value}>
            {children}
        </OrchestratorContext.Provider>
    );
};

/**
 * Hook to access the orchestrator context.
 * Must be used within a ChatOrchestratorProvider.
 * 
 * @example
 * ```tsx
 * const { conversations, requestConversation } = useOrchestrator();
 * ```
 */
export const useOrchestrator = (): OrchestratorContextValue => {
    const context = useContext(OrchestratorContext);
    if (!context) {
        throw new Error('useOrchestrator must be used within ChatOrchestratorProvider');
    }
    return context;
};

/**
 * Hook to get just the conversations from the orchestrator.
 * Useful for components that only need to display conversation data.
 */
export const useConversations = (): ActiveConversation[] => {
    const { conversations } = useOrchestrator();
    return conversations;
};

/**
 * Hook to get orchestrator stats.
 */
export const useOrchestratorStats = (): OrchestratorStats => {
    const { stats } = useOrchestrator();
    return stats;
};
