import axios from 'axios'
import {cwd} from 'process'
import {resolve} from 'path'
import {writeFileSync} from 'fs'
/**
 * @param {import('@netlify/build').NetlifyPluginOptions} plugin
 */
async function updateFiles(plugin) {
  const workingDir = resolve(cwd())
  const functionsDir = resolve(workingDir, plugin.constants.FUNCTIONS_SRC)
  const ipPath = resolve(functionsDir, './data/ips.json')
  const suffixesPath = resolve(functionsDir, './data/suffixes.json')
  await Promise.all([new Promise((resolve, reject) => {
    axios({
      headers: {
        accept: 'application/vnd.github.raw',
        authorization: `Bearer ${process.env['GITHUB_PAT']}`
      },
      responseType: 'text',
      url: `https://api.github.com/repos/${process.env['GITHUB_OWNER']}/${process.env['GITHUB_REPO']}/contents/${process.env['GITHUB_FILE']}`
    }).then(githubResponse => {
      const ips = []
      for (const ipMatch of githubResponse.data.matchAll(/(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?:(?:[a-fA-F\d]{1,4}:){7}(?:[a-fA-F\d]{1,4}|:)|(?:[a-fA-F\d]{1,4}:){6}(?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|:[a-fA-F\d]{1,4}|:)|(?:[a-fA-F\d]{1,4}:){5}(?::(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,2}|:)|(?:[a-fA-F\d]{1,4}:){4}(?:(?::[a-fA-F\d]{1,4})?:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,3}|:)|(?:[a-fA-F\d]{1,4}:){3}(?:(?::[a-fA-F\d]{1,4}){0,2}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,4}|:)|(?:[a-fA-F\d]{1,4}:){2}(?:(?::[a-fA-F\d]{1,4}){0,3}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,5}|:)|[a-fA-F\d]{1,4}:(?:(?::[a-fA-F\d]{1,4}){0,4}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,6}|:)|:(?:(?::[a-fA-F\d]{1,4}){0,5}:(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)(?:\\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]\d|\d)){3}|(?::[a-fA-F\d]{1,4}){1,7}|:))(?:%[0-9a-zA-Z])?/g)) {
        ips.push(ipMatch[0])
      }
      writeFileSync(ipPath, JSON.stringify(ips))
      console.log('IPs updated')
      resolve()
    }, githubResponseError => {
      plugin.utils.build.failBuild('Failed to fetch data from GitHub', {
        error: githubResponseError
      })
      reject()
    })
  }), new Promise((resolve, reject) => {
    axios({
      responseType: 'text',
      url: 'https://publicsuffix.org/list/public_suffix_list.dat'
    }).then(listResponse => {
      writeFileSync(suffixesPath, JSON.stringify(listResponse.data.split('\n').filter(line => {
        return line.length > 0 && !line.startsWith('//')
      }).map(filteredLine => {
        if (filteredLine.startsWith('*.')) {
          return filteredLine.slice(2)
        } else {
          return filteredLine
        }
      })))
      console.log('Suffixes updated')
      resolve()
    }, listResponseError => {
      plugin.utils.build.failBuild('Failed to fetch data from MDN', {
        error: listResponseError
      })
      reject()
    })
  })])
}
export const onPreDev = updateFiles
export const onPreBuild = updateFiles