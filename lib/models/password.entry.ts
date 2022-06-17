import { KdbxEntry } from 'kdbxweb'

export abstract class PasswordEntry {
  public collectionName: string
  public entry: KdbxEntry
}
