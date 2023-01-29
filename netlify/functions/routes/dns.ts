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
  return query({
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
    let receivedClass : string = ''
    if ((dnsResponse.answers as Exclude<Packet['answers'], undefined>).some(dnsRecord => {
      receivedClass = dnsRecord.type
      return dnsRecord.type !== request.params.class.toUpperCase()
    })) {
      throw new ApiError(`Requested ${request.params.class.toUpperCase()} but received ${receivedClass} response`, 'dns_class_validation', 400)
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
      }
      reply.status(200).send(records)
    }
  }, () => {
    throw new ApiError('Failed to query DNS')
  })
}