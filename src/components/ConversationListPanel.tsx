import React from 'react';
import { ActiveConversation } from '../../types';
import { useOrchestrator } from './ChatOrchestratorProvider';

interface Props {
    onSelectConversation: (conversation: ActiveConversation) => void;
    selectedConversationId?: string;
    className?: string;
}

/**
 * UI panel displaying all active conversations.
 * Shows conversation participants, status, duration, and message preview.
 * Supports selection for detailed view.
 */
export const ConversationListPanel: React.FC<Props> = ({ 
    onSelectConversation,
    selectedConversationId,
    className = ''
}) => {
    const { conversations, stats } = useOrchestrator();

    const activeConvs = conversations.filter(c => 
        c.status !== 'completed' && c.status !== 'error'
    );

    const getStatusColor = (status: string): string => {
        switch (status) {
            case 'streaming': return 'bg-emerald-500';
            case 'generating': return 'bg-yellow-500';
            case 'initializing': return 'bg-blue-500';
            case 'completed': return 'bg-gray-500';
            case 'error': return 'bg-red-500';
            default: return 'bg-gray-400';
        }
    };

    const getStatusLabel = (status: string): string => {
        switch (status) {
            case 'streaming': return 'Live';
            case 'generating': return 'Starting...';
            case 'initializing': return 'Connecting';
            case 'completed': return 'Done';
            case 'error': return 'Error';
            default: return status;
        }
    };

    const formatDuration = (startTime: number): string => {
        const seconds = Math.floor((Date.now() - startTime) / 1000);
        if (seconds < 60) return `${seconds}s`;
        const minutes = Math.floor(seconds / 60);
        return `${minutes}m ${seconds % 60}s`;
    };

    const handleKeyDown = (
        event: React.KeyboardEvent, 
        conversation: ActiveConversation
    ) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onSelectConversation(conversation);
        }
    };

    return (
        <div className={`bg-gray-900 border border-gray-800 rounded-lg overflow-hidden ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/80">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-white text-sm">
                        Active Conversations
                    </h3>
                    <span className="text-xs text-emerald-400 bg-emerald-900/30 px-2 py-0.5 rounded">
                        {activeConvs.length} active
                    </span>
                </div>
            </div>

            {/* Conversation List */}
            <div className="max-h-64 overflow-y-auto custom-scrollbar">
                {activeConvs.length === 0 ? (
                    <div className="p-4 text-center text-gray-500 text-sm">
                        <div className="w-8 h-8 mx-auto mb-2 rounded-full border-2 border-dashed border-gray-700 flex items-center justify-center">
                            💬
                        </div>
                        <p>No active conversations</p>
                        <p className="text-xs text-gray-600 mt-1">
                            Click an agent and "Initiate Protocol" to start
                        </p>
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-800" role="listbox">
                        {activeConvs.map(conv => {
                            const isSelected = selectedConversationId === conv.id;
                            return (
                                <li 
                                    key={conv.id}
                                    onClick={() => onSelectConversation(conv)}
                                    onKeyDown={(e) => handleKeyDown(e, conv)}
                                    className={`
                                        p-3 cursor-pointer transition-colors
                                        ${isSelected 
                                            ? 'bg-emerald-900/20 border-l-2 border-emerald-500' 
                                            : 'hover:bg-gray-800/50 border-l-2 border-transparent'}
                                    `}
                                    role="option"
                                    tabIndex={0}
                                    aria-selected={isSelected}
                                >
                                    {/* Status & Participants */}
                                    <div className="flex items-center gap-2 mb-1">
                                        <span 
                                            className={`w-2 h-2 rounded-full ${getStatusColor(conv.status)} ${
                                                conv.status === 'streaming' ? 'animate-pulse' : ''
                                            }`} 
                                            aria-label={`Status: ${getStatusLabel(conv.status)}`}
                                        />
                                        <span className="text-white text-sm font-medium truncate flex-1">
                                            {conv.participants.map(p => p.name).join(' ↔ ')}
                                        </span>
                                        <span className="text-[10px] text-gray-500 uppercase">
                                            {getStatusLabel(conv.status)}
                                        </span>
                                    </div>

                                    {/* Topic & Duration */}
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span className="truncate max-w-[150px]">
                                            {conv.topic || 'General chat'}
                                        </span>
                                        <span className="text-gray-600">
                                            {formatDuration(conv.startTime)}
                                        </span>
                                    </div>

                                    {/* Message Preview */}
                                    {conv.messages.length > 0 && (
                                        <p className="text-xs text-gray-400 mt-1.5 truncate">
                                            <span className="text-gray-600">"</span>
                                            {conv.messages[conv.messages.length - 1].text}
                                            <span className="text-gray-600">"</span>
                                        </p>
                                    )}

                                    {/* Streaming/Typing Indicator */}
                                    {conv.partialMessage && (
                                        <div className="flex items-center gap-1.5 mt-1.5">
                                            <div className="flex gap-0.5">
                                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '100ms' }} />
                                                <span className="w-1 h-1 rounded-full bg-emerald-400 animate-bounce" style={{ animationDelay: '200ms' }} />
                                            </div>
                                            <span className="text-xs text-emerald-400">
                                                {conv.partialMessage.senderName} is typing...
                                            </span>
                                        </div>
                                    )}
                                </li>
                            );
                        })}
                    </ul>
                )}
            </div>

            {/* Stats Footer */}
            <div className="px-4 py-2 border-t border-gray-800 bg-gray-900/80 flex justify-between text-xs text-gray-500">
                <span>
                    {stats.queuedConversations > 0 
                        ? `${stats.queuedConversations} queued` 
                        : 'No queue'}
                </span>
                <span>
                    {stats.completed} completed
                </span>
            </div>
        </div>
    );
};
