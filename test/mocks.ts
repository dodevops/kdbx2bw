import MockAdapter from 'axios-mock-adapter'
import axios from 'axios'
import { ItemTemplate } from '../lib/models/bitwarden/ItemTemplate'
import { ItemLogin } from '../lib/models/bitwarden/ItemLogin'
import { Field } from '../lib/models/bitwarden/Field'

export function setupMock() {
  const mock = new MockAdapter(axios, {
    onNoMatch: 'throwException',
  })

  mock.onPost('/unlock').reply(200, {
    success: true,
    data: {},
  })

  mock.onPost('/sync?force=true').reply(200, {
    success: true,
    data: {},
  })

  return mock
}

export function mockCollections(mock) {
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
  mock
    .onPost('/object/org-collection?organizationid=1234', {
      organizationId: '1234',
      name: 'testnewcollection',
      externalId: null,
      groups: [],
    })
    .reply(200, {
      success: true,
      data: {
        name: 'testnewcollection',
        id: '2345',
      },
    })
  mock
    .onPost('/object/org-collection?organizationid=1234', {
      organizationId: '1234',
      name: 'testnewcollection2',
      externalId: null,
      groups: [],
    })
    .reply(200, {
      success: true,
      data: {
        name: 'testnewcollection2',
        id: '3456',
      },
    })
}

export function mockCreateItem(mock, duplicate = false) {
  const item = new ItemTemplate()
  item.collectionIds = ['123']
  item.organizationId = '234'
  item.name = 'testentry'
  item.login = new ItemLogin()
  item.login.username = 'testusername'
  item.login.password = 'testpassword'
  item.login.uris = [{ uri: 'https://google.com' }]
  const field = new Field()
  field.type = 0
  field.name = 'testfield'
  field.value = 'testvalue'
  item.fields = []
  item.fields.push(field)
  mock.onPost('/object/item', JSON.parse(JSON.stringify(item))).reply(200, {
    success: true,
    data: {
      id: '1234',
    },
  })
  const data = []
  if (duplicate) {
    data.push({
      name: 'testentry',
      id: '1234',
    })
  }
  mock.onGet('/list/object/items').reply(200, {
    success: true,
    data: {
      data: data,
    },
  })
  return item
}
