import type {HandlerContext, HandlerEvent} from '@netlify/functions'
declare module 'fastify' {
  export interface FastifyRequest {
    awsLambda : {
      context : HandlerContext
      event : HandlerEvent
    }
  }
}