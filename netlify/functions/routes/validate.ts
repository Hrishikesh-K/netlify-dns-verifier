import type {Answer, CaaAnswer, DSAnswer, Packet} from '@leichtgewicht/dns-packet'
import type {FastifyReply, FastifyRequest} from 'fastify'
import type {DNSResponse} from '~/@types'
import commandExists from 'command-exists'
import {query} from 'dns-query'
import {spawn} from 'child_process'
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
  if (filteredSuffixes.length > 0) {
    const actualSuffix = filteredSuffixes.reduce((currentLongestDomain, currentDomain) => {
      if (currentLongestDomain.length > currentDomain.length) {
        return currentLongestDomain
      } else {
        return currentDomain
      }
    }, '')
    const isApexDomain = request.params.domain.split('.').length - actualSuffix.split('.').length === 1
    return Promise.all(['A', 'AAAA', 'CAA', 'CNAME', 'DS', 'NS'].map(dnsClass => {
      if (dnsClass === 'CAA') {
        const apexDomain = request.params.domain.split('.').slice(-actualSuffix.split('.').length - 1).join('.')
        return Promise.all(request.params.domain.replace(`.${apexDomain}`, '').split('.').reduce((accumulatedArray, _partOfDomain, partOfDomainIndex, partOfDomainArray) => {
          return accumulatedArray.concat([`${partOfDomainArray.slice(0, partOfDomainIndex + 1).join('.')}.${apexDomain}`])
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
      } else if (!request.params.domain.startsWith('www.') && isApexDomain && dnsClass === 'CNAME') {
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
      } else if (dnsClass === 'NS') {
        return Promise.all([query({
          question: {
            name: request.params.domain,
            type: 'NS'
          }
        }, {
          endpoints: ['dns.google']
        }).then(nsResponse => {
          return nsResponse.answers
        }), new Promise<Array<Answer & {
          root : Boolean
        }>>(resolve => {
          return commandExists('dig').then(digExists => {
            let commandToExecute
            if (digExists) {
              commandToExecute = 'dig'
            } else {
              commandToExecute = './data/bin/dig'
            }
            const dig = spawn(commandToExecute, ['NS', '+tries=1', '+trace', request.params.domain])
            let digOutput = ''
            dig.stdout.on('data', stdout => {
              digOutput += stdout
            })
            dig.on('close', () => {
              resolve([{
                data: ((digOutput.trim().split('\n').slice(-1)[0] || '').match(/\(.*\)/) || [])[0]?.slice(1, -1) || '',
                name: request.params.domain,
                root: true,
                type: 'NS'
              }])
            })
          })
        })]).then(nsResponses => {
          return {
            NS: (nsResponses[0] || []).concat(nsResponses[1])
          }
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
        A: {
          records: [],
          valid: false
        },
        AAAA: {
          records: [],
          valid: false
        },
        CAA: {
          records: [],
          valid: false
        },
        CNAME: {
          records: [],
          valid: false
        },
        DS: {
          records: [],
          valid: false
        },
        NS: {
          records: [],
          valid: false
        },
        valid: true
      }
      dnsResponses.map(dnsResponse => {
        Object.keys(dnsResponse).forEach(dnsClass => {
          switch (dnsClass) {
            case 'A':
              dns.A.records = dnsResponse['A']!.map(aAnswer => {
                return {
                  id: v4(),
                  domain: aAnswer.name,
                  valid: aAnswer.type === 'A' && ips.includes(aAnswer.data as string),
                  value: aAnswer.type === 'A' && aAnswer.data as string
                }
              })
              if (dns.A.records.length > 0 && dns.A.records.length < 3 && dns.A.records.every(aRecord => {
                return aRecord.valid
              })) {
                dns.A.valid = true
              }
              break
            case 'AAAA':
              dns.AAAA.records = dnsResponse['AAA']!.map(aaaaAnswer => {
                return {
                  id: v4(),
                  domain: aaaaAnswer.name,
                  valid: aaaaAnswer.type === 'AAAA' && ips.includes(aaaaAnswer.data as string),
                  value: aaaaAnswer.type === 'AAAA' && aaaaAnswer.data as string
                }
              })
              if (dns.AAAA.records.length === 0 || (dns.AAAA.records.length < 3 && dns.AAAA.records.every(aaaaRecord => {
                return aaaaRecord.valid
              }))) {
                dns.AAAA.valid = true
              }
              break
            case 'CAA':
              dns.CAA.records = (dnsResponse['CAA'] as Array<CaaAnswer>).map(caaAnswer => {
                return {
                  id: v4(),
                  domain: caaAnswer.name,
                  valid: caaAnswer.type === 'CAA' && caaAnswer.data.flags === 0 && caaAnswer.data.tag === 'issue' && caaAnswer.data.value === 'letsencrypt.org',
                  value: caaAnswer.type === 'CAA' && `${caaAnswer.data.flags} ${caaAnswer.data.tag} "${caaAnswer.data.value}"`
                }
              })
              if (dns.CAA.records.length === 0 || dns.CAA.records.some(caaRecord => {
                return caaRecord.valid
              })) {
                dns.CAA.valid = true
              }
              break
            case 'CNAME':
              dns.CNAME.records = dnsResponse['CNAME']!.map(cnameAnswer => {
                return {
                  id: v4(),
                  domain: cnameAnswer.name,
                  valid: cnameAnswer.type === 'CNAME' && (cnameAnswer.data as string).endsWith('.netlify.app'),
                  value: cnameAnswer.type === 'CNAME' && cnameAnswer.data as string
                }
              })
              if (isApexDomain && dns.CNAME.records.length === 0) {
                dns.CNAME.valid = true
              } else if (!isApexDomain && dns.CNAME.records.length === 1 && dns.CNAME.records.every(cnameRecord => {
                return cnameRecord.valid
              })) {
                dns.CNAME.valid = true
              }
              break
            case 'DS':
              dns.DS.records = (dnsResponse['DS'] as Array<DSAnswer>).map(dsAnswer => {
                return {
                  id: v4(),
                  domain: dsAnswer.name,
                  valid: false,
                  value: dsAnswer.type === 'DS' && dsAnswer.data
                }
              })
              if (dns.DS.records.length === 0) {
                dns.DS.valid = true
              }
              break
            case 'NS':
              dns.NS.records = dnsResponse['NS']!.map((nsAnswer) => {
                const nsReturnObject = {
                  id: v4(),
                  domain: nsAnswer.name,
                  valid: nsAnswer.type === 'NS' && /dns[1-4]\.p0[0-9]\.nsone\.net/.test(nsAnswer.data as string),
                  value: nsAnswer.type === 'NS' && nsAnswer.data as string
                }
                // @ts-ignore
                if (nsAnswer.root) {
                  nsReturnObject.value = `from: ${nsAnswer.data}`
                  return nsReturnObject
                } else {
                  return nsReturnObject
                }
              })
              if (dns.NS.records.length === 5 && dns.NS.records.every(nsRecord => {
                return nsRecord.valid
              })) {
                dns.NS.valid = true
              }
              break
          }
        })
      })
      if (dns.NS.valid && dns.A.records.some(aRecord => {
        return aRecord.value === '75.2.60.5' || aRecord.value === '99.83.231.61'
      })) {
        dns.A.valid = false
      }
      if (dns.A.valid && dns.AAAA.valid && dns.NS.valid && dns.CNAME.records.length > 0) {
        dns.CNAME.valid = false
      }
      reply.status(200).send(dns)
    }).catch(error => {
      console.log(error)
    })
  } else {
    reply.status(200).send({
      valid: false
    })
    return
  }
}
// lucaubiali.it - CNAME shows invalid