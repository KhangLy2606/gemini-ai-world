import { z } from 'zod';

export const StreamStartResponseSchema = z.object({
  conversationId: z.string().regex(/^conv-\d+-[\w-]+$/),
  requestId: z.string().uuid(),
  senderId: z.string().min(1).max(100),
  senderName: z.string().max(100),
  estimatedLength: z.number().int().positive().optional(),
});

export const MessageChunkSchema = z.object({
  conversationId: z.string().regex(/^conv-\d+-[\w-]+$/),
  requestId: z.string().uuid(),
  chunk: z.string().max(500),
  chunkIndex: z.number().int().min(0).max(1000),
  isComplete: z.boolean(),
  accumulatedText: z.string().max(2000).optional(),
});

export const StreamCompleteResponseSchema = z.object({
  conversationId: z.string().regex(/^conv-\d+-[\w-]+$/),
  requestId: z.string().uuid(),
  finalMessage: z.object({
    senderId: z.string().max(100),
    senderName: z.string().max(100),
    text: z.string().max(2000),
    timestamp: z.number().positive(),
  }),
  success: z.boolean(),
  totalChunks: z.number().int().min(0),
  duration: z.number().positive().optional(),
  messageHash: z.string().max(64).optional(), // SHA-256 hex string for integrity
});

export const StreamErrorResponseSchema = z.object({
  conversationId: z.string().regex(/^conv-\d+-[\w-]+$/),
  requestId: z.string().uuid(),
  error: z.string().max(500),
  errorCode: z.enum(['api_error', 'timeout', 'rate_limit', 'validation_error', 'unknown']),
  fallbackMessage: z.object({
    senderId: z.string().max(100),
    senderName: z.string().max(100),
    text: z.string().max(2000),
    timestamp: z.number().positive(),
  }).optional(),
  canRetry: z.boolean(),
  retryAfter: z.number().int().positive().optional(),
});

export const StreamCancelledResponseSchema = z.object({
  conversationId: z.string().regex(/^conv-\d+-[\w-]+$/),
  requestId: z.string().uuid(),
  reason: z.enum(['timeout', 'server_shutdown', 'rate_limit', 'user_cancelled']),
});

export const GenerateMessageRequestSchema = z.object({
  conversationId: z.string().regex(/^conv-\d+-[\w-]+$/),
  agentA: z.object({
    id: z.string().min(1).max(100),
    name: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
    job: z.string().max(50).optional(),
  }),
  agentB: z.object({
    id: z.string().min(1).max(100),
    name: z.string().max(100).optional(),
    bio: z.string().max(500).optional(),
    job: z.string().max(50).optional(),
  }),
  conversationHistory: z.array(z.object({
    senderId: z.string().max(100),
    senderName: z.string().max(100),
    text: z.string().max(1000),
    timestamp: z.number().positive(),
  })).max(50), // Limit history size
  turn: z.enum(['agentA', 'agentB']),
  messageCount: z.number().int().min(0).max(100),
  streaming: z.boolean().optional().default(true),
  timestamp: z.number().positive(), // For replay protection
  nonce: z.string().uuid(), // For replay protection
});
