import { Field } from './Field'
import { ItemLogin } from './ItemLogin'

export class ItemTemplate {
  'organizationId'?: string
  'collectionId'?: Array<string>
  'folderId'?: string
  'type'?: ItemTemplateTypeEnum
  'name'?: string
  'notes'?: string = ''
  'favorite'?: boolean
  'fields'?: Array<Field> = []
  'login'?: ItemLogin
  'reprompt'?: boolean
}

export type ItemTemplateTypeEnum = '1' | '2' | '3' | '4'
