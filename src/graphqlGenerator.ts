import { printSchema } from 'graphql'
import { DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript'
import { AST, hasStandaloneName, TNamedInterface } from 'json-schema-to-typescript/dist/src/types/AST'
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
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

      if (hasStandaloneName(ast)) {
        const namedType = declareNamedType(ast)
        return [namedType, ...paramTypes]
      }

      return paramTypes
    }
    case 'ARRAY':
      return declareNamedTypes(ast.params, processed)

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
        const standaloneType = declareStandaloneType(param.ast)
        if (!standaloneType) {
          return []
        }
        const type = param.isRequired ? new GraphQLNonNull(standaloneType) : standaloneType
        return [[param.keyName, { type }]]
      })
    ),
  })
}

function declareStandaloneType(ast: AST): GraphQLOutputType | undefined {
  switch (ast.type) {
    case 'STRING':
      return GraphQLString
    case 'NUMBER':
      return GraphQLFloat
    case 'BOOLEAN':
      return GraphQLBoolean
    case 'ARRAY':
      const itemType = declareStandaloneType(ast.params)
      return itemType && new GraphQLList(new GraphQLNonNull(itemType))
  }
}
