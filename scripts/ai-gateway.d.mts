import type { IncomingMessage, ServerResponse } from 'node:http'

export declare const DEFAULT_UPSTREAM: string
export declare const DEFAULT_MODEL: string

export interface AiGatewayConfig {
  upstream: string
  apiKey: string
  model: string
  open: boolean
}

export interface AiGatewayOptions {
  upstream?: string
  apiKey?: string
  model?: string
  open?: boolean
}

export declare function resolveGatewayConfig(
  env?: NodeJS.ProcessEnv,
): AiGatewayConfig

type Handler = (
  req: IncomingMessage,
  res: ServerResponse,
  next?: () => void,
) => Promise<void>

export declare function createAiGateway(options?: AiGatewayOptions): Handler
export declare function createAiGatewayMiddleware(options?: AiGatewayOptions): Handler
export declare function startAiGatewayServer(
  options?: AiGatewayOptions & { port?: number },
): import('node:http').Server
