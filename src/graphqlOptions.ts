import { DEFAULT_OPTIONS, DEFAULT_PROCESSORS, Options } from 'json-schema-to-typescript'
import { generateGraphQL } from './graphqlGenerator'

const bannerComment = `"""
  Generated with json-schema-to-graphql.
  DON'T EDIT BY HAND!
"""`

export const defaultOptions: Options = {
  ...DEFAULT_OPTIONS,
  format: false,
  bannerComment,
  processors: {
    ...DEFAULT_PROCESSORS,
    generate: generateGraphQL,
  },
}
