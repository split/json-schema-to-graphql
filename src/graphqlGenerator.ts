import { printSchema } from 'graphql'
import { DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript'
import {
  AST,
  hasStandaloneName,
  TArray,
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

function declareNamedType(ast: TNamedInterface | TEnum | TNamedUnion, types: TypeMap = new Map()) {
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
  // There is no way to define named type for list in GraphQL so keeping those standalone
  if (ast.type !== 'ARRAY' && hasStandaloneName(ast)) {
    return declareNamedType(ast, types)
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
    case 'ARRAY':
      const itemType = declareStandaloneType(ast.params, types, getArrayItemName(ast, parentName))
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
          if (param.isPatternProperty || param.isUnreachableDefinition || param.keyName === '[k: string]') {
            return []
          }
          const standaloneType = declareStandaloneType(param.ast ?? param, types, ast.standaloneName)
          if (!standaloneType) {
            return []
          }

          const type = param.isRequired ? new GraphQLNonNull(standaloneType) : standaloneType
          return [[param.keyName, { type }]]
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

function getNamedAST(ast: AST, parentName: string): TEnum | TNamedInterface | TNamedUnion | undefined {
  // There is no way to define named type for list in GraphQL so keeping those standalone
  if (ast.type === 'ARRAY') {
    return undefined
  }
  if (hasStandaloneName(ast)) {
    return ast
  }
  // Unions can't be inlined in GraphQL. Deriving name for it from keyName and parent type
  if (ast.type === 'UNION') {
    const standaloneName = ast.keyName ? concatName(parentName, ast.keyName) : parentName
    return { ...ast, standaloneName }
  }
}

function getArrayItemName(ast: TArray, parentName: string) {
  return concatName(getArrayName(ast, parentName), 'item')
}

function getArrayName(ast: TArray, parentName: string) {
  if (hasStandaloneName(ast)) {
    return ast.standaloneName
  }
  if (ast.keyName) {
    return concatName(parentName, ast.keyName)
  }
  return parentName
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
