import { printSchema } from 'graphql'
import { DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript'
import {
  AST,
  hasStandaloneName,
  TEnum,
  TLiteral,
  TNamedInterface,
  TUnion,
} from 'json-schema-to-typescript/dist/src/types/AST'
import {
  GraphQLBoolean,
  GraphQLEnumType,
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
type Named<T extends { standaloneName?: string }> = T & { standaloneName: string }

export function generateGraphQL(ast: AST, options: GeneratorOptions = DEFAULT_OPTIONS) {
  const schema = generateGraphQLSchema(ast)
  return [options.bannerComment, printSchema(schema)].filter(Boolean).join('\n\n')
}

export function generateGraphQLSchema(ast: AST) {
  return new GraphQLSchema({
    types: declareNamedTypes(ast),
  })
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
      const unionType = hasStandaloneName(ast) && declareUnionType(ast, types)
      return unionType ? [unionType] : []

    default:
      return []
  }
}

function declareNamedType(ast: TNamedInterface | TEnum | Named<TUnion>, types: TypeMap) {
  if (types.has(ast.standaloneName)) {
    return types.get(ast.standaloneName)!
  }
  switch (ast.type) {
    case 'INTERFACE':
      return declareObjectType(ast, types)
    case 'UNION':
      if (isLiteralNamedUnion(ast)) {
        return declareStringUnionAsEnum(ast, types)
      }
      return declareUnionType(ast, types)
    case 'ENUM':
      return declareEnumType(ast, types)
    default:
      throw new TypeError('Not supported named type')
  }
}

function declareStandaloneType(ast: AST, types: TypeMap): GraphQLOutputType | undefined {
  if (hasStandaloneName(ast)) {
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

function declareObjectType(ast: TNamedInterface, types: TypeMap) {
  const namedType = new GraphQLObjectType({
    name: ast.standaloneName,
    description: ast.comment,
    fields: () =>
      Object.fromEntries(
        ast.params.flatMap<[string, GraphQLFieldConfig<unknown, unknown, unknown>]>((param) => {
          if (param.isPatternProperty || param.isUnreachableDefinition) {
            return []
          }
          const standaloneType = declareStandaloneType(param.ast ?? param, types)
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

function declareUnionType(ast: Named<TUnion>, types: TypeMap) {
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

function declareEnumType(ast: TEnum, types: TypeMap) {
  const enumType = new GraphQLEnumType({
    name: ast.standaloneName,
    description: ast.comment,
    values: Object.fromEntries(ast.params.map((param) => [param.keyName, { value: param.keyName }])),
  })
  types.set(ast.standaloneName, enumType)
  return enumType
}

/**
 * There is no way to express string literal unions in GraphQL so those need to be translated to enum
 *
 * Also missing mistake in types of the TLiteral as it's missing correct params
 */
type TLiteralWithParams = TLiteral & { params: string }
type TLiteralNamedUnion = Omit<Named<TUnion>, 'params'> & { params: TLiteralWithParams[] }

function declareStringUnionAsEnum(ast: TLiteralNamedUnion, types: TypeMap) {
  const enumType = new GraphQLEnumType({
    name: ast.standaloneName,
    description: ast.comment,
    values: Object.fromEntries(ast.params.map((param) => [param.params, { value: param.params }])),
  })
  types.set(ast.standaloneName, enumType)
  return enumType
}

function isLiteralNamedUnion(ast: TUnion): ast is TLiteralNamedUnion {
  return hasStandaloneName(ast) && ast.type === 'UNION' && ast.params[0].type === 'LITERAL'
}
