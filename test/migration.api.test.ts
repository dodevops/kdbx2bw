import { Migration } from '../lib/api/migration'
import { Keepass } from '../lib/api/keepass'
import { Bitwarden } from '../lib/api/bitwarden'
import * as path from 'path'
import { expect } from 'chai'
import { mockCollections, setupMock } from './mocks'
import { ItemTemplate } from '../lib/models/bitwarden/ItemTemplate'
import { ItemLogin } from '../lib/models/bitwarden/ItemLogin'
import { Field } from '../lib/models/bitwarden/Field'

describe('The migration API', () => {
  it('should convert a KDBX entry to a Bitwarden item', async () => {
    const keepass = new Keepass(path.join(__dirname, 'resources', 'testdb.kdbx'), 'masterpassword')
    const bitwarden = new Bitwarden('', 'testpassword')
    const migration = new Migration('1234', keepass, bitwarden)
    const passwords = await keepass.getPasswords()
    const subject = migration.convertToBitwarden('1234', '2345', passwords[1].entry)
    expect(subject.name).to.eq('Testroot')
    expect(subject.login.username).to.eq('testuser')
    expect(subject.login.password).to.eq('testpassword')
    expect(subject.fields).to.have.lengthOf(2)
    expect(subject.fields[0].name).to.eq('Testfield')
    expect(subject.fields[0].value).to.eq('Testfieldvalue')
    expect(subject.fields[0].type).to.eq('1')
    expect(subject.fields[1].name).to.eq('Testfield2')
    expect(subject.fields[1].value).to.eq('Testnothidden')
    expect(subject.fields[1].type).to.eq('0')
  })
  it('should return the attachments', async () => {
    const keepass = new Keepass(path.join(__dirname, 'resources', 'testdb.kdbx'), 'masterpassword')
    const bitwarden = new Bitwarden('', 'testpassword')
    const migration = new Migration('1234', keepass, bitwarden)
    const passwords = await keepass.getPasswords()
    const subject = migration.getAttachments(passwords[0].entry)
    expect(subject).to.have.lengthOf(1)
    expect(subject[0].getLengthSync()).to.gt(0)
  })
  it('should migrate the test data', async () => {
    const mock = setupMock()
    mockCollections(mock)
    mock
      .onPost('/object/org-collection?organizationid=1234', {
        organizationId: '1234',
        name: 'Testdatabase',
        externalId: null,
        groups: [],
      })
      .reply(200, {
        success: true,
        data: {
          name: 'Testdatabase',
          id: '2345',
        },
      })
    mock
      .onPost('/object/org-collection?organizationid=1234', {
        organizationId: '1234',
        name: 'Testdatabase/Testgroup',
        externalId: null,
        groups: [],
      })
      .reply(200, {
        success: true,
        data: {
          name: 'Testdatabase/Testgroup',
          id: '3456',
        },
      })
    mock.onGet('/list/object/items').reply(200, {
      success: true,
      data: {
        data: [],
      },
    })

    mock.onPost('/attachment?id=0').reply(200)

    const testitems = []
    testitems.push(new ItemTemplate())
    testitems[0].collectionId = ['2345']
    testitems[0].organizationId = '1234'
    testitems[0].name = 'testattachment'
    testitems[0].login = new ItemLogin()
    testitems[0].login.username = 'testattachmentuser'

    testitems.push(new ItemTemplate())
    testitems[1].collectionId = ['2345']
    testitems[1].organizationId = '1234'
    testitems[1].name = 'Testroot'
    testitems[1].login = new ItemLogin()
    testitems[1].login.username = 'testuser'
    testitems[1].login.password = 'testpassword'
    testitems[1].fields = []
    testitems[1].fields.push(new Field())
    testitems[1].fields[0].name = 'Testfield'
    testitems[1].fields[0].value = 'Testfieldvalue'
    testitems[1].fields[0].type = '1'
    testitems[1].fields.push(new Field())
    testitems[1].fields[1].name = 'Testfield2'
    testitems[1].fields[1].value = 'Testnothidden'
    testitems[1].fields[1].type = '0'

    testitems.push(new ItemTemplate())
    testitems[2].collectionId = ['3456']
    testitems[2].organizationId = '1234'
    testitems[2].name = 'testsubentry'
    testitems[2].login = new ItemLogin()
    testitems[2].login.username = 'testsubuser'
    testitems[2].login.password = 'testsubpassword'

    for (const [index, testitem] of testitems.entries()) {
      mock.onPost('/object/item', JSON.parse(JSON.stringify(testitem))).reply(200, {
        success: true,
        data: {
          id: index,
        },
      })
    }

    const keepass = new Keepass(path.join(__dirname, 'resources', 'testdb.kdbx'), 'masterpassword')
    const bitwarden = new Bitwarden('', 'testpassword', [], false)
    const migration = new Migration('1234', keepass, bitwarden)
    await migration.migrate()
    expect(mock.history.get).to.have.lengthOf(
      1 + // fetch all collections
        3 // search for items
    )
    expect(mock.history.post).to.have.lengthOf(
      1 + // unlock
        2 + // add new collections
        3 // add new items
    )
  })
})
