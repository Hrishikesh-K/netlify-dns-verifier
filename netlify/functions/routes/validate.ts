import type {CaaAnswer, DSAnswer, Packet} from '@leichtgewicht/dns-packet'
import type {FastifyReply, FastifyRequest} from 'fastify'
import type {DNSResponse} from '~/@types'
import {query} from 'dns-query'
import {v4} from 'uuid'
import ips from '~/server/data/ips.json'
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
    return Promise.all(['A', 'AAAA', 'CAA', 'CNAME', 'DS', 'NS'].map(dnsClass => {
      if (dnsClass === 'CAA') {
        return Promise.all(request.params.domain.replace(`.${actualSuffix}`, '').split('.').reduce((accumulatedArray, _partOfDomain, partOfDomainIndex, partOfDomainArray) => {
          return accumulatedArray.concat([`${partOfDomainArray.slice(0, partOfDomainIndex + 1).join('.')}.${actualSuffix}`])
        }, [] as Array<string>).map(partOfApex => {
          return query({
            question: {
              name: partOfApex,
              type: 'CAA'
            }
          }, {
            endpoints: ['dns.google']
          }).then(caaResponse => {
            return {
              CAA: caaResponse.answers as Array<CaaAnswer>
            }
          })
        })).then(caaResponses => {
          return caaResponses.reduce((accumulatedCAA, currentCAA) => {
            return {
              CAA: accumulatedCAA.CAA.concat(currentCAA.CAA)
            }
          }, {
            CAA: []
          })
        })
      } else if (!request.params.domain.startsWith('www.') && actualSuffix !== request.params.domain && dnsClass === 'CNAME') {
        return Promise.all([`www.${request.params.domain}`, request.params.domain].map(domain => {
          return query({
            question: {
              name: domain,
              type: 'CNAME'
            }
          }, {
            endpoints: ['dns.google']
          }).then(cnameResponse => {
            return {
              CNAME: cnameResponse.answers as Exclude<Packet['answers'], undefined>
            }
          })
        })).then(cnameResponses => {
          return cnameResponses.reduce((accumulatedCNAME, currentCNAME) => {
            return {
              CNAME: accumulatedCNAME.CNAME.concat(currentCNAME.CNAME)
            }
          }, {
            CNAME: []
          })
        })
      } else {
        return query({
          question: {
            name: request.params.domain,
            type: dnsClass
          }
        }, {
          endpoints: ['dns.google']
        }).then(dnsResponse => {
          return {
            [dnsClass]: dnsResponse.answers as Exclude<Packet['answers'], undefined>
          }
        })
      }
    })).then(dnsResponses => {
      const dns : DNSResponse = {
        valid: true
      }
      dnsResponses.map(dnsResponse => {
        Object.keys(dnsResponse).forEach(dnsClass => {
          switch (dnsClass) {
            case 'A':
            case 'AAAA':
              dns[dnsClass] = dnsResponse[dnsClass]!.map(dnsAnswer => {
                return {
                  id: v4(),
                  domain: dnsAnswer.name,
                  valid: (dnsAnswer.type === 'A' || dnsAnswer.type === 'AAAA') && ips.includes(dnsAnswer.data as string),
                  value: (dnsAnswer.type === 'A' || dnsAnswer.type === 'AAAA') && dnsAnswer.data as string
                }
              })
              break
            case 'CAA':
              dns['CAA'] = (dnsResponse['CAA'] as Array<CaaAnswer>).map(dnsAnswer => {
                return {
                  id: v4(),
                  domain: dnsAnswer.name,
                  valid: dnsAnswer.type === 'CAA' && dnsAnswer.data.flags === 0 && dnsAnswer.data.tag === 'issue' && dnsAnswer.data.value === 'letsencrypt.org',
                  value: dnsAnswer.type === 'CAA' && `${dnsAnswer.data.flags} ${dnsAnswer.data.tag} "${dnsAnswer.data.value}"`
                }
              })
              break
            case 'CNAME':
              dns['CNAME'] = dnsResponse['CNAME']!.map(dnsAnswer => {
                return {
                  id: v4(),
                  domain: dnsAnswer.name,
                  valid: dnsAnswer.type === 'CNAME' && (dnsAnswer.data as string).endsWith('.netlify.app'),
                  value: dnsAnswer.type === 'CNAME' && dnsAnswer.data as string
                }
              })
              break
            case 'DS':
              dns['DS'] = (dnsResponse['DS'] as Array<DSAnswer>).map(dnsAnswer => {
                return {
                  id: v4(),
                  domain: dnsAnswer.name,
                  valid: false,
                  value: dnsAnswer.type === 'DS' && dnsAnswer.data
                }
              })
              break
            case 'NS':
              dns['NS'] = dnsResponse['NS']!.map(dnsAnswer => {
                return {
                  id: v4(),
                  domain: dnsAnswer.name,
                  valid: dnsAnswer.type === 'NS' && /dns[1-4]\.p0[0-9]\.nsone\.net/.test(dnsAnswer.data as string),
                  value: dnsAnswer.type === 'NS' && dnsAnswer.data as string
                }
              })
          }
        })
      })
      reply.status(200).send(dns)
    })
  } else {
    reply.status(200).send({
      valid: false
    })
    return
  }
}