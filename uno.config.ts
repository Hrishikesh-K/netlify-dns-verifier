import {defineConfig} from 'unocss'
import {presetAttributify, presetUno} from 'unocss'
export default defineConfig({
  presets: [presetAttributify({
    nonValuedAttribute: false,
    prefix: 'u-',
    prefixedOnly: true,
    strict: true
  }), presetUno({
    attributifyPseudo: true,
    dark: 'class'
  })],
  theme: {
    colors: {
      common: {
        black: '#151a1e',
        white: '#ffffff'
      },
      dark: {
        blue: {
          100: '#a5befd',
          200: '#597ef8',
          300: '#193ed2',
          400: '#0a1e8f',
          500: '#040e4e'
        },
        gold: {
          100: '#ffeba3',
          200: '#ffd152',
          300: '#e89c02',
          400: '#925a07',
          500: '#4f2f02'
        },
        gray: {
          100: '#e8ebed',
          200: '#a4a8ad',
          300: '#808589',
          400: '#4c5257',
          500: '#2a2e32',
          600: '#22262a',
          700: '#1c2126'
        },
        page: '#070b0d',
        purple: {
          100: '#b7a6fc',
          200: '#9a72fd',
          300: '#6d2ff4',
          400: '#340f85',
          500: '#1c0849'
        },
        red: {
          100: '#ffd2bd',
          200: '#ff9785',
          300: '#f85454',
          400: '#941e34',
          500: '#470b1b'
        },
        teal: {
          100: '#9ff9e1',
          200: '#86f3df',
          300: '#31c9c9',
          400: '#0f6980',
          500: '#032b3a'
        }
      },
      light: {
        blue: {
          100: '#d2e0fe',
          200: '#799cfb',
          300: '#2451f5',
          400: '#112cb0',
          500: '#061574'
        },
        gold: {
          100: '#fff7d1',
          200: '#ffdd75',
          300: '#ffb914',
          400: '#b7780b',
          500: '#7c4a04'
        },
        gray: {
          100: '#f9fafa',
          200: '#f2f5f8',
          300: '#e8ebed',
          400: '#a4a8ad',
          500: '#808589',
          600: '#676c6f',
          700: '#34383c'
        },
        purple: {
          100: '#e3dcfe',
          200: '#a886fd',
          300: '#7538fa',
          400: '#3d119c',
          500: '#230a5c'
        },
        red: {
          100: '#ffece0',
          200: '#ffb59e',
          300: '#ff6b61',
          400: '#b5303e',
          500: '#78122d'
        },
        teal: {
          100: '#e1fef1',
          200: '#9ff9e1',
          300: '#5cebdf',
          400: '#139baa',
          500: '#054861'
        }
      },
      uno: {
        current: 'currentColor',
        none: 'none',
        inherit: 'inherit',
        transparent: 'transparent'
      }
    }
  }
})