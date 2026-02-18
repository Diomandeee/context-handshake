/**
 * Context Handshake Protocol
 *
 * Three-phase synchronization for AI-to-AI collaboration
 */
export const PROTOCOL_VERSION = '1.0.0';
export const DEFAULT_CONFIG = {
    timeoutMs: 5000,
    minAlignment: 0.6,
    autoRetry: true,
    maxRetries: 3,
    requireAck: true,
};
