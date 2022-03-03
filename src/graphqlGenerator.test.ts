import { compile, DEFAULT_OPTIONS, DEFAULT_PROCESSORS, JSONSchema, Options } from 'json-schema-to-typescript'
import { generateGraphQL } from './graphqlGenerator'

const defaultTestOptions: Options = {
  ...DEFAULT_OPTIONS,
  format: false,
  bannerComment: '',
  processors: {
    ...DEFAULT_PROCESSORS,
    generate: generateGraphQL,
  },
}

function compileSchema(schema: JSONSchema, options: Partial<Options> = defaultTestOptions) {
  return compile(schema, 'test', options)
}

describe('generateGraphQL', () => {
  it('should render only banner for empty schema', () => {
    expect(generateGraphQL({ type: 'NULL' }, { bannerComment: '/* I was generated */' })).toEqual(
      '/* I was generated */'
    )
  })

  it('should prepend banner to the schema output', async () => {
    const schema: JSONSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Hello',
      additionalProperties: false,
      properties: {
        world: { type: 'string' },
      },
    }
    expect(await compileSchema(schema, { ...defaultTestOptions, bannerComment: '/* I was generated */' }))
      .toMatchInlineSnapshot(`
      "/* I was generated */

      type Hello {
        world: String
      }"
    `)
  })

  it('should compile named interface with scalar values', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car model',
      additionalProperties: false,
      properties: {
        model: { type: 'string' },
        year: { type: 'number' },
        electric: { type: 'boolean' },
      },
    })

    expect(graphql).toMatchInlineSnapshot(`
      "type CarModel {
        model: String
        year: Float
        electric: Boolean
      }"
    `)
  })

  it('should compile required fields', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car model',
      additionalProperties: false,
      properties: {
        model: { type: 'string' },
        year: { type: 'number' },
        electric: { type: 'boolean' },
      },
      required: ['model', 'year', 'electric'],
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type CarModel {
        model: String!
        year: Float!
        electric: Boolean!
      }"
    `)
  })

  it('should compile named type as field value', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Owned things',
      additionalProperties: false,
      properties: {
        car: {
          type: 'object',
          title: 'Car',
          additionalProperties: false,
          properties: {
            model: { type: 'string' },
          },
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type OwnedThings {
        car: Car
      }

      type Car {
        model: String
      }"
    `)
  })

  it('should compile list of strings', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Store',
      additionalProperties: false,
      properties: {
        names: { type: 'array', items: { type: 'string' } },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Store {
        names: [String!]
      }"
    `)
  })

  it('should compile list of named types', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Parking lot',
      additionalProperties: false,
      properties: {
        cars: { type: 'array', items: { $ref: '#/$defs/car' } },
      },
      required: ['cars'],
      $defs: {
        car: {
          type: 'object',
          title: 'Car',
          additionalProperties: false,
          properties: {
            model: { type: 'string' },
          },
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type ParkingLot {
        cars: [Car!]!
      }

      type Car {
        model: String
      }"
    `)
  })
})
