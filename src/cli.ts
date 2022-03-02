import path from 'path'
import { compileFromFile, DEFAULT_OPTIONS, DEFAULT_PROCESSORS } from 'json-schema-to-typescript'
import { generateGraphQL } from './graphqlGenerator'

function main() {
  const filename = process.argv[2]
  const cwd = path.dirname(path.resolve(filename))

  return compileFromFile(filename, {
    ...DEFAULT_OPTIONS,
    cwd,
    format: false,
    processors: {
      ...DEFAULT_PROCESSORS,
      generate: generateGraphQL,
    },
  })
}

main()
