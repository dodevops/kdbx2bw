import { Uri } from './Uri'

export class ItemLogin {
  'uris'?: Array<Uri> = [new Uri()]
  'username'?: string = ''
  'password'?: string = ''
  'totp'?: string = ''
}
