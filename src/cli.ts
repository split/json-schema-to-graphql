import path from 'path'
import fs from 'fs'
import { compileFromFile } from 'json-schema-to-typescript'
import { defaultOptions } from './graphqlOptions'

export { generateGraphQL, generateGraphQLSchema } from './graphqlGenerator'

async function main() {
  const filename = process.argv[2]
  const targetFilename = process.argv[3]
  if (!filename) {
    console.info('usage: json-schema-to-graphql input_file [output_file]')
    return process.exit(1)
  }
  const cwd = path.dirname(path.resolve(filename))

  const output = await compileFromFile(filename, {
    ...defaultOptions,
    cwd,
  })

  if (targetFilename) {
    fs.writeFileSync(targetFilename, output)
    console.log(`✅ Wrote to GraphQL schema to "${targetFilename}"`)
  } else {
    console.log(output)
  }
}

main()
