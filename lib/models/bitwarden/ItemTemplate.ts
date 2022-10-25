import { Field } from './Field'
import { ItemLogin } from './ItemLogin'

export class ItemTemplate {
  'organizationId'?: string
  'collectionIds'?: Array<string>
  'folderId'?: string
  'type': ItemTemplateTypeEnum = 1
  'name'?: string
  'notes'?: string = ''
  'favorite' = false
  'fields'?: Array<Field> = []
  'login'?: ItemLogin
  'reprompt' = 0
}

export type ItemTemplateTypeEnum = 1 | 2 | 3 | 4
