import type {CaaAnswer, DSAnswer, Packet} from '@leichtgewicht/dns-packet'
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
      [key in DNSClass]? : Array<CaaAnswer> | Array<DSAnswer> | Packet['answers'] | Array<{
        valid : boolean
        value : string
      }>
    } = {}
    if ((dnsResponse.answers as Exclude<Packet['answers'], undefined>).some(dnsRecord => {
      return dnsRecord.type.toLowerCase() !== request.params.class
    })) {
      throw new ApiError('DNS response contains invalid data')
    } else {
      if (request.params.class === 'a' || request.params.class === 'aaaa') {
        records[request.params.class] = (dnsResponse.answers as Exclude<Packet['answers'], undefined>).map(record => {
          return {
            valid: ips.includes(record.data as string),
            value: record.data as string
          }
        })
      } else {
        records[request.params.class] = dnsResponse.answers
        if (request.params.class === 'caa') {
          console.log(request)
        }
      }
      reply.status(200).send(records)
    }
  }, () => {
    throw new ApiError('Failed to query DNS')
  })
}