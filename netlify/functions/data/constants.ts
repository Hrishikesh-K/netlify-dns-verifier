export class ApiError extends Error {
  status : number
  constructor(message : string = 'Something went wrong', status : number = 500) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}