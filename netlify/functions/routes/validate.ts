import type {FastifyReply, FastifyRequest} from 'fastify'
import {supabaseClient} from '~/server/data/constants'
import {ApiError} from '~/server/data/constants'
export default function (request : FastifyRequest<{
  Params : {
    domain : string
  }
}>, reply : FastifyReply) {
  supabaseClient.storage.from('mdn-public-suffix-list').download('suffixes.json').then(downloadFileResponse => {
    if (downloadFileResponse.error) {
      throw new ApiError('Failed to download public suffix list')
    } else {
      downloadFileResponse.data.text().then(jsonData => {
        const filteredSuffixes = (JSON.parse(jsonData).suffixes as Array<string>).filter(suffix => {
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
      }, () => {
        throw new ApiError('Failed to parse the list from the storage bucket')
      })
    }
  })
}