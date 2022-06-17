import axios from 'axios'
import { ItemTemplate } from '../models/bitwarden/ItemTemplate'
import { getLogger, Logger } from 'loglevel'
import * as FormData from 'form-data'

export class Bitwarden {
  private readonly _apiBaseUrl: string
  private readonly _password: string
  private _defaultGroupIds: Array<string>
  private _collectionMap: Map<string, string> = new Map()
  private readonly _dryrun: boolean
  private _log: Logger = getLogger('Bitwarden')

  constructor(apiBaseUrl: string, password: string, defaultGroupIds: Array<string> = [], dryrun: boolean = true) {
    this._apiBaseUrl = apiBaseUrl
    this._password = password
    this._defaultGroupIds = defaultGroupIds
    this._dryrun = dryrun
  }

  async _fetchCollections(organizationId: string) {
    this._log.debug('Fetching all collections')
    const url = `${this._apiBaseUrl}/list/object/org-collections?organizationid=${organizationId}`
    if (this._dryrun) {
      this._log.info(`Calling url ${url}`)
      return this._collectionMap
    }

    const response = await axios.get(url)
    for (const collection of response.data['data']['data']) {
      this._collectionMap.set(collection['name'], collection['id'])
    }
  }

  async unlock() {
    this._log.info('Unlocking bitwarden')
    if (!this._dryrun) {
      await axios.post(`${this._apiBaseUrl}/unlock`, {
        password: this._password,
      })
    }
  }

  async createCollection(organizationId: string, collectionPath: string): Promise<string> {
    if (this._collectionMap.size == 0) {
      await this._fetchCollections(organizationId)
    }
    if (!this._collectionMap.has(collectionPath)) {
      this._log.debug(`Collection ${collectionPath} missing. Adding it.`)
      const data = {
        organizationId: organizationId,
        name: collectionPath,
        externalId: null,
        groups: this._defaultGroupIds.map((groupId) => {
          return {
            id: groupId,
            readOnly: false,
            hidePasswords: false,
          }
        }),
      }
      const url = `${this._apiBaseUrl}/object/org-collection?organizationid=${organizationId}`
      if (this._dryrun) {
        this._log.info(`Would call ${url} with this data: \n ${JSON.stringify(data)}`)
        return ''
      }
      const response = await axios.post(url, data)
      this._collectionMap.set(response.data['data']['name'], response.data['data']['id'])
    }

    return this._collectionMap.get(collectionPath)
  }

  async createCollections(organizationId: string, collectionPaths: Array<string>): Promise<Map<string, string>> {
    this._log.debug(`Creating the following collections for organization id ${organizationId}:\n${JSON.stringify(collectionPaths)}`)
    const retMap = new Map<string, string>()
    for (const collectionPath of collectionPaths) {
      retMap.set(collectionPath, await this.createCollection(organizationId, collectionPath))
    }
    return retMap
  }

  async findItem(organizationId: string, collectionId: string, search: string) {
    if (this._dryrun) {
      return []
    }
    const response = await axios.get(`${this._apiBaseUrl}/list/object/items`, {
      params: {
        organizationid: organizationId,
        collectionid: collectionId,
        search: search,
      },
    })
    return response.data['data']['data']
  }

  async createItem(itemTemplate: ItemTemplate): Promise<string> {
    this._log.info(`Creating item ${itemTemplate.name}`)
    if (this._dryrun) {
      return ''
    }
    for (const collectionId in itemTemplate.collectionId) {
      this._log.debug(`Searching, if item ${itemTemplate.name} already exists in ${collectionId}@${itemTemplate.organizationId}`)
      const existingItems = await this.findItem(itemTemplate.organizationId, collectionId, itemTemplate.name)
      for (const item of existingItems) {
        if (item['name'] === itemTemplate.name) {
          this._log.warn(`Already found entry ${itemTemplate.name}. Recreating it...`)
          await this.deleteItem(item['id'])
        }
      }
    }
    const createResponse = await axios.post(`${this._apiBaseUrl}/object/item`, itemTemplate)
    return createResponse.data['data']['id']
  }

  async deleteItem(itemId: string) {
    this._log.debug(`Deleting item ${itemId}`)
    if (!this._dryrun) {
      await axios.delete(`${this._apiBaseUrl}/object/item/${itemId}`)
    }
  }

  async addAttachment(itemId: string, attachmentData: FormData) {
    this._log.info(`Adding attachment to item ${itemId}`)
    if (!this._dryrun) {
      await axios.post(`${this._apiBaseUrl}/attachment?id=${itemId}`, attachmentData.getBuffer(), attachmentData.getHeaders())
    }
  }
}
