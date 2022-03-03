import { printSchema } from 'graphql'
import { DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript'
import { AST, hasStandaloneName, TNamedInterface, TUnion } from 'json-schema-to-typescript/dist/src/types/AST'
import {
  GraphQLBoolean,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLList,
  GraphQLNamedOutputType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLSchema,
  GraphQLString,
  GraphQLUnionType,
} from 'graphql/type'

export type GeneratorOptions = Pick<Options, 'bannerComment'>

type TypeMap = Map<string, GraphQLNamedOutputType>

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

function declareNamedTypes(ast: AST, processed = new Set<AST>(), types: TypeMap = new Map()): GraphQLNamedOutputType[] {
  if (processed.has(ast)) return []
  processed.add(ast)

  switch (ast.type) {
    case 'INTERFACE': {
      if (hasStandaloneName(ast)) {
        const namedType = declareNamedType(ast, types)
        return [namedType]
      } else {
        const paramTypeASTs = ast.params.map((param) => param.ast).concat(ast.superTypes)
        return paramTypeASTs.flatMap((ast) => declareNamedTypes(ast, processed))
      }
    }
    case 'ARRAY':
      return declareNamedTypes(ast.params, processed, types)

    case 'UNION':
      const unionType = declareUnionType(ast, types)
      return unionType ? [unionType] : []

    default:
      return []
  }
}

function declareNamedType(ast: TNamedInterface, types: TypeMap) {
  if (types.has(ast.standaloneName)) {
    return types.get(ast.standaloneName)!
  }
  const namedType = new GraphQLObjectType({
    name: ast.standaloneName,
    description: ast.comment,
    fields: () =>
      Object.fromEntries(
        ast.params.flatMap<[string, GraphQLFieldConfig<unknown, unknown, unknown>]>((param) => {
          if (param.isPatternProperty || param.isUnreachableDefinition) {
            return []
          }
          const standaloneType = declareStandaloneType(param.ast, types)
          if (!standaloneType) {
            return []
          }

          const type = param.isRequired ? new GraphQLNonNull(standaloneType) : standaloneType
          return [[param.keyName, { type }]]
        })
      ),
  })
  types.set(ast.standaloneName, namedType)
  return namedType
}

function declareStandaloneType(ast: AST, types: TypeMap): GraphQLOutputType | undefined {
  if (hasStandaloneName(ast)) {
    if (ast.type === 'ENUM') {
      throw new TypeError('Enums not implemented yet')
    }
    return declareNamedType(ast, types)
  }
  switch (ast.type) {
    case 'STRING':
      return GraphQLString
    case 'NUMBER':
      return GraphQLFloat
    case 'BOOLEAN':
      return GraphQLBoolean
    case 'ARRAY':
      const itemType = declareStandaloneType(ast.params, types)
      return itemType && new GraphQLList(new GraphQLNonNull(itemType))
  }
}

function declareUnionType(ast: TUnion, types: TypeMap) {
  if (!hasStandaloneName(ast)) {
    return null
  }
  if (types.has(ast.standaloneName)) {
    return types.get(ast.standaloneName)!
  }
  const unionType = new GraphQLUnionType({
    name: ast.standaloneName,
    description: ast.comment,
    types: ast.params.flatMap((param) => {
      const itemType = declareStandaloneType(param, types)
      if (itemType instanceof GraphQLObjectType) {
        return [itemType]
      }
      return []
    }),
  })
  types.set(ast.standaloneName, unionType)
  return unionType
}
