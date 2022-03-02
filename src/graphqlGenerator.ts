import { printSchema } from 'graphql'
import { DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript'
import { AST, hasStandaloneName, TNamedInterface } from 'json-schema-to-typescript/dist/src/types/AST'
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} from 'graphql/type'

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

  switch (ast.type) {
    case 'INTERFACE': {
      const paramTypeASTs = ast.params.map((param) => param.ast).concat(ast.superTypes)
      const paramTypes = paramTypeASTs.flatMap((ast) => declareNamedTypes(ast, processed))

      console.log(ast, paramTypeASTs, paramTypes)
      if (hasStandaloneName(ast)) {
        const namedType = declareNamedType(ast)
        return [namedType, ...paramTypes]
      }

      return paramTypes
    }
    default:
      return []
  }
}

function declareNamedType(ast: TNamedInterface) {
  return new GraphQLObjectType({
    name: ast.standaloneName,
    description: ast.comment,
    fields: Object.fromEntries(
      ast.params.flatMap<[string, GraphQLFieldConfig<unknown, unknown, unknown>]>((param) => {
        if (param.isPatternProperty || param.isUnreachableDefinition) {
          return []
        }
        const type = declareStandaloneType(param.ast)
        if (!type) {
          return []
        }
        return [[param.keyName, { type }]]
      })
    ),
  })
}

function declareStandaloneType(ast: AST) {
  switch (ast.type) {
    case 'STRING':
      return GraphQLString
    case 'NUMBER':
      return GraphQLFloat
    case 'BOOLEAN':
      return GraphQLBoolean
  }
}
