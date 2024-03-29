import { Bitwarden } from '../lib/api/bitwarden'
import { expect } from 'chai'
import { mockCollections, mockCreateItem, setupMock } from './mocks'

describe('The bitwarden API', () => {
  const mock = setupMock()

  afterEach(() => {
    mock.resetHistory()
  })

  it('should unlock properly', async () => {
    const bitwarden = new Bitwarden('', 'testpassword', [], false)
    await bitwarden.unlock()
    expect(mock.history.post).to.have.lengthOf(1)
    expect(JSON.parse(mock.history.post[0].data)).to.deep.equal({ password: 'testpassword' })
  })

  it('should create a collection', async () => {
    mockCollections(mock)
    const bitwarden = new Bitwarden('', 'testpassword', [], false)
    expect(await bitwarden.createCollection('1234', 'testnewcollection')).to.eq('2345')
    expect(mock.history.get).to.have.lengthOf(1)
    expect(mock.history.post).to.have.lengthOf(1)
  })

  it('should create multiple collections', async () => {
    mock.onGet('/list/object/org-collections?organizationid=1234').reply(200, {
      success: true,
      data: {
        data: [
          {
            id: '1234',
            name: 'testcollection',
          },
        ],
      },
    })
    mockCollections(mock)
    const bitwarden = new Bitwarden('', 'testpassword', [], false)
    expect(await bitwarden.createCollections('1234', ['testnewcollection', 'testnewcollection2'])).to.deep.eq(
      new Map([
        ['testnewcollection', '2345'],
        ['testnewcollection2', '3456'],
      ])
    )
    expect(mock.history.get).to.have.lengthOf(1)
    expect(mock.history.post).to.have.lengthOf(2)
  })

  it('should create a new item', async () => {
    const item = mockCreateItem(mock)
    const bitwarden = new Bitwarden('', 'testpassword', [], false)
    expect(await bitwarden.createItem(item)).to.eq('1234')
    expect(mock.history.get).to.have.lengthOf(1)
    expect(mock.history.post).to.have.lengthOf(1)
  })

  it('should delete a duplicate item', async () => {
    const item = mockCreateItem(mock, true)
    mock.onDelete('/object/item/1234').reply(200)
    const bitwarden = new Bitwarden('', 'testpassword', [], false)
    expect(await bitwarden.createItem(item)).to.eq('1234')
    expect(mock.history.delete).to.have.lengthOf(1)
    expect(mock.history.get).to.have.lengthOf(1)
    expect(mock.history.post).to.have.lengthOf(1)
  })

  it('should support dryrun', async () => {
    mockCollections(mock)
    const item = mockCreateItem(mock, true)
    const bitwarden = new Bitwarden('', 'testpassword')
    await bitwarden.unlock()
    await bitwarden.createCollections('1234', ['testnewcollection', 'testnewcollection2'])
    await bitwarden.createItem(item)
    await bitwarden.findItem('1234', '123', 'nothing')
    expect(mock.history.get).to.have.lengthOf(0)
    expect(mock.history.post).to.have.lengthOf(0)
    expect(mock.history.delete).to.have.lengthOf(0)
  })

  it('should add an attachment', async () => {
    mock.onPost('/attachment?itemid=1234').reply(200)
    const bitwarden = new Bitwarden('', 'testpassword', [], false)
    await bitwarden.addAttachment('1234', {
      filename: 'testfile',
      binary: Buffer.from('test'),
    })
    expect(mock.history.post).to.have.lengthOf(1)
  })

  it('should support default group ids', async () => {
    mockCollections(mock)
    mock
      .onPost('/object/org-collection?organizationid=1234', {
        organizationId: '1234',
        name: 'testnewcollection',
        externalId: null,
        groups: [
          {
            id: '1234',
            readOnly: false,
            hidePasswords: false,
          },
          {
            id: '2345',
            readOnly: false,
            hidePasswords: false,
          },
        ],
      })
      .reply(200, {
        success: true,
        data: {
          name: 'testnewcollection',
          id: '2345',
        },
      })
    const bitwarden = new Bitwarden('', 'testpassword', ['1234', '2345'], false)
    expect(await bitwarden.createCollection('1234', 'testnewcollection')).to.eq('2345')
    expect(mock.history.get).to.have.lengthOf(1)
    expect(mock.history.post).to.have.lengthOf(1)
  })
})
