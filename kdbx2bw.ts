#!/usr/bin/env node
/* istanbul ignore file */

import * as Path from 'path'
import { CLI, Shim } from 'clime'

// The second parameter is the path to folder that contains command modules.
const cli = new CLI('kdbx2bw', Path.join(__dirname, 'lib', 'commands'))

// Clime in its core provides an object-based command-line infrastructure.
// To have it work as a common CLI, a shim needs to be applied:
const shim = new Shim(cli)

if (process.argv.indexOf('--help') !== -1) {
  // --help was called. Add the required variables to workaround env validation
  process.env['KDBX2BW_HELP'] = 'true'
}

shim.execute(process.argv)
