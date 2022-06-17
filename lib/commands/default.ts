import { command, Command, ExpectedError, metadata, option, Options, ValidationContext, Validator } from 'clime'
import { constantCase } from 'case-anything'

class MandatoryValueFromEnvValidator implements Validator<string> {
  public validate(value: string, context: ValidationContext) {
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
    default: 8007,
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
}

@command({
  description: 'Migrate a keepass file into Bitwarden',
})
export default class extends Command {
  @metadata
  execute(options: MigrationOpts) {
    for (const optionKey in Object.keys(options)) {
      const envKey = constantCase(optionKey)
      if (envKey in process.env) {
        options[optionKey] = process.env[envKey]
      }
    }
  }
}
