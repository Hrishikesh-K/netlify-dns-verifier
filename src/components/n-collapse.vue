<script
  setup
  lang="ts">
  import type {UICollapseState, UIDNSRecords} from '~/@types'
  import NIcon from '~/client/components/n-icon.vue'
  const collapseEmits = defineEmits<{
    (event: 'toggle', value : boolean): void
  }>()
  const collapseProps = withDefaults(defineProps<{
    dns : UIDNSRecords
    open : boolean
    state : UICollapseState
    title : string
  }>(), {
    dns: () => {
      return []
    },
    open: false,
    state: 'waiting',
    title: ''
  })
  let collapseData = $computed<{
    color : string
    name : 'ban' | 'circle-check' | 'circle-xmark' | 'hourglass-start' | 'loader' | 'triangle-exclamation'
    text : string
  }>(() => {
    switch (collapseProps.state) {
      case 'checking':
        return {
          color: 'dark:dark-blue-200',
          name: 'loader',
          text: 'Checking...'
        }
      case 'error':
        return {
          color: 'dark:dark-red-300',
          name: 'circle-xmark',
          text: 'Error...'
        }
      case 'invalid':
        return {
          color: 'dark:dark-gold-300',
          name: 'triangle-exclamation',
          text: 'Invalid...'
        }
      case 'skipped':
        return {
          color: 'dark:dark-gray-300',
          name: 'ban',
          text: 'Skipped...'
        }
      case 'valid':
        return {
          color: 'dark:dark-teal-300',
          name: 'circle-check',
          text: 'No records found'
        }
      case 'waiting':
      default:
        return {
          color: 'dark:dark-purple-100',
          name: 'hourglass-start',
          text: 'Waiting...'
        }
    }
  })
  let collapseOpen = $computed({
    get() {
      return collapseProps.open
    },
    set(value) {
      collapseEmits('toggle', value)
    }
  })
</script>
<template>
  <div
    u-bg="even:dark:common-white/3 hover:dark:common-white/4"
    u-p="6">
    <button
      u-bg="uno-transparent"
      u-border="none"
      u-cursor="pointer"
      u-flex="~"
      u-justify="between"
      u-leading="none"
      u-p="0"
      u-text="base uno-inherit"
      u-w="full"
      v-on:click="collapseOpen = !collapseOpen">
      <span
        u-flex="~"
        u-gap="x-3"
        u-items="center">
        <NIcon
          v-bind:name="collapseOpen ? 'angle-down' : 'angle-right'"
          v-bind:size="3"/>
        <span>{{collapseProps.title}}</span>
      </span>
      <span
        u-flex="~"
        u-gap="x-3"
        u-items="center"
        u-m="l-auto"
        v-bind:u-text="collapseData.color">
        <span>{{collapseProps.state.slice(0, 1).toUpperCase() + collapseProps.state.slice(1)}}</span>
        <NIcon
          v-bind:name="collapseData.name"/>
      </span>
    </button>
    <div
      v-bind:u-max-h="collapseOpen ? 'fit-content' : '0'"
      v-bind:u-overflow="collapseOpen ? 'auto' : 'hidden'">
      <div
        u-flex="~ col"
        u-gap="y-3"
        u-p="l-3 y-3"
        v-if="collapseProps.dns.length > 0">
        <div
          u-flex="~"
          u-gap="x-1"
          u-items="center"
          v-bind:key="record.id"
          v-bind:u-text="record.valid ? 'dark:dark-teal-300' : 'dark:dark-red-300'"
          v-for="record in collapseProps.dns">
          <NIcon
            v-bind:name="record.valid ? 'circle-check' : 'circle-xmark'"/>
          <span>{{record.domain}}: {{record.value}}</span>
        </div>
      </div>
      <p
        u-m="0"
        u-p="l-3 y-3"
        v-else>{{collapseData.text}}</p>
    </div>
  </div>
</template>
<!--
  <safe
    u-max-h="0 fit-content"
    u=overflow="auto hidden"
    u-text="dark:dark-blue-200 dark:dark-gold-300 dark:dark-gray-300 dark:dark-purple-100 dark:dark-red-300 dark:dark-teal-300"/>
-->