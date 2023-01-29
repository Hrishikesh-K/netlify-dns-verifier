import type {Packet} from '@leichtgewicht/dns-packet'
import type {FastifyReply, FastifyRequest} from 'fastify'
import {query} from 'dns-query'
import {ApiError} from '~/server/data/constants'
import ips from '~/server/data/ips.json'
type DNSClass = 'a' | 'aaaa' | 'caa' | 'cname' | 'ds' | 'ns'
export default function (request : FastifyRequest<{
  Params : {
    class : DNSClass
    domain : string
  }
}>, reply : FastifyReply) {
  query({
    question: {
      name: request.params.domain,
      type: request.params.class.toUpperCase()
    }
  }, {
    endpoints: ['dns.google']
  }).then(dnsResponse => {
    const records : {
      [key in DNSClass]? : Packet['answers']
    } = {}
    records[request.params.class] = dnsResponse.answers
    if (request.params.class === 'a' || request.params.class === 'aaaa') {
      reply.status(200).send({
        records: (records[request.params.class] as Exclude<Packet['answers'], undefined>).map(record => {
          return {
            valid: ips.includes(record.data as string),
            value: record.data
          }
        })
      })
    } else {
      reply.status(200).send(records)
    }
  }, () => {
    throw new ApiError('Failed to query DNS')
  })
}