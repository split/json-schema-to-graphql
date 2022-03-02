import { printSchema } from 'graphql'
import { DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript'
import { AST } from 'json-schema-to-typescript/dist/src/types/AST'
import { GraphQLNamedType, GraphQLSchema } from 'graphql/type'

export type GeneratorOptions = Pick<Options, 'bannerComment'>

export function generateGraphQL(ast: AST, options: GeneratorOptions = DEFAULT_OPTIONS) {
  const schema = generateGraphQLSchema(ast)
  return [options.bannerComment, printSchema(schema)].filter(Boolean).join('\n\n')
}

export function generateGraphQLSchema(ast: AST) {
  const schema = new GraphQLSchema({
    types: declareNamedTypes(ast),
  })
  return schema
}

function declareNamedTypes(ast: AST, processed = new Set<AST>()): GraphQLNamedType[] {
  if (processed.has(ast)) return []
  processed.add(ast)

  return []
}
