import { Kdbx, KdbxCredentials, KdbxGroup, ProtectedValue } from 'kdbxweb'
import { promises as fs } from 'fs'
import { PasswordEntry } from '../models/password.entry'

/**
 * An abstractor of the keepass api
 */
export class Keepass {
  /**
   * The keepass database
   * @private
   */
  private _db: Kdbx = null
  /**
   * The file to load
   * @private
   */
  private readonly _file: string
  /**
   * The passphrase of the database
   * @private
   */
  private readonly _passphrase: string

  constructor(file: string, passphrase: string) {
    this._file = file
    this._passphrase = passphrase
  }

  private async _loadDatabase() {
    const creds = new KdbxCredentials(ProtectedValue.fromString(this._passphrase))
    const data = await fs.readFile(this._file)
    this._db = await Kdbx.load(data.buffer, creds)
  }

  private _loadPasswords(group: KdbxGroup, prefix: string): Array<PasswordEntry> {
    const passwordList: Array<PasswordEntry> = []
    for (const subGroup of group.groups) {
      passwordList.push(...this._loadPasswords(subGroup, `${prefix}/${subGroup.name}`))
    }
    for (const entry of group.entries) {
      const passwordEntry = new PasswordEntry()
      passwordEntry.entry = entry
      passwordEntry.collectionName = prefix
      passwordList.push(passwordEntry)
    }
    return passwordList
  }

  async getPasswords(): Promise<Array<PasswordEntry>> {
    if (!this._db) {
      await this._loadDatabase()
    }
    return this._loadPasswords(this._db.getDefaultGroup(), this._db.meta.name).reverse()
  }
}
