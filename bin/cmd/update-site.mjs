import chalk from 'chalk'
import Debug from 'debug'
import fs from 'fs'
import path from 'path'

import { spawnSync } from 'child_process'

import { DATA_FOLDER, MARKDOWN_FOLDER, SUPPORTED_VERSIONS, SRC_JSON_FOLDER, SRC_PAGES_FOLDER } from '../config.mjs'

const debug = Debug('sfcc-docs:update-site')
const SEP = path.sep

export default (cli) => {
  if (cli.verbose) {
    debug(chalk.magenta.bold('CMD:'), 'update-site')
    debug(chalk.magenta.bold('VERSIONS:'), cli.version ? cli.version.split(',').join(', ') : 'All')
  }

  // Get current supported versions
  const versions = Object.keys(SUPPORTED_VERSIONS)

  // Loop through supported versions
  versions.forEach((version) => {
    // Check if we should skip this version
    if (cli.version && !cli.version.split(',').includes(version)) {
      if (cli.verbose) {
        debug(chalk.dim(`SKIPPING: ${version}`))
      }

      return
    }

    debug(chalk.green.bold(`UPDATING SITE: v${version}`))

    // Remove old version folder if it exists
    if (fs.existsSync(`${SRC_PAGES_FOLDER}${SEP}${version}`)) {
      spawnSync('rm', ['-fr', `${SRC_PAGES_FOLDER}${SEP}${version}`])
    }

    // Copy new version folder
    spawnSync('cp', ['-r', `${MARKDOWN_FOLDER}${SEP}${version}`, SRC_PAGES_FOLDER])

    debug(chalk.dim(`✔ Complete`))
  })

  // Remove old version folder if it exists
  if (fs.existsSync(SRC_JSON_FOLDER)) {
    spawnSync('rm', ['-fr', `${SRC_JSON_FOLDER}${SEP}*.json`], { shell: true })
  }

  if (!fs.existsSync(SRC_JSON_FOLDER)) {
    fs.mkdirSync(SRC_JSON_FOLDER, { recursive: true })
  }

  // Copy new version folder
  spawnSync('cp', ['-r', `${DATA_FOLDER}${SEP}*.json`, SRC_JSON_FOLDER], { shell: true })

  debug(chalk.green.bold('✅ ALL DONE (๑˃̵ᴗ˂̵)و '))
}