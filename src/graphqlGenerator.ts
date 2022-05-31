import { printSchema } from 'graphql'
import { DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript'
import {
  AST,
  hasStandaloneName,
  TArray,
  TEnum,
  TInterface,
  TIntersection,
  TLiteral,
  TNamedInterface,
  TTuple,
  TUnion,
} from 'json-schema-to-typescript/dist/src/types/AST'
import {
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfig,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
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

type TypeMap = Map<AST, GraphQLNamedOutputType>

type TNamedUnion = TUnion & { standaloneName: string }
type TNamedIntersection = TIntersection & { standaloneName: string }
type TNamedAST = TNamedInterface | TEnum | TNamedUnion | TNamedIntersection
type TLiteralString = TLiteral & { params: string }
type TUnionOfStringLiterals = Omit<TNamedUnion, 'params'> & { params: TLiteralString[] }

export function generateGraphQL(ast: AST, options: GeneratorOptions = DEFAULT_OPTIONS) {
  const schema = generateGraphQLSchema(ast)
  return [options.bannerComment, schema && printSchema(schema)].filter(Boolean).join('\n\n')
}

export function generateGraphQLSchema(ast: AST) {
  if (!hasStandaloneName(ast)) {
    return null
  }
  return new GraphQLSchema({
    types: [declareNamedType(ast, new Map())],
  })
}

function declareNamedType(ast: TNamedAST, types: TypeMap = new Map()): GraphQLNamedOutputType {
  if (types.has(ast)) {
    return types.get(ast)!
  }
  switch (ast.type) {
    case 'INTERFACE':
      return declareObjectType(ast, types)
    case 'UNION':
      if (isUnionOfStringLiterals(ast)) {
        return declareUnionOfStringLiteralsAsEnum(ast, types)
      }
      return declareUnionType(ast, types)
    case 'ENUM':
      return declareEnumType(ast, types)
    case 'INTERSECTION':
      return declareNamedType(mergeIntersectionTypes(ast), types)
    default:
      throw new TypeError('Not supported named type')
  }
}

function declareStandaloneType(ast: AST, types: TypeMap, parentName: string): GraphQLOutputType | undefined {
  // Drop type fields from the objects. There is already __typename available
  if (isTypeKindField(ast)) {
    return undefined
  }
  const namedAST = getNamedAST(ast, parentName)
  if (namedAST) {
    return declareNamedType(namedAST, types)
  }
  switch (ast.type) {
    case 'STRING':
      if (ast.keyName && isIdentifierField(ast.keyName)) {
        return GraphQLID
      }
      return GraphQLString
    case 'NUMBER':
      if (ast.isInteger) {
        return GraphQLInt
      }
      return GraphQLFloat
    case 'BOOLEAN':
      return GraphQLBoolean
    case 'ARRAY': {
      const itemType = declareStandaloneType(ast.params, types, getArrayOrTupleItemName(ast, parentName))
      return itemType && new GraphQLList(new GraphQLNonNull(itemType))
    }
    case 'TUPLE': {
      const firstItem = ast.params[0]
      if (ast.params.some((item) => item.type !== firstItem.type)) {
        throw new TypeError(`Tuples containing multiple types are not supported currently`)
      }
      // There are no tuples in GraphQL, so representing those as lists
      const standaloneType = declareStandaloneType(firstItem, types, getArrayOrTupleItemName(ast, parentName))
      return standaloneType && new GraphQLList(new GraphQLNonNull(standaloneType))
    }
  }
}

function declareObjectType(ast: TNamedInterface, types: TypeMap) {
  const namedType = new GraphQLObjectType({
    name: ast.standaloneName,
    description: ast.comment,
    fields: () =>
      Object.fromEntries(
        ast.params.flatMap<[string, GraphQLFieldConfig<unknown, unknown, unknown>]>((param) => {
          if (param.isPatternProperty || param.isUnreachableDefinition || param.keyName === '[k: string]') {
            return []
          }
          const standaloneType = declareStandaloneType(param.ast ?? param, types, ast.standaloneName)
          if (!standaloneType) {
            return []
          }
          const type = param.isRequired ? new GraphQLNonNull(standaloneType) : standaloneType
          return [[param.keyName, { type, description: param.ast?.comment }]]
        })
      ),
  })
  types.set(ast, namedType)
  return namedType
}

function declareUnionType(ast: TNamedUnion, types: TypeMap) {
  const unionType = new GraphQLUnionType({
    name: ast.standaloneName,
    description: ast.comment,
    types: ast.params.flatMap((param) => {
      const itemType = declareStandaloneType(param, types, ast.standaloneName)
      if (itemType instanceof GraphQLObjectType) {
        return [itemType]
      }
      return []
    }),
  })
  types.set(ast, unionType)
  return unionType
}

function declareEnumType(ast: TEnum, types: TypeMap) {
  const enumType = new GraphQLEnumType({
    name: ast.standaloneName,
    description: ast.comment,
    values: Object.fromEntries(ast.params.map((param) => [sanitizeName(param.keyName), { value: param.keyName }])),
  })
  types.set(ast, enumType)
  return enumType
}

function getNamedAST(ast: AST, parentName: string): TNamedAST | undefined {
  // There is no way to define named type for list in GraphQL so keeping those standalone
  if (ast.type === 'ARRAY') {
    return undefined
  }
  // Unions can't be inlined or intersections defined in GraphQL
  if (ast.type === 'INTERSECTION' || ast.type === 'UNION') {
    return inferStandaloneName(ast, parentName)
  }
  if (hasStandaloneName(ast)) {
    return ast
  }
}

/**
 * GraphQL doesn't support intersection. Merging those types to single named type
 *
 * Todo: migrate to json-schema-merge-allof when it keeps reference identities intact
 */
function mergeIntersectionTypes(ast: TNamedIntersection): TNamedInterface {
  const interfaces = ast.params.filter((param): param is TInterface => param.type === 'INTERFACE')
  if (interfaces.length !== ast.params.length) {
    throw new TypeError('Intersection contains other then interface types')
  }
  return Object.assign(ast as any, {
    type: 'INTERFACE',
    superTypes: interfaces.flatMap((iast) => iast.superTypes),
    params: interfaces.flatMap((iast) => iast.params),
  })
}

/**
 * There is no way to express string literal unions in GraphQL so those need to be translated to enum
 */
function declareUnionOfStringLiteralsAsEnum(ast: TUnionOfStringLiterals, types: TypeMap) {
  const enumType = new GraphQLEnumType({
    name: ast.standaloneName,
    description: ast.comment,
    values: Object.fromEntries(ast.params.map((param) => [sanitizeName(param.params), { value: param.params }])),
  })
  types.set(ast, enumType)
  return enumType
}

function isUnionOfStringLiterals(ast: TUnion): ast is TUnionOfStringLiterals {
  return hasStandaloneName(ast) && ast.type === 'UNION' && ast.params.every(isStringLiteral)
}

function isStringLiteral(ast: AST): ast is TLiteralString {
  return ast.type === 'LITERAL' && typeof ast.params === 'string'
}

function isTypeKindField(ast: AST) {
  return ast.type === 'UNION' && isUnionOfStringLiterals(ast) && ast.params.length <= 1
}

function inferStandaloneName(ast: AST, parentName: string): TNamedAST {
  if (hasStandaloneName(ast)) {
    return ast
  }
  ast.standaloneName = ast.keyName ? concatName(parentName, ast.keyName) : parentName
  return ast as TNamedAST
}

function getArrayOrTupleItemName(ast: TArray | TTuple, parentName: string) {
  return concatName(getArrayOrTupleName(ast, parentName), 'item')
}

function getArrayOrTupleName(ast: TArray | TTuple, parentName: string) {
  if (hasStandaloneName(ast)) {
    return ast.standaloneName
  }
  if (ast.keyName) {
    return concatName(parentName, ast.keyName)
  }
  return parentName
}

export function sanitizeName(name: string): string {
  return name.replace(/[^[_a-zA-Z0-9_]+/g, '_').replace(/(^_+|_+$)/g, '')
}

export function concatName(...nameParts: string[]): string {
  return nameParts.map(ucfirst).join('')
}

function ucfirst(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

export function isIdentifierField(keyName: string) {
  return /(^i|I)[dD]$/.test(keyName)
}
