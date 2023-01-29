import type {AxiosError} from 'axios'
import axios from 'axios'
export async function handler() {
  return axios({
    headers: {
      authorization: `Bearer ${process.env['NETLIFY_TOKEN']}`
    },
    method: 'post',
    url: `https://api.netlify.com/api/v1/sites/${process.env['NETLIFY_SITE_ID']}/builds`
  }).then(() => {
    return {
      statusCode: 200
    }
  }, (buildTriggerError : AxiosError) => {
    console.log('Error triggering build:', buildTriggerError)
    return {
      statusCode: 500
    }
  })
}