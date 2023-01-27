<script
  setup
  lang="ts">
  import sprite from '~/client/assets/sprites.svg'
  const iconProps = withDefaults(defineProps<{
    name : string
    size? : number
  }>(), {
    name: '',
    size: 4
  })
</script>
<template>
  <svg
    u-fill="uno-current"
    v-bind:u-h="iconProps.size"
    v-bind:u-w="iconProps.size">
    <use
      v-bind:xlink:href="`${sprite}#${iconProps.name}`"/>
  </svg>
</template>
<!--
  <safe
    u-h="3 4"
    u-w="3 4"/>
-->