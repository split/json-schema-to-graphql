import { DEFAULT_OPTIONS, DEFAULT_PROCESSORS, Options } from 'json-schema-to-typescript'
import { formatGraphQL } from './graphqlFormatter'
import { generateGraphQL } from './graphqlGenerator'

const bannerComment = `#  Generated with json-schema-to-graphql.\n#  DON'T EDIT BY HAND!`

export const defaultOptions: Options = {
  ...DEFAULT_OPTIONS,
  bannerComment,
  processors: {
    ...DEFAULT_PROCESSORS,
    generate: generateGraphQL,
    format: formatGraphQL,
  },
}
