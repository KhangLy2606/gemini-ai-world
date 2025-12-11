
/**
 * Chat Orchestrator Module
 * 
 * Central system for managing multi-agent conversations in the Minion AI World.
 * 
 * @example
 * ```typescript
 * import { ChatOrchestrator } from './src/orchestrator';
 * 
 * const orchestrator = new ChatOrchestrator({
 *   enableMockMode: true,
 *   maxConcurrentConversations: 10
 * });
 * 
 * orchestrator.on('conversation:updated', (data) => {
 *   console.log('Conversation updated:', data);
 * });
 * 
 * orchestrator.start();
 * orchestrator.requestConversation('agent1', 'agent2', { userInitiated: true });
 * ```
 */

export { ChatOrchestrator } from './ChatOrchestrator';
export type { OrchestratorConfig, OrchestratorEventType } from './ChatOrchestrator';
export { ConversationQueue } from './ConversationQueue';
export { ConversationStore } from './ConversationStore';
export { RouterService } from './RouterService';
export type { RouterMode, StreamingUpdate } from './RouterService';
