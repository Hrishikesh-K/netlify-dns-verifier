<script
  setup
  lang="ts">
  import type {CaaAnswer, Packet} from '@leichtgewicht/dns-packet'
  import type {UICollapseState, UIDNSRecords} from '~/@types'
  import axios from 'axios'
  import {v4} from 'uuid'
  import {watch} from 'vue'
  import NCollapse from '~/client/components/n-collapse.vue'
  let cardAOpen = $ref<boolean>(false)
  let cardAAAAOpen = $ref<boolean>(false)
  let cardCAAOpen = $ref<boolean>(false)
  let cardCNAMEOpen = $ref<boolean>(false)
  let cardNSOpen = $ref<boolean>(false)
  let domainARecords = $ref<UIDNSRecords>([])
  let domainAState = $ref<UICollapseState>('waiting')
  let domainAAAARecords = $ref<UIDNSRecords>([])
  let domainAAAAState = $ref<UICollapseState>('waiting')
  let domainError = $ref<string>('')
  let domainCAAChecks = $ref<Array<string>>([])
  let domainCAARecords = $ref<UIDNSRecords>([])
  let domainCAAState = $ref<UICollapseState>('waiting')
  let domainCNAMERecords = $ref<UIDNSRecords>([])
  let domainCNAMEState = $ref<UICollapseState>('waiting')
  let domainInput = $ref<string>('')
  let domainNSRecords = $ref<UIDNSRecords>([])
  let domainNSState = $ref<UICollapseState>('waiting')
  function checkARecords() {
    domainAState = 'checking'
    axios({
      url: `/api/dns/a/${domainInput}`
    }).then((aResponse: {
      data : {
        records : Array<{
          valid : boolean
          value : string
        }>
      }
    }) => {
      aResponse.data.records.forEach(aRecord => {
        domainARecords.push({
          id: v4(),
          domain: domainInput,
          valid: aRecord.valid,
          value: aRecord.value
        })
      })
      if (domainARecords.length > 0 && domainARecords.length < 3 && domainARecords.every(aRecord => {
        return aRecord.valid
      })) {
        domainAState = 'valid'
      } else {
        domainAState = 'invalid'
      }
    }, aResponseError => {
      domainAState = 'error'
      console.log(aResponseError)
    })
  }
  function checkAAAARecords() {
    domainAAAAState = 'checking'
    axios({
      url: `/api/dns/aaaa/${domainInput}`
    }).then((aaaaResponse : {
      data : {
        records : Array<{
          valid : boolean
          value : string
        }>
      }
    }) => {
        aaaaResponse.data.records.forEach(aaaaRecord => {
          domainAAAARecords.push({
            id: v4(),
            domain: domainInput,
            valid: aaaaRecord.valid,
            value: aaaaRecord.value
          })
        })
      if (domainAAAARecords.length < 3 && domainAAAARecords.every(aaaaRecord => {
        return aaaaRecord.valid
      })) {
        domainAAAAState = 'valid'
      } else {
        domainAAAAState = 'invalid'
      }
    }, aaaaResponseError => {
      domainAAAAState = 'error'
      console.log(aaaaResponseError)
    })
  }
  function checkCAARecords() {
    domainCAAState = 'checking'
    new Promise<void>((resolve, reject) => {
      domainCAAChecks.every((domain, domainIndex) => {
        return axios({
          url: `/api/dns/caa/${domain}`
        }).then((caaResponse : {
          data : {
            caa : Array<CaaAnswer>
          }
        }) => {
          caaResponse.data.caa.forEach(caaRecord => {
            domainCAARecords.push({
              id: v4(),
              domain,
              valid: caaRecord.data.value === 'letsencrypt.org',
              value: `${caaRecord.data.flags} ${caaRecord.data.tag} "${caaRecord.data.value}"`
            })
          })
          if (domainIndex === domainCAAChecks.length - 1) {
            resolve()
          }
          return caaResponse.data.caa.length === 0
        }, caaResponseError => {
          console.log(caaResponseError)
          reject()
          return false
        })
      })
    }).then(() => {
      if (domainCAARecords.length === 0 || domainCAARecords.every(caaRecord => {
        return caaRecord.valid
      })) {
        domainCAAState = 'valid'
      } else {
        domainCAAState = 'invalid'
      }
    }, () => {
      domainCAAState = 'error'
    })
  }
  function checkCNAMERecords(apex? : boolean) {
    domainCNAMEState = 'checking'
    let domainToCheck = ''
    if (apex) {
      domainToCheck = `www.${domainInput}`
    } else {
      domainToCheck = domainInput
    }
    axios({
      url: `/api/dns/cname/${domainToCheck}`
    }).then((cnameResponse : {
      data : {
        cname : Exclude<Packet['answers'], undefined>
      }
    }) => {
      cnameResponse.data.cname.forEach(cnameRecord => {
        domainCNAMERecords.push({
          id: v4(),
          domain: domainToCheck,
          valid: (cnameRecord.data as string).endsWith('.netlify.app'),
          value: cnameRecord.data as string
        })
      })
      if (domainCNAMERecords.length > 0 && domainCNAMERecords.every(cnameRecord => {
        return cnameRecord.valid
      })) {
        domainCNAMEState = 'valid'
      } else {
        domainCNAMEState = 'invalid'
      }
    }, cnameResponseError => {
      domainCNAMEState = 'error'
      console.log(cnameResponseError)
    })
  }
  function checkNSRecords() {
    domainNSState = 'checking'
    axios({
      url: `/api/dns/ns/${domainInput}`
    }).then((nsResponse : {
      data : {
        ns : Exclude<Packet['answers'], undefined>
      }
    }) => {
      nsResponse.data.ns.forEach(nsRecord => {
        domainNSRecords.push({
          id: v4(),
          domain: domainInput,
          valid: /dns[1-4]\.p0[0-9]\.nsone\.net/.test(nsRecord.data as string),
          value: nsRecord.data as string
        })
      })
      if (domainNSRecords.length === 4 && domainNSRecords.every(nsRecord => {
        return nsRecord.valid
      })) {
        domainNSState = 'valid'
      } else {
        domainNSState = 'invalid'
      }
    }, nsResponseError => {
      domainNSState = 'error'
      console.log(nsResponseError)
    })
  }
  function checkDns() {
    domainError = ''
    domainARecords = []
    domainAState = 'waiting'
    domainAAAARecords = []
    domainAAAAState = 'waiting'
    domainCAAChecks = []
    domainCAARecords = []
    domainCAAState = 'waiting'
    domainCNAMERecords = []
    domainCNAMEState = 'waiting'
    domainNSRecords = []
    domainNSState = 'waiting'
    if (domainInput.length > 0) {
      axios({
        url: `/api/validate/${domainInput}`
      }).then((validationResponse : {
        data : {
          apex : boolean
          suffix : string
          valid : boolean
        }
      }) => {
        if (validationResponse.data.valid) {
          if (validationResponse.data.apex) {
            domainCAAChecks.push(domainInput)
            checkNSRecords()
            checkARecords()
            checkAAAARecords()
            checkCAARecords()
            const dnsWatcher = watch([() => {
              return domainAState
            }, () => {
              return domainAAAAState
            }, () => {
              return domainNSState
            }], () => {
              if (domainAState === 'valid' && domainAAAAState === 'valid' && domainNSState !== 'valid') {
                checkCNAMERecords(true)
                dnsWatcher()
              } else {
                domainCNAMEState = 'skipped'
              }
            })
          } else {
            domainAState = 'skipped'
            domainAAAAState = 'skipped'
            checkNSRecords()
            domainInput.replace(`.${validationResponse.data.suffix}`, '').split('.').forEach((_partOfDomain, partOfDomainIndex, partOfDomainArray) => {
              domainCAAChecks.push(`${partOfDomainArray.slice(partOfDomainIndex).join('.')}.${validationResponse.data.suffix}`)
            })
            checkCAARecords()
            checkCNAMERecords()
          }
        } else {
          domainAState = 'skipped'
          domainAAAAState = 'skipped'
          domainCAAState = 'skipped'
          domainCNAMEState = 'skipped'
          domainError = 'Invalid domain'
          domainNSState = 'skipped'
        }
      })
    } else {
      domainAState = 'skipped'
      domainAAAAState = 'skipped'
      domainCAAState = 'skipped'
      domainCNAMEState = 'skipped'
      domainError = 'Please enter a domain'
      domainNSState = 'skipped'
    }
  }
</script>
<template>
  <main
    u-m="x-auto"
    u-max-w="320">
    <form
      u-m="x-auto"
      u-max-w="320"
      v-on:submit.prevent = "checkDns">
      <label
        u-display="block"
        u-font="medium"
        u-pos="relative">
        <span
          u-pointer="none"
          u-pos="absolute left-4 top-2"
          u-text="base light-gray-600 dark:dark-gray-200"
          u-transition="duration-0.25s transform"
          v-bind:u-transform="`${domainInput.length > 0 ? 'scale-75 translate-x--5 translate-y--7' : 'scale-100 translate-x-0 translate-y-0'} ~`">Domain</span>
        <input
          u-bg="common-white dark:common-black"
          u-border="~ light-gray-300 rounded-md solid dark:dark-gray-300"
          u-box="border"
          u-h="10"
          u-outline="none"
          u-p="x-4 y-2"
          u-ring="focus:2 focus:light-teal-300 focus:dark:dark-teal-300"
          u-text="base common-black dark:common-white"
          u-w="full"
          v-model="domainInput"/>
      </label>
    </form>
    <p
      u-m="b-0 t-1"
      u-text="sm dark:dark-red-300"
      v-if="domainError.length > 0">{{domainError}}</p>
    <div
      u-bg="dark:common-black"
      u-border="rounded-lg"
      u-m="t-6">
      <NCollapse
        title="A Records"
        v-bind:dns="domainARecords"
        v-bind:open="cardAOpen"
        v-bind:state="domainAState"
        v-on:toggle="cardAOpen = $event"/>
      <NCollapse
        title="AAAA Records"
        v-bind:dns="domainAAAARecords"
        v-bind:open="cardAAAAOpen"
        v-bind:state="domainAAAAState"
        v-on:toggle="cardAAAAOpen = $event"/>
      <NCollapse
        title="CAA Records"
        v-bind:dns="domainCAARecords"
        v-bind:open="cardCAAOpen"
        v-bind:state="domainCAAState"
        v-on:toggle="cardCAAOpen = $event"/>
      <NCollapse
        title="CNAME Records"
        v-bind:dns="domainCNAMERecords"
        v-bind:open="cardCNAMEOpen"
        v-bind:state="domainCNAMEState"
        v-on:toggle="cardCNAMEOpen = $event"/>
      <NCollapse
        title="NS Records"
        v-bind:dns="domainNSRecords"
        v-bind:open="cardNSOpen"
        v-bind:state="domainNSState"
        v-on:toggle="cardNSOpen = $event"/>
    </div>
  </main>
</template>
<!--
  <safe
    u-text="dark:darker-red-300 dark:dark-teal-300"
    u-transform="~ scale-75 scale-100 translate-x--5 translate-y--7 translate-x-0 translate-y-0"/>
-->