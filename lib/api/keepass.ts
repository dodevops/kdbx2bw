import { Kdbx, KdbxCredentials, KdbxGroup, ProtectedValue } from 'kdbxweb'
import { promises as fs } from 'fs'
import { PasswordEntry } from '../models/password.entry'

export class Keepass {
  private _db: Kdbx = null
  private readonly _file: string
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
      passwordList.push({
        collectionName: prefix,
        entry: entry,
      })
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
