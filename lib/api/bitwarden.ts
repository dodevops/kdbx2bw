import axios from 'axios'
import { ItemTemplate } from '../models/bitwarden/ItemTemplate'
import { getLogger, Logger } from 'loglevel'
import * as FormData from 'form-data'

/**
 * Bitwarden API abstraction. Requires a local bitwarden Vault Management API ran by `bw serve`
 *
 * @see https://bitwarden.com/help/vault-management-api/
 * @see https://bitwarden.com/help/cli/
 */
export class Bitwarden {
  /**
   * The Bitwarden API base URL
   * @private
   */
  private readonly _apiBaseUrl: string
  /**
   * The unlock password for the vault
   * @private
   */
  private readonly _password: string
  /**
   * The default ids of the groups to add to each collection
   * @private
   */
  private _defaultGroupIds: Array<string>
  /**
   * A map of the loaded collections
   * @private
   */
  private _collectionMap: Map<string, string> = new Map()
  /**
   * Whether to not actually run the requests
   * @private
   */
  private readonly _dryrun: boolean
  /**
   * A logger
   * @private
   */
  private _log: Logger = getLogger('Bitwarden')

  constructor(apiBaseUrl: string, password: string, defaultGroupIds: Array<string> = [], dryrun = true) {
    this._apiBaseUrl = apiBaseUrl
    this._password = password
    this._defaultGroupIds = defaultGroupIds
    this._dryrun = dryrun
  }

  /**
   * Fetch all collections and store it locally to speed up collection batch creation
   * @param organizationId the id of the organization
   */
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

  /**
   * Unlock the bitwarden vault
   */
  async unlock() {
    this._log.info('Unlocking bitwarden')
    if (!this._dryrun) {
      await axios.post(`${this._apiBaseUrl}/unlock`, {
        password: this._password,
      })
    }
  }

  /**
   * Create a new collection on the organization
   * @param organizationId The id of the organization
   * @param collectionPath The name and path of the collection. Bitwarden supports "sub-collections" by separating
   *  paths using "/"
   * @return the id of the new collection
   */
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

  /**
   * Batch-Create collections
   * @param organizationId The id of the organization
   * @param collectionPaths A list of collection paths
   * @return a map of collectionPath => id of the collection
   */
  async createCollections(organizationId: string, collectionPaths: Array<string>): Promise<Map<string, string>> {
    this._log.debug(`Creating the following collections for organization id ${organizationId}:\n${JSON.stringify(collectionPaths)}`)
    const retMap = new Map<string, string>()
    for (const collectionPath of collectionPaths) {
      retMap.set(collectionPath, await this.createCollection(organizationId, collectionPath))
    }
    return retMap
  }

  /**
   * Find an item (aka Password) in the bitwarden collection
   * @param organizationId the id of the organization
   * @param collectionId the id of the collection to search in
   * @param search the search string
   * @return the found items
   */
  async findItem(organizationId: string, collectionId: string, search: string): Promise<Array<Map<string, string>>> {
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

  /**
   * Create a new item based on the given item template
   * @param itemTemplate the filled-out item template
   * @return the id of the new item
   */
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

  /**
   * Delete the given item
   * @param itemId the id of the item to delete
   */
  async deleteItem(itemId: string) {
    this._log.debug(`Deleting item ${itemId}`)
    if (!this._dryrun) {
      await axios.delete(`${this._apiBaseUrl}/object/item/${itemId}`)
    }
  }

  /**
   * Add an attachment to an item
   * @param itemId the id of the item to add the attachment to
   * @param attachmentData the binary data in a FormData (field: file) object
   */
  async addAttachment(itemId: string, attachmentData: FormData) {
    this._log.info(`Adding attachment to item ${itemId}`)
    if (!this._dryrun) {
      await axios.post(`${this._apiBaseUrl}/attachment?id=${itemId}`, attachmentData.getBuffer(), attachmentData.getHeaders())
    }
  }
}
