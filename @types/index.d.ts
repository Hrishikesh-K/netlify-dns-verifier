export type UICollapseState = 'checking' | 'error' | 'invalid' | 'skipped' | 'valid' | 'waiting'
export type UIDNSRecords = Array<{
  id : string
  domain : string
  valid : boolean
  value : string
}>