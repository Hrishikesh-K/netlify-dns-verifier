import type {CaaAnswer, Packet} from '@leichtgewicht/dns-packet'
import type {FastifyError, FastifyReply, FastifyRequest} from 'fastify'
import type {HandlerContext, HandlerEvent} from '@netlify/functions'
import type {DNSResponse} from '~/@types'
import awsLambdaFastify from '@fastify/aws-lambda'
import fastify from 'fastify'
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
    app.route({
      attachValidation: true,
      errorHandler: (errorHandlerError : ApiError | FastifyError, errorHandlerRequest, errorHandlerReply) => {
        console.log(errorHandlerError)
        const errorResponse = {
          message: 'Failed to process request because of an unhandled error',
          request_id: errorHandlerRequest.awsLambda.context.awsRequestId
        }
        if (errorHandlerError instanceof ApiError) {
          errorResponse.message = errorHandlerError.message
          errorHandlerReply.status(errorHandlerError.status).send(errorResponse)
        } else {
          errorHandlerReply.status(500).send(errorResponse)
        }
      },
      handler(request : FastifyRequest<{
        Params : {
          domain : string
        }
      }>, reply : FastifyReply) {
        const dnsObject : DNSResponse = {
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
          valid: false
        }
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
          const domainsToCheck = [request.params.domain]
          function isApexDomain(domain : string) {
            return domain.split('.').length - actualSuffix.split('.').length === 1
          }
          if (isApexDomain(request.params.domain)) {
            domainsToCheck.push(`www.${request.params.domain}`)
          } else if (request.params.domain.startsWith('www.') && isApexDomain(request.params.domain.slice(4))) {
            domainsToCheck.push(request.params.domain.slice(4))
          }
          return Promise.all(domainsToCheck.map(domainToCheck => {
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
              } else if (dnsClass === 'NS') {
                return Promise.all([query({
                  question: {
                    name: domainToCheck,
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
                  url: `https://rst.im/dig/${domainToCheck}/8.8.8.8/noshort/trace/`
                }).then((nsTraceResponse : {
                  data : string
                }) => {
                  const digReturnData : Exclude<Packet['answers'], undefined> = [{
                    data: '',
                    name: domainToCheck,
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
                    name: domainToCheck,
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
              const dns : DNSResponse = structuredClone(dnsObject)
              dns.valid = true
              dnsResponses.map(dnsResponse => {
                dnsClasses.forEach(dnsClass => {
                  switch (dnsClass) {
                    case 'A':
                    case 'AAAA':
                      if (dnsResponse[dnsClass]) {
                        dns[dnsClass].records = dnsResponse[dnsClass]!.map(ipAnswer => {
                          const ipReturn : DNSResponse['A']['records'][0] = {
                            id: v4(),
                            domain: ipAnswer.name,
                            valid: false,
                            value: ''
                          }
                          if (ipAnswer.type === 'A' || ipAnswer.type === 'AAAA') {
                            ipReturn.valid = ips.includes(ipAnswer.data)
                            ipReturn.value = ipAnswer.data
                          } else {
                            ipReturn.value = `Received ${ipAnswer.type} response with the value ${ipAnswer.data}`
                          }
                          return ipReturn
                        })
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
                        dns.CAA.valid = dns.CAA.records.length === 0 || dns.CAA.records.some(caaRecord => {
                          return caaRecord.valid
                        })
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
                            cnameReturn.valid = !isApexDomain(cnameAnswer.name) && (cnameAnswer.data.endsWith('netlify.app') || cnameAnswer.data.endsWith(process.env['NETLIFY_HP_CNAME'] || ''))
                            cnameReturn.value = cnameAnswer.data
                          } else {
                            cnameReturn.value = `Received ${cnameAnswer.type} response with the value ${cnameAnswer.data}`
                          }
                          return cnameReturn
                        })
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
                            dsReturn.value = dsAnswer.data
                          } else {
                            dsReturn.value = `Received ${dsAnswer.type} response with the value ${dsAnswer.data}`
                          }
                          return dsReturn
                        })
                        dns.DS.valid = dns.DS.records.length === 0
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
                            const nsRegEx = /dns[1-4]\.p0[0-9]\.nsone\.net/
                            if (nsAnswer.data.startsWith('from: ')) {
                              nsReturn.valid = nsRegEx.test(nsAnswer.data.slice(6))
                            } else {
                              nsReturn.valid = nsRegEx.test(nsAnswer.data)
                            }
                            nsReturn.value = nsAnswer.data
                          } else {
                            nsReturn.value = `Received ${nsAnswer.type} response with the value ${nsAnswer.data}`
                          }
                          return nsReturn
                        })
                        dns.NS.valid = dns.NS.records.length === 5 && dns.NS.records.every(nsRecord => {
                          return nsRecord.valid
                        })
                      }
                      break
                  }
                })
              })
              if (dns.NS.valid) {
                dns.A.valid = dns.A.records.length === 2 && dns.A.records.every(aRecord => {
                  return aRecord.valid
                })
                dns.AAAA.valid = dns.AAAA.records.length === 0 || (dns.AAAA.records.length === 2 && dns.AAAA.records.every(aaaaRecord => {
                  return aaaaRecord.valid
                }))
                dns.CNAME.valid = dns.CNAME.records.length === 0
              } else {
                if (dns.A.records.length === 1) {
                  dns.A.valid = dns.A.records[0] && (dns.A.records[0].value === '75.2.60.5' || dns.A.records[0].value === process.env['NETLIFY_HP_LB']) || false
                } else if (dns.A.records.length === 2) {
                  dns.A.valid = dns.A.records.every(aRecord => {
                    return aRecord.value === '75.2.60.5' || aRecord.value === '99.83.231.61'
                  })
                }
                dns.AAAA.valid = dns.AAAA.records.length === 0
                dns.CNAME.valid = dns.CNAME.records.length === 1 && dns.CNAME.records[0] && dns.CNAME.records[0].valid || false
              }
              return dns
            })
          })).then(domainDns => {
            let firstCheckDone = false
            reply.status(200).send(domainDns.reduce((accumulatedDnsObject, currentDnsObject) => {
              const objectToReturn = {
                A: {
                  records: accumulatedDnsObject.A.records.concat(currentDnsObject.A.records),
                  valid: firstCheckDone ? currentDnsObject.A.valid : accumulatedDnsObject.A.valid && currentDnsObject.A.valid
                },
                AAAA: {
                  records: accumulatedDnsObject.AAAA.records.concat(currentDnsObject.AAAA.records),
                  valid: firstCheckDone ? currentDnsObject.AAAA.valid : accumulatedDnsObject.AAAA.valid && currentDnsObject.AAAA.valid
                },
                CAA: {
                  records: accumulatedDnsObject.CAA.records.concat(currentDnsObject.CAA.records),
                  valid: firstCheckDone ? currentDnsObject.CAA.valid : accumulatedDnsObject.CAA.valid && currentDnsObject.CAA.valid
                },
                CNAME: {
                  records: accumulatedDnsObject.CNAME.records.concat(currentDnsObject.CNAME.records),
                  valid: firstCheckDone ? currentDnsObject.CNAME.valid : accumulatedDnsObject.CNAME.valid && currentDnsObject.CNAME.valid
                },
                DS: {
                  records: accumulatedDnsObject.DS.records.concat(currentDnsObject.DS.records),
                  valid: firstCheckDone ? currentDnsObject.DS.valid : accumulatedDnsObject.DS.valid && currentDnsObject.DS.valid
                },
                NS: {
                  records: accumulatedDnsObject.NS.records.concat(currentDnsObject.NS.records),
                  valid: firstCheckDone ? currentDnsObject.NS.valid : accumulatedDnsObject.NS.valid && currentDnsObject.NS.valid
                },
                valid: true
              }
              firstCheckDone = true
              return objectToReturn
            }, structuredClone(dnsObject)))
          })
        } else {
          reply.status(200).send(dnsObject)
          return
        }
      },
      method: 'GET',
      onRequest: (onRequestRequest, _onRequestReply, onRequestDone) => {
        onRequestRequest.requestTimer = setTimeout(() => {
          onRequestDone(new ApiError('Failed to process request because the API timed out', 504))
        }, onRequestRequest.awsLambda.context.getRemainingTimeInMillis() - 250)
        onRequestDone()
      },
      onResponse: (onResponseRequest, _onResponseReply, onResponseDone) => {
        clearTimeout(onResponseRequest.requestTimer)
        onResponseDone()
      },
      preHandler: (preHandlerRequest, _preHandlerReply, preHandlerDone) => {
        if (preHandlerRequest.validationError) {
          preHandlerDone(new ApiError('Failed to process request because it contains invalid data', 400))
        } else {
          preHandlerDone()
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
      url: '/validate/:domain'
    })
    done()
  }, {
    prefix: '/api'
  })
  return awsLambdaFastify(api)(event, context)
}