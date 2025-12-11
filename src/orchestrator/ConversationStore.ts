
import { ActiveConversation } from '../../types';

/**
 * In-memory store for active conversations with cleanup and lookup capabilities.
 * Provides efficient access patterns for the orchestrator.
 */
export class ConversationStore {
    private conversations: Map<string, ActiveConversation> = new Map();
    private timeout: number;

    constructor(timeout: number = 60000) {
        this.timeout = timeout;
    }

    /**
     * Add a conversation to the store.
     */
    public add(conversation: ActiveConversation): void {
        this.conversations.set(conversation.id, conversation);
    }

    /**
     * Get a conversation by ID.
     */
    public get(id: string): ActiveConversation | undefined {
        return this.conversations.get(id);
    }

    /**
     * Remove a conversation by ID.
     * @returns true if conversation was found and removed
     */
    public remove(id: string): boolean {
        return this.conversations.delete(id);
    }

    /**
     * Check if a conversation exists.
     */
    public has(id: string): boolean {
        return this.conversations.has(id);
    }

    /**
     * Get all conversations.
     */
    public getAll(): ActiveConversation[] {
        return Array.from(this.conversations.values());
    }

    /**
     * Get count of active (non-completed, non-error) conversations.
     */
    public getActiveCount(): number {
        let count = 0;
        this.conversations.forEach(c => {
            if (c.status !== 'completed' && c.status !== 'error') count++;
        });
        return count;
    }

    /**
     * Get all active conversations for a specific agent.
     */
    public getConversationsForAgent(agentId: string): ActiveConversation[] {
        return this.getAll().filter(c => 
            c.participants.some(p => p.agentId === agentId) &&
            c.status !== 'completed' && c.status !== 'error'
        );
    }

    /**
     * Get the most recent conversations for display.
     * @param limit - Maximum number of conversations to return
     */
    public getRecent(limit: number = 10): ActiveConversation[] {
        return this.getAll()
            .sort((a, b) => b.lastActivityTime - a.lastActivityTime)
            .slice(0, limit);
    }

    /**
     * Cleanup stale conversations that have exceeded the timeout.
     * Marks them as 'error' status for the orchestrator to handle.
     * @returns Array of conversation IDs that were marked as stale
     */
    public cleanup(): string[] {
        const now = Date.now();
        const staleIds: string[] = [];
        
        this.conversations.forEach((conv, id) => {
            if (
                conv.status !== 'completed' && 
                conv.status !== 'error' &&
                now - conv.lastActivityTime > this.timeout
            ) {
                conv.status = 'error';
                staleIds.push(id);
            }
        });
        
        return staleIds;
    }

    /**
     * Remove all completed and error conversations older than given age.
     * @param maxAge - Maximum age in milliseconds (default: 5 minutes)
     * @returns Number of conversations purged
     */
    public purgeOld(maxAge: number = 300000): number {
        const now = Date.now();
        let purgedCount = 0;
        
        this.conversations.forEach((conv, id) => {
            if (
                (conv.status === 'completed' || conv.status === 'error') &&
                now - conv.lastActivityTime > maxAge
            ) {
                this.conversations.delete(id);
                purgedCount++;
            }
        });
        
        return purgedCount;
    }

    /**
     * Get statistics about conversations.
     */
    public getStats(): {
        total: number;
        active: number;
        completed: number;
        errored: number;
        avgDuration: number;
        avgMessageCount: number;
    } {
        const all = this.getAll();
        const completed = all.filter(c => c.status === 'completed');
        const active = all.filter(c => c.status !== 'completed' && c.status !== 'error');
        const errored = all.filter(c => c.status === 'error');
        
        const durations = completed.map(c => c.lastActivityTime - c.startTime);
        const avgDuration = durations.length > 0 
            ? durations.reduce((a, b) => a + b, 0) / durations.length 
            : 0;
            
        const messageCounts = completed.map(c => c.messages.length);
        const avgMessageCount = messageCounts.length > 0
            ? messageCounts.reduce((a, b) => a + b, 0) / messageCounts.length
            : 0;

        return {
            total: all.length,
            active: active.length,
            completed: completed.length,
            errored: errored.length,
            avgDuration,
            avgMessageCount
        };
    }

    /**
     * Clear all conversations from the store.
     */
    public clear(): void {
        this.conversations.clear();
    }
}
