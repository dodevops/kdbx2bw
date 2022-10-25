import { command, Command, ExpectedError, metadata, option, Options, ValidationContext, Validator } from 'clime'
import { constantCase } from 'case-anything'
import { Bitwarden } from '../api/bitwarden'
import { Migration } from '../api/migration'
import { Keepass } from '../api/keepass'
import { LogLevelDesc, setLevel } from 'loglevel'
import * as Path from 'path'

class MandatoryValueFromEnvValidator implements Validator<string> {
  public validate(value: string, context: ValidationContext) {
    if ('KDBX2BW_HELP' in process.env) {
      return
    }
    const envKey = constantCase(context.name)
    if (!value && !(envKey in process.env)) {
      throw new ExpectedError(`${context.name} is required, either as parameter or as environment variable ${envKey}`)
    }
  }
}

class MigrationOpts extends Options {
  @option({
    flag: 'h',
    description: 'The bitwarden REST API host started with bw serve (BITWARDEN_HOST)',
    default: 'localhost',
  })
  bitwardenHost: string

  @option({
    flag: 'P',
    description: 'The bitwarden REST API port started with bw serve (BITWARDEN_PORT)',
    default: 8087,
  })
  bitwardenPort: number

  @option({
    flag: 'b',
    description: 'The bitwarden unlock password (BITWARDEN_PASSWORD)',
    validator: new MandatoryValueFromEnvValidator(),
    default: '',
  })
  bitwardenPassword: string

  @option({
    flag: 'p',
    description: 'Keepass passphrase to unlock the database (KEEPASS_PASSPHRASE)',
    validator: new MandatoryValueFromEnvValidator(),
    default: '',
  })
  keepassPassphrase: string

  @option({
    flag: 'f',
    description: 'Keepass-file to migrate (KEEPASS_FILE)',
    validator: new MandatoryValueFromEnvValidator(),
    default: '',
  })
  keepassFile: string

  @option({
    flag: 'd',
    description: 'Only simulate migration (DRYRUN)',
    default: false,
  })
  dryrun: boolean

  @option({
    flag: 'g',
    description: 'Bitwarden Group IDs to add to each created collections during migration (DEFAULT_GROUP_IDS)',
    default: [],
  })
  defaultGroupIds: Array<string>

  @option({
    flag: 'o',
    description: 'Bitwarden Organization ID (BITWARDEN_ORGANIZATION_ID)',
    validator: new MandatoryValueFromEnvValidator(),
    default: '',
  })
  bitwardenOrganizationId: string

  @option({
    flag: 'r',
    description: 'Rewrite the created Bitwarden collection paths using Regexp:replacement (BITWARDEN_PATH_REWRITE)',
    default: [],
  })
  bitwardenPathRewrite: Array<string>

  @option({
    flag: 'l',
    description: 'Loglevel to set (trace, debug, info, warning, error) (LOGLEVEL)',
    default: 'error',
  })
  loglevel: string
}

@command({
  description: 'Migrate a keepass file into Bitwarden',
})
export default class extends Command {
  @metadata
  async execute(options: MigrationOpts) {
    for (const optionKey of Object.keys(options)) {
      const envKey = constantCase(optionKey)
      if (envKey in process.env) {
        if (typeof options[optionKey] == 'boolean') {
          options[optionKey] = process.env[envKey].toLowerCase() == 'true'
        } else if (typeof options[optionKey] == 'object') {
          options[optionKey] = process.env[envKey].split(',')
        } else {
          options[optionKey] = process.env[envKey]
        }
      }
    }

    setLevel(options.loglevel as LogLevelDesc)

    const bitwardenApi = new Bitwarden(
      `http://${options.bitwardenHost}:${options.bitwardenPort}`,
      options.bitwardenPassword,
      options.defaultGroupIds,
      options.dryrun
    )

    const keepassApi = new Keepass(options.keepassFile, options.keepassPassphrase)

    await bitwardenApi.unlock()

    const pathRewrites: Array<PathRewrite> = options.bitwardenPathRewrite.map((rewriteOption) => {
      return {
        regex: new RegExp(rewriteOption.split(':')[0]),
        replace: rewriteOption.split(':')[1],
      }
    })

    try {
      await new Migration(options.bitwardenOrganizationId, keepassApi, bitwardenApi, pathRewrites).migrate()
    } catch (error) {
      if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        console.log(error.response.data)
        console.log(error.response.status)
        console.log(error.response.headers)
      } else if (error.request) {
        // The request was made but no response was received
        // `error.request` is an instance of XMLHttpRequest in the browser and an instance of
        // http.ClientRequest in node.js
        console.log(error.request)
      } else {
        // Something happened in setting up the request that triggered an Error
        console.log('Error', error.message)
      }
      console.log(error.config)
    }
  }
}
