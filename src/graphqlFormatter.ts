import { format as prettify } from 'prettier'
import { DEFAULT_OPTIONS } from 'json-schema-to-typescript'

type Formatter = typeof DEFAULT_OPTIONS.processors.format

export const formatGraphQL: Formatter = (code, options) => {
  if (!options.format) {
    return code
  }
  return prettify(code, { parser: 'graphql', ...options.style })
}
