<script
  setup
  lang="ts">
  import type {DNSResponse, UICollapseState} from '~/@types'
  import axios from 'axios'
  import NCollapse from '~/client/components/n-collapse.vue'
  let cardAOpen = $ref<boolean>(false)
  let cardAAAAOpen = $ref<boolean>(false)
  let cardCAAOpen = $ref<boolean>(false)
  let cardCNAMEOpen = $ref<boolean>(false)
  let cardDSOpen = $ref<boolean>(false)
  let cardNSOpen = $ref<boolean>(false)
  let domainARecords = $ref<DNSResponse['A']>({
    records: [],
    valid: false
  })
  let domainAState = $ref<UICollapseState>('waiting')
  let domainAAAARecords = $ref<DNSResponse['AAAA']>({
    records: [],
    valid: false
  })
  let domainAAAAState = $ref<UICollapseState>('waiting')
  let domainError = $ref<string>('')
  let domainCAARecords = $ref<DNSResponse['CAA']>({
    records: [],
    valid: false
  })
  let domainCAAState = $ref<UICollapseState>('waiting')
  let domainCAAText = $ref<string>('')
  let domainCNAMERecords = $ref<DNSResponse['CNAME']>({
    records: [],
    valid: false
  })
  let domainCNAMEState = $ref<UICollapseState>('waiting')
  let domainDSRecords = $ref<DNSResponse['DS']>({
    records: [],
    valid: false
  })
  let domainDSState = $ref<UICollapseState>('waiting')
  let domainInput = $ref<string>('')
  let domainNSRecords = $ref<DNSResponse['NS']>({
    records: [],
    valid: false
  })
  let domainNSState = $ref<UICollapseState>('waiting')
  function checkDns() {
    domainError = ''
    domainARecords = ({
      records: [],
      valid: false
    })
    domainAState = 'checking'
    domainAAAARecords = ({
      records: [],
      valid: false
    })
    domainAAAAState = 'checking'
    domainCAARecords = ({
      records: [],
      valid: false
    })
    domainCAAState = 'checking'
    domainCNAMERecords = ({
      records: [],
      valid: false
    })
    domainCNAMEState = 'checking'
    domainCAAText = ''
    domainDSRecords = ({
      records: [],
      valid: false
    })
    domainDSState = 'checking'
    domainNSRecords = ({
      records: [],
      valid: false
    })
    domainNSState = 'checking'
    axios({
      url: `/api/validate/${domainInput}`
    }).then((validationResponse : {
      data : DNSResponse
    }) => {
      if (validationResponse.data.valid) {
        domainARecords = validationResponse.data.A
        domainAAAARecords = validationResponse.data.AAAA
        domainCAARecords = validationResponse.data.CAA
        domainCNAMERecords = validationResponse.data.CNAME
        domainDSRecords = validationResponse.data.DS
        domainNSRecords = validationResponse.data.NS
        if (domainARecords.valid) {
          domainAState = 'valid'
        } else {
          domainAState = 'invalid'
        }
        if (domainAAAARecords.valid) {
          domainAAAAState = 'valid'
        } else {
          domainAAAAState = 'invalid'
        }
        if (domainCAARecords.valid) {
          domainCAAState = 'valid'
        } else {
          domainCAAState = 'invalid'
        }
        if (domainCNAMERecords.valid) {
          domainCNAMEState = 'valid'
        } else {
          domainCNAMEState = 'invalid'
        }
        if (domainDSRecords.valid) {
          domainDSState = 'valid'
        } else {
          domainDSState = 'invalid'
        }
        if (domainNSRecords.valid) {
          domainNSState = 'valid'
        } else {
          domainNSState = 'invalid'
        }
      } else {
        domainAState = 'skipped'
        domainAAAAState = 'skipped'
        domainCAAState = 'skipped'
        domainCNAMEState = 'skipped'
        domainError = 'Invalid domain'
        domainNSState = 'skipped'
      }
    }, (validationResponseError : {
      response? : {
        data : {
          message : string
          request_id : string
          stage : string
        }
      }
    }) => {
      if (validationResponseError.response && validationResponseError.response.data.stage === 'params_validation') {
        domainError = 'The provided string doesn\'t look like a domain'
      } else {
        domainError = 'Something went wrong while validating the domain'
        console.log(validationResponseError)
      }
      domainAState = 'skipped'
      domainAAAAState = 'skipped'
      domainCAAState = 'skipped'
      domainCNAMEState = 'skipped'
      domainNSState = 'skipped'
    })
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
          required
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
        v-bind:text="domainCAAText"
        v-on:toggle="cardCAAOpen = $event"/>
      <NCollapse
        title="CNAME Records"
        v-bind:dns="domainCNAMERecords"
        v-bind:open="cardCNAMEOpen"
        v-bind:state="domainCNAMEState"
        v-on:toggle="cardCNAMEOpen = $event"/>
      <NCollapse
        title="DS Records"
        v-bind:dns="domainDSRecords"
        v-bind:open="cardDSOpen"
        v-bind:state="domainDSState"
        v-on:toggle="cardDSOpen = $event"/>
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