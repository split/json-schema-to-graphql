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

  it('should compile nested types inside of default name when no name given', async () => {
    const schema: JSONSchema = {
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      additionalProperties: false,
      properties: {
        world: { title: 'World', type: 'object', properties: { hello: { type: 'string' } } },
      },
    }
    expect(await compileSchema(schema)).toMatchInlineSnapshot(`
      "type Test {
        world: World
      }

      type World {
        hello: String
      }"
    `)
  })

  it('should compile objects without generic fields', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Driver',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
      },
      patternProperties: {
        '.*': { type: 'string' },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Driver {
        name: String
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

  it('should keep named lists as standalone types', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Parking lot',
      additionalProperties: false,
      properties: {
        cars: { title: 'Cars', type: 'array', items: { $ref: '#/$defs/car' } },
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

  it('should compile union of named types', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Vehicle',
      type: 'object',
      oneOf: [{ $ref: '#/$defs/car' }, { $ref: '#/$defs/bike' }, { $ref: '#/$defs/airplane' }],
      $defs: {
        car: {
          type: 'object',
          title: 'Car',
          additionalProperties: false,
          properties: {
            model: { type: 'string' },
          },
        },
        bike: {
          type: 'object',
          title: 'Bike',
          additionalProperties: false,
          properties: {
            numberOfWheels: { type: 'number' },
          },
          required: ['numberOfWheels'],
        },
        airplane: {
          type: 'object',
          title: 'Airplane',
          additionalProperties: false,
          properties: {
            numberOfPassengers: { type: 'number' },
          },
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "union Vehicle = Car | Bike | Airplane

      type Car {
        model: String
      }

      type Bike {
        numberOfWheels: Float!
      }

      type Airplane {
        numberOfPassengers: Float
      }"
    `)
  })

  it('should compile union of named types when nested to list', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      title: 'Owned things',
      type: 'object',
      additionalProperties: false,
      properties: {
        vehicles: {
          type: 'array',
          items: {
            title: 'Vehicle',
            type: 'object',
            oneOf: [{ $ref: '#/$defs/car' }, { $ref: '#/$defs/bike' }, { $ref: '#/$defs/airplane' }],
          },
        },
      },
      $defs: {
        vehicle: {
          title: 'Vehicle',
          type: 'object',
          oneOf: [{ $ref: '#/$defs/car' }, { $ref: '#/$defs/bike' }, { $ref: '#/$defs/airplane' }],
        },
        car: {
          type: 'object',
          title: 'Car',
          additionalProperties: false,
          properties: {
            model: { type: 'string' },
          },
        },
        bike: {
          type: 'object',
          title: 'Bike',
          additionalProperties: false,
          properties: {
            numberOfWheels: { type: 'number' },
          },
          required: ['numberOfWheels'],
        },
        airplane: {
          type: 'object',
          title: 'Airplane',
          additionalProperties: false,
          properties: {
            numberOfPassengers: { type: 'number' },
          },
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type OwnedThings {
        vehicles: [Vehicle!]
      }

      union Vehicle = Car | Bike | Airplane

      type Car {
        model: String
      }

      type Bike {
        numberOfWheels: Float!
      }

      type Airplane {
        numberOfPassengers: Float
      }"
    `)
  })

  it('should compile string literals as enum', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car',
      additionalProperties: false,
      properties: {
        power: { title: 'Power', type: 'string', enum: ['gasoline', 'diesel', 'electric', 'hybrid'] },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Car {
        power: Power
      }

      enum Power {
        gasoline
        diesel
        electric
        hybrid
      }"
    `)
  })

  it('should compile string literals as enum with custom names', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car',
      additionalProperties: false,
      properties: {
        power: {
          title: 'Power',
          type: 'string',
          enum: ['gasoline', 'diesel', 'electric', 'hybrid'],
          tsEnumNames: ['POWER_GASOLINE', 'POWER_DIESEL', 'POWER_ELECTRIC', 'POWER_HYBRID'],
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Car {
        power: Power
      }

      enum Power {
        POWER_GASOLINE
        POWER_DIESEL
        POWER_ELECTRIC
        POWER_HYBRID
      }"
    `)
  })

  it('should sanitize names that contain characters not valid to GraphQL', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'string',
      title: 'Power',
      enum: ['FOO-8_X', 'PIU$#59'],
    })
    expect(graphql).toMatchInlineSnapshot(`
      "enum Power {
        FOO_8_X
        PIU_59
      }"
    `)
  })
})
