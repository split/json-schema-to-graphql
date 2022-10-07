// @ts-check

/**
 * @type {import('dts-cli').DtsConfig}
 */
module.exports = {
  rollup(config, options) {
    return {
      ...config,
      output: {
        ...config.output,
      },
      external(source, importer, isResolved) {
        if (source.includes('json-schema-to-typescript')) {
          return false
        }
        if (typeof config.external !== 'function') {
          throw new TypeError('Expecting external in configuration to be function')
        }
        return config.external(source, importer, isResolved)
      },
    }
  },
}
