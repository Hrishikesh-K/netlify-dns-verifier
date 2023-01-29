export class ApiError extends Error {
  stage : string
  status : number
  constructor(message : string = 'Something went wrong', stage : string = 'unknown', status : number = 500, ) {
    super(message)
    this.name = 'ApiError'
    this.stage = stage
    this.status = status
  }
}