import { KdbxBinaryWithHash, KdbxEntry, ProtectedValue } from 'kdbxweb'
import { Keepass } from './keepass'
import { Bitwarden } from './bitwarden'
import { ItemTemplate } from '../models/bitwarden/ItemTemplate'
import { Uri } from '../models/bitwarden/Uri'
import * as FormData from 'form-data'
import { Field } from '../models/bitwarden/Field'
import { ItemLogin } from '../models/bitwarden/ItemLogin'

export class Migration {
  private readonly _organizationId: string
  private _keepass: Keepass
  private _bitwarden: Bitwarden

  constructor(organizationId: string, keepass: Keepass, bitwarden: Bitwarden) {
    this._organizationId = organizationId
    this._keepass = keepass
    this._bitwarden = bitwarden
  }

  public async migrate() {
    const passwords = await this._keepass.getPasswords()
    const collectionPaths = [...new Set(passwords.map((entry) => entry.collectionName).sort())]
    const collectionMap = await this._bitwarden.createCollections(this._organizationId, collectionPaths)
    for (const password of passwords) {
      const bwPassword = this.convertToBitwarden(this._organizationId, collectionMap.get(password.collectionName), password.entry)
      const itemId = await this._bitwarden.createItem(bwPassword)
      const attachments = this.getAttachments(password.entry)
      for (const attachment of attachments) {
        await this._bitwarden.addAttachment(itemId, attachment)
      }
    }
  }

  public convertToBitwarden(organizationId: string, collectionId: string, password: KdbxEntry): ItemTemplate {
    const returnItem = new ItemTemplate()
    returnItem.organizationId = organizationId
    returnItem.collectionId = [collectionId]
    returnItem.login = new ItemLogin()
    returnItem.fields = []
    returnItem.name = this._getText(password.fields.get('Title'))
    returnItem.login.username = this._getText(password.fields.get('UserName'))
    returnItem.login.password = this._getText(password.fields.get('Password'))

    if (password.fields.has('otp')) {
      let totp = this._getText(password.fields.get('otp'))
      const urlMatches = totp.match(/^otpauth.+secret=(?<secret>.+)/)
      if (urlMatches) {
        totp = urlMatches.groups['secret']
      }
      returnItem.login.totp = totp
    }

    if (password.fields.has('URL')) {
      const uri = new Uri()
      uri.uri = this._getText(password.fields.get('URL'))
      uri.match = '0'
      returnItem.login.uris = [uri]
    }

    if (password.fields.has('Notes')) {
      returnItem.notes = this._getText(password.fields.get('Notes'))
    }

    for (const fieldName of password.fields.keys()) {
      if (!['Title', 'UserName', 'Password', 'URL', 'Notes'].includes(fieldName)) {
        const field = new Field()
        field.name = fieldName
        const value = password.fields.get(fieldName)
        if (typeof value == 'string') {
          field.value = value
          field.type = '0'
        } else {
          field.value = value.getText()
          field.type = '1'
        }
        returnItem.fields.push(field)
      }
    }

    return returnItem
  }

  public getAttachments(password: KdbxEntry): Array<FormData> {
    const attachments = []
    for (let binary of password.binaries.values()) {
      if ('hash' in binary) {
        binary = (binary as KdbxBinaryWithHash).value
      }

      if ('value' in binary) {
        binary = (binary as ProtectedValue).getBinary()
      }

      const attachment = new FormData.default()
      attachment.append('file', Buffer.from(binary))
      attachments.push(attachment)
    }

    return attachments
  }

  private _getText(text: ProtectedValue | string): string {
    if (typeof text === 'string') {
      return text as string
    } else {
      return (text as ProtectedValue).getText()
    }
  }
}
