import { Keepass } from '../lib/api/keepass'
import path = require('path')
import { expect } from 'chai'
import { ProtectedValue } from 'kdbxweb'
import { promises as fs } from 'fs'

describe('The Keepass-API', () => {
  it('loads all database passwords', async () => {
    const keepass = new Keepass(path.join(__dirname, 'resources', 'testdb.kdbx'), 'masterpassword')
    const passwords = await keepass.getPasswords()
    expect(passwords).to.have.lengthOf(3)
    expect(passwords[0].collectionName).to.eq('Testdatabase')
    expect(passwords[1].collectionName).to.eq('Testdatabase')
    expect(passwords[2].collectionName).to.eq('Testdatabase/Testgroup')
    expect(passwords[0].entry.fields.get('Title')).to.eq('testattachment')
    expect(passwords[1].entry.fields.get('Title')).to.eq('Testroot')
    expect(passwords[2].entry.fields.get('Title')).to.eq('testsubentry')
    expect((passwords[1].entry.fields.get('Password') as ProtectedValue).getText()).to.eq('testpassword')
    expect((passwords[2].entry.fields.get('Password') as ProtectedValue).getText()).to.eq('testsubpassword')
  })
  it('supports attachments', async() => {
    const keepass = new Keepass(path.join(__dirname, 'resources', 'testdb.kdbx'), 'masterpassword')
    const passwords = await keepass.getPasswords()
    const data = await fs.readFile(path.join(__dirname, 'resources', 'KeePass_icon.svg'))
    expect(Buffer.from(passwords[0].entry.binaries.get('KeePass_icon.svg')['value']).compare(data)).to.eq(0)
  })
})
