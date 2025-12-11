import { ActiveConversation } from '../../types';

interface QueuedConversation {
    conversation: ActiveConversation;
    priority: number;  // Higher = more important
    queuedAt: number;
}

/**
 * Priority queue for pending conversation requests.
 * Higher priority conversations are processed first.
 * FIFO ordering within same priority level.
 */
export class ConversationQueue {
    private queue: QueuedConversation[] = [];
    private maxActive: number;

    constructor(maxActive: number = 10) {
        this.maxActive = maxActive;
    }

    /**
     * Add a conversation to the queue with given priority.
     * @param conversation - The conversation to queue
     * @param priority - Priority level (higher = more important, default: 2)
     */
    public enqueue(conversation: ActiveConversation, priority: number = 2): void {
        const item: QueuedConversation = {
            conversation,
            priority,
            queuedAt: Date.now()
        };

        // Insert in sorted position (higher priority first, then FIFO)
        const insertIndex = this.queue.findIndex(q => q.priority < priority);
        if (insertIndex === -1) {
            this.queue.push(item);
        } else {
            this.queue.splice(insertIndex, 0, item);
        }
    }

    /**
     * Remove and return the highest priority conversation.
     */
    public dequeue(): ActiveConversation | null {
        const item = this.queue.shift();
        return item?.conversation || null;
    }

    /**
     * View the highest priority conversation without removing it.
     */
    public peek(): ActiveConversation | null {
        return this.queue[0]?.conversation || null;
    }

    /**
     * Remove a specific conversation from the queue.
     * @returns true if conversation was found and removed
     */
    public remove(conversationId: string): boolean {
        const index = this.queue.findIndex(q => q.conversation.id === conversationId);
        if (index !== -1) {
            this.queue.splice(index, 1);
            return true;
        }
        return false;
    }

    /**
     * Get current queue size.
     */
    public size(): number {
        return this.queue.length;
    }

    /**
     * Check if queue is empty.
     */
    public isEmpty(): boolean {
        return this.queue.length === 0;
    }

    /**
     * Clear all items from the queue.
     */
    public clear(): void {
        this.queue = [];
    }

    /**
     * Get all queued items (for debugging/UI display).
     */
    public getAll(): QueuedConversation[] {
        return [...this.queue];
    }

    /**
     * Boost priority of a conversation (e.g., when user focuses on it).
     * @param conversationId - ID of conversation to boost
     * @param boost - Amount to increase priority by (default: 1)
     */
    public boostPriority(conversationId: string, boost: number = 1): void {
        const index = this.queue.findIndex(q => q.conversation.id === conversationId);
        if (index !== -1) {
            const item = this.queue.splice(index, 1)[0];
            item.priority += boost;
            this.enqueue(item.conversation, item.priority);
        }
    }

    /**
     * Get how long a conversation has been waiting in queue.
     * @returns Wait time in milliseconds, or 0 if not found
     */
    public getWaitTime(conversationId: string): number {
        const item = this.queue.find(q => q.conversation.id === conversationId);
        return item ? Date.now() - item.queuedAt : 0;
    }

    /**
     * Get queue position for a conversation (1-indexed).
     * @returns Position in queue, or -1 if not found
     */
    public getPosition(conversationId: string): number {
        const index = this.queue.findIndex(q => q.conversation.id === conversationId);
        return index !== -1 ? index + 1 : -1;
    }
}
