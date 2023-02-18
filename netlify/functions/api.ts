import type {CaaAnswer, Packet} from '@leichtgewicht/dns-packet'
import type {HandlerContext, HandlerEvent} from '@netlify/functions'
import type {RouteOptions} from 'fastify'
import type {DNSResponse} from '~/@types'
import awsLambdaFastify from '@fastify/aws-lambda'
import fastify, {FastifyReply, FastifyRequest} from 'fastify'
import {query} from 'dns-query'
import axios from 'axios'
import {v4} from 'uuid'
import {ApiError} from '~/server/data/constants'
import ips from '~/server/data/ips.json'
import suffixes from '~/server/data/suffixes.json'
export async function handler(event : HandlerEvent, context : HandlerContext) {
  const api = fastify({
    ignoreTrailingSlash: true,
    ignoreDuplicateSlashes: true
  })
  api.register((app, _options, done) => {
    const commonRouteOptions : RouteOptions = {
      attachValidation: true,
      errorHandler: (error, request, reply) => {
        if (error instanceof ApiError) {
          reply.status(error.status).send({
            message: error.message,
            request_id: request.awsLambda.context.awsRequestId
          })
        } else {
          reply.status(500).send({
            message: 'Failed to process request because of an unhandled error',
            request_id: request.awsLambda.context.awsRequestId
          })
        }
      },
      handler: () => {},
      method: 'GET',
      preHandler: (request, _reply, next) => {
        if (request.validationError) {
          throw new ApiError('Failed to process request because it contains invalid data', 'params_validation', 400)
        } else {
          next()
        }
      },
      schema: {
        params: {
          properties: {
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
      handler(request : FastifyRequest<{
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
          const dnsClasses = ['A', 'AAAA', 'CAA', 'CNAME', 'DS', 'NS']
          return Promise.all(dnsClasses.map(dnsClass => {
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
                return nsResponse.answers as Exclude<Packet['answers'], undefined>
              }), axios({
                params: {
                  type: 'NS'
                },
                responseType: 'text',
                url: `https://rst.im/dig/${request.params.domain}/8.8.8.8/noshort/trace/`
              }).then((nsTraceResponse : {
                data : string
              }) => {
                const digReturnData : Exclude<Packet['answers'], undefined> = [{
                  data: '',
                  name: request.params.domain,
                  type: 'NS'
                }]
                const dataWithinCodeBlock = nsTraceResponse.data.trim().match(/^<pre><code>([\S\s]*?)<\/code><\/pre>/m)
                if (dataWithinCodeBlock) {
                  const lastDigLine = dataWithinCodeBlock[0].trim().split('\n').slice(-3, -2)[0]
                  if (lastDigLine) {
                    const answerFromLine = lastDigLine.trim().match(/\(.*\)/)
                    if (answerFromLine && digReturnData[0]) {
                      digReturnData[0].data = `from: ${answerFromLine[0].slice(1, -1)}`
                      return digReturnData
                    } else {
                      return digReturnData
                    }
                  } else {
                    return digReturnData
                  }
                } else {
                  return digReturnData
                }
              })]).then(nsResponses => {
                return {
                  NS: nsResponses[0].concat(nsResponses[1])
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
              dnsClasses.forEach(dnsClass => {
                switch (dnsClass) {
                  case 'A':
                    if (dnsResponse['A']) {
                      dns.A.records = dnsResponse['A'].map(aAnswer => {
                        const aReturn : DNSResponse['A']['records'][0] = {
                          id: v4(),
                          domain: aAnswer.name,
                          valid: false,
                          value: ''
                        }
                        if (aAnswer.type === 'A') {
                          aReturn.valid = ips.includes(aAnswer.data as string)
                          aReturn.value = aAnswer.data as string
                        } else {
                          aReturn.value = `Received ${aAnswer.type} response with the value ${aAnswer.data}`
                        }
                        return aReturn
                      })
                      if (dns.A.records.length === 1) {
                        if (dns.A.records[0]!.value === '75.2.60.5' || dns.A.records[0]!.value === process.env['NETLIFY_HP_LB']) {
                          dns.A.valid = true
                        }
                      } else if (dns.A.records.length === 2 && dns.A.records.every(aRecord => {
                        return aRecord.valid
                      })) {
                        dns.A.valid = true
                      }
                    }
                    break
                  case 'AAAA':
                    if (dnsResponse['AAAA']) {
                      dns.AAAA.records = dnsResponse['AAAA'].map(aaaaAnswer => {
                        const aaaaReturn : DNSResponse['AAAA']['records'][0] = {
                          id: v4(),
                          domain: aaaaAnswer.name,
                          valid: false,
                          value: ''
                        }
                        if (aaaaAnswer.type === 'AAAA') {
                          aaaaReturn.valid = ips.includes(aaaaAnswer.data as string)
                          aaaaReturn.value = aaaaAnswer.data as string
                        } else {
                          aaaaReturn.value = `Received ${aaaaAnswer.type} response with the value ${aaaaAnswer.data}`
                        }
                        return aaaaReturn
                      })
                      if (dns.AAAA.records.length === 0 || (dns.AAAA.records.length === 2 && dns.AAAA.records.every(aaaaRecord => {
                        return aaaaRecord.valid
                      }))) {
                        dns.AAAA.valid = true
                      }
                    }
                    break
                  case 'CAA':
                    if (dnsResponse['CAA']) {
                      dns.CAA.records = dnsResponse['CAA'].map(caaAnswer => {
                        const caaReturn : DNSResponse['CAA']['records'][0] = {
                          id: v4(),
                          domain: caaAnswer.name,
                          valid: false,
                          value: ''
                        }
                        if (caaAnswer.type === 'CAA') {
                          caaReturn.valid = caaAnswer.data.flags === 0 && caaAnswer.data.tag === 'issue' && caaAnswer.data.value === 'letsencrypt.org'
                          caaReturn.value = `${caaAnswer.data.flags} ${caaAnswer.data.tag} "${caaAnswer.data.value}"`
                        } else {
                          caaReturn.value = `Received ${caaAnswer.type} response with the value ${caaAnswer.data}`
                        }
                        return caaReturn
                      })
                      if (dns.CAA.records.length === 0 || dns.CAA.records.some(caaRecord => {
                        return caaRecord.valid
                      })) {
                        dns.CAA.valid = true
                      }
                    }
                    break
                  case 'CNAME':
                    if (dnsResponse['CNAME']) {
                      dns.CNAME.records = dnsResponse['CNAME'].map(cnameAnswer => {
                        const cnameReturn : DNSResponse['CNAME']['records'][0] = {
                          id: v4(),
                          domain: cnameAnswer.name,
                          valid: false,
                          value: ''
                        }
                        if (cnameAnswer.type === 'CNAME') {
                          cnameReturn.valid = (cnameAnswer.data as string).endsWith('netlify.app') || (cnameAnswer.data as string).endsWith(process.env['NETLIFY_HP_CNAME'] || '')
                          cnameReturn.value = cnameAnswer.data as string
                        } else {
                          cnameReturn.value = `Received ${cnameAnswer.type} response with the value ${cnameAnswer.data}`
                        }
                        return cnameReturn
                      })
                      if (isApexDomain) {
                        if (dns.CNAME.records.length === 0) {
                          dns.CNAME.valid = true
                        }
                      } else if (dns.CNAME.records.length === 1 && dns.CNAME.records.every(cnameRecord => {
                        return cnameRecord.valid
                      })) {
                        dns.CNAME.valid = true
                      }
                    }
                    break
                  case 'DS':
                    if (dnsResponse['DS']) {
                      dns.DS.records = dnsResponse['DS'].map(dsAnswer => {
                        const dsReturn : DNSResponse['DS']['records'][0] = {
                          id: v4(),
                          domain: dsAnswer.name,
                          valid: false,
                          value: ''
                        }
                        if (dsAnswer.type === 'DS') {
                          dsReturn.value && dsAnswer.data
                          console.log(dsReturn.value)
                        } else {
                          dsReturn.value = `Received ${dsAnswer.type} response with the value ${dsAnswer.data}`
                        }
                        return dsReturn
                      })
                      if (dns.DS.records.length === 0) {
                        dns.DS.valid = true
                      }
                    }
                    break
                  case 'NS':
                    if (dnsResponse['NS']) {
                      dns.NS.records = dnsResponse['NS'].map(nsAnswer => {
                        const nsReturn : DNSResponse['NS']['records'][0] = {
                          id: v4(),
                          domain: nsAnswer.name,
                          valid: false,
                          value: ''
                        }
                        if (nsAnswer.type === 'NS') {
                          if ((nsAnswer.data as string).startsWith('from: ')) {
                            nsReturn.valid = /dns[1-4]\.p0[0-9]\.nsone\.net/.test(nsAnswer.data.slice(6))
                          } else {
                            nsReturn.valid = /dns[1-4]\.p0[0-9]\.nsone\.net/.test(nsAnswer.data)
                          }
                          nsReturn.value = nsAnswer.data
                        } else {
                          nsReturn.value = `Received ${nsAnswer.type} response with the value ${nsAnswer.data}`
                        }
                        return nsReturn
                      })
                      if (dns.NS.records.length === 5 && dns.NS.records.every(nsRecord => {
                        return nsRecord.valid
                      })) {
                        dns.NS.valid = true
                      }
                    }
                    break
                }
              })
            })
            if (dns.NS.valid && dns.A.records.some(aRecord => {
              return aRecord.value === '75.2.60.5' || aRecord.value === '99.83.231.61' || aRecord.value === process.env['NETLIFY_HP_LB']
            })) {
              dns.A.valid = false
            }
            if (dns.A.valid && dns.AAAA.valid && dns.NS.valid && dns.CNAME.records.length > 0) {
              dns.CNAME.valid = false
            }
            reply.status(200).send(dns)
          })
        } else {
          reply.status(200).send({
            valid: false
          })
          return
        }
      },
      url: '/validate/:domain'
    })
    done()
  }, {
    prefix: '/api'
  })
  return awsLambdaFastify(api)(event, context)
}