import type {DigestData} from '@leichtgewicht/dns-packet'
export type DNSResponse ={
  [key in 'A' | 'AAAA' | 'CAA' | 'CNAME' | 'DS' | 'NS']? : Array<{
    id : string
    domain : string
    valid : boolean
    value : boolean | DigestData | string
  }>
} & {
  valid : boolean
}
export type UICollapseState = 'checking' | 'error' | 'invalid' | 'skipped' | 'valid' | 'waiting'