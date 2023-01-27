import {createClient} from '@supabase/supabase-js'
export class ApiError extends Error {
  status : number
  constructor(message : string = 'Something went wrong', status : number = 500) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}
export const supabaseClient = createClient(`https://${process.env['SUPABASE_SUBDOMAIN']}.supabase.co`, process.env['SUPABASE_JWT'] as string)