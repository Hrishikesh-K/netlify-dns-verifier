import type {AxiosError} from 'axios'
import axios from 'axios'
import {readFileSync, writeFileSync} from 'fs'
import {supabaseClient} from '~/server/data/constants'
export async function handler() {
  return axios({
    responseType: 'text',
    url: 'https://publicsuffix.org/list/public_suffix_list.dat'
  }).then((listDataResponse : {
    data : string
  }) => {
    writeFileSync('/tmp/suffixes.json', JSON.stringify({
      suffixes: listDataResponse.data.split('\n').filter(line => {
        if (line.startsWith('*.')) {
          return line.slice(2)
        } else {
          return line.length > 0 && !line.startsWith('//')
        }
      })
    }))
    return supabaseClient.storage.from('mdn-public-suffix-list').update('suffixes.json', readFileSync('/tmp/suffixes.json')).then(updateFileResponse => {
      if (updateFileResponse.error) {
        console.error('Failed to update the list in the storage bucket', updateFileResponse.error)
        return {
          statusCode: 500
        }
      } else {
        console.log('Process successfully completed')
        return {
          statusCode: 200
        }
      }
    })
  }, (listDataError : AxiosError) => {
    console.error('Failed to fetch the list from MDN', listDataError)
    return {
      statusCode: 500
    }
  })
}