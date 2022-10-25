import { KdbxBinaryWithHash, KdbxEntry, ProtectedValue } from 'kdbxweb'
import { Keepass } from './keepass'
import { Bitwarden } from './bitwarden'
import { ItemTemplate } from '../models/bitwarden/ItemTemplate'
import { Uri } from '../models/bitwarden/Uri'
import { Field } from '../models/bitwarden/Field'
import { ItemLogin } from '../models/bitwarden/ItemLogin'
import { Attachment } from '../models/attachment'
import { PasswordEntry } from '../models/password.entry'

/**
 * The migration API that migrates a keepass database to bitwarden
 */
export class Migration {
  /**
   * The organization id
   * @private
   */
  private readonly _organizationId: string
  /**
   * A Keepass API reference
   * @private
   */
  private _keepass: Keepass
  /**
   * A bitwarden API reference
   * @private
   */
  private _bitwarden: Bitwarden

  /**
   * A list of PathRewrite to apply to collections
   * @private
   */
  private _pathRewrites: Array<PathRewrite>

  constructor(organizationId: string, keepass: Keepass, bitwarden: Bitwarden, pathRewrites: Array<PathRewrite> = []) {
    this._organizationId = organizationId
    this._keepass = keepass
    this._bitwarden = bitwarden
    this._pathRewrites = pathRewrites
  }

  /**
   * Migrate the keepass database to bitwarden
   */
  public async migrate() {
    const passwords = this.migrateCollectionPaths(await this._keepass.getPasswords())
    await this._bitwarden.sync()
    const collectionPaths = [...new Set(passwords.map((entry) => entry.collectionName).sort())]
    const collectionMap = await this._bitwarden.createCollections(this._organizationId, collectionPaths)
    for (const password of passwords) {
      const bwPassword = this.convertToBitwarden(this._organizationId, collectionMap.get(password.collectionName), password.entry)
      if (bwPassword.name === '') {
        continue
      }
      const itemId = await this._bitwarden.createItem(bwPassword)
      const attachments = this.getAttachments(password.entry)
      for (const attachment of attachments) {
        await this._bitwarden.addAttachment(itemId, attachment)
      }
    }
    await this._bitwarden.sync()
  }

  /**
   * Migrate the collection paths in passwords by applying path rewrites
   * @param passwords the passwords to change
   */
  public migrateCollectionPaths(passwords: Array<PasswordEntry>): Array<PasswordEntry> {
    return passwords.map((entry) => {
      for (const pathRewrite of this._pathRewrites) {
        entry.collectionName = entry.collectionName.replace(pathRewrite.regex, pathRewrite.replace)
      }
      return entry
    })
  }

  /**
   * Convert a Keepass entry to a bitwarden item
   * @param organizationId the id of the organization
   * @param collectionId the id of the collection
   * @param password the password to convert
   * @return the bitwarden item
   */
  public convertToBitwarden(organizationId: string, collectionId: string, password: KdbxEntry): ItemTemplate {
    const returnItem = new ItemTemplate()
    returnItem.organizationId = organizationId
    returnItem.collectionIds = [collectionId]
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

    if (password.fields.has('URL') && this._getText(password.fields.get('URL')) !== '') {
      const uri = new Uri()
      uri.uri = this._getText(password.fields.get('URL'))
      uri.match = 0
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
          field.type = 0
        } else {
          field.value = value.getText()
          field.type = 1
        }
        returnItem.fields.push(field)
      }
    }

    return returnItem
  }

  /**
   * Get the attachments of the given keepass entry as an array of FormData objects
   * @param password The keeepass entry
   * @return An array of FormData attachment binaries
   */
  public getAttachments(password: KdbxEntry): Array<Attachment> {
    const attachments: Array<Attachment> = []
    password.binaries.forEach((attachmentValue, filename) => {
      let binary
      if ('hash' in attachmentValue) {
        binary = (attachmentValue as KdbxBinaryWithHash).value
      } else if ('value' in attachmentValue) {
        binary = (attachmentValue as ProtectedValue).getBinary()
      }

      attachments.push({
        filename: filename,
        binary: Buffer.from(binary),
      })
    })

    return attachments
  }

  /**
   * Tool method to get a string value from a field that's either protected or not
   * @param text The field value
   * @return the (possibly decrypted) value
   * @private
   */
  private _getText(text: ProtectedValue | string): string {
    if (typeof text === 'string') {
      return text as string
    } else {
      return (text as ProtectedValue).getText()
    }
  }
}
