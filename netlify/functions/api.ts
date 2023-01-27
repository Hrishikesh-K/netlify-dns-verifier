import type {HandlerContext, HandlerEvent} from '@netlify/functions'
import type {RouteOptions} from 'fastify'
import awsLambdaFastify from '@fastify/aws-lambda'
import fastify from 'fastify'
import {ApiError} from '~/server/data/constants'
import dns from '~/server/routes/dns'
import validate from '~/server/routes/validate'
export async function handler(event : HandlerEvent, context : HandlerContext) {
  const api = fastify({
    ignoreTrailingSlash: true,
    ignoreDuplicateSlashes: true
  })
  api.register((app, _options, done) => {
    const commonRouteOptions : RouteOptions = {
      attachValidation: true,
      errorHandler: (error, request, reply) => {
        reply.status(error instanceof ApiError ? error.status : 500).send({
          message: error.message,
          request_id: request.awsLambda.context.awsRequestId
        })
      },
      handler: () => {},
      method: 'GET',
      preHandler: (request, _reply, next) => {
        if (request.validationError) {
          throw new ApiError('Failed to process request because it contains invalid data', 400)
        } else {
          next()
        }
      },
      schema: {
        params: {
          properties: {
            class: {
              enum: ['a', 'aaaa', 'caa', 'cname', 'ds', 'ns'],
              type: 'string'
            },
            domain: {
              pattern: '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9][a-z0-9-]{0,61}[a-z0-9]$',
              type: 'string'
            }
          },
          type: 'object'
        }
      },
      url: ''
    }
    app.route({
      ...commonRouteOptions,
      handler: dns,
      url: '/dns/:class/:domain'
    })
    app.route({
      ...commonRouteOptions,
      handler: validate,
      url: '/validate/:domain'
    })
    done()
  }, {
    prefix: '/api'
  })
  return awsLambdaFastify(api)(event, context)
}