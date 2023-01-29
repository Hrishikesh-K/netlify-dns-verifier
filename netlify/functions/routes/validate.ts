import type {FastifyReply, FastifyRequest} from 'fastify'
import suffixes from '~/server/data/suffixes.json'
export default function (request : FastifyRequest<{
  Params : {
    domain : string
  }
}>, reply : FastifyReply) {
  const filteredSuffixes = suffixes.filter(suffix => {
    return request.params.domain.endsWith(`.${suffix}`)
  })
  const actualSuffix = filteredSuffixes.reduce((currentLongestDomain, currentDomain) => {
    if (currentLongestDomain.length > currentDomain.length) {
      return currentLongestDomain
    } else {
      return currentDomain
    }
  }, '')
  if (filteredSuffixes.length > 0) {
    reply.status(200).send({
      apex: request.params.domain.split('.').length - actualSuffix.split('.').length === 1,
      suffix: actualSuffix,
      valid: true
    })
  } else {
    reply.status(200).send({
      valid: false
    })
  }
}