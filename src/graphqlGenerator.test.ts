import { compile, DEFAULT_OPTIONS, DEFAULT_PROCESSORS, JSONSchema, Options } from 'json-schema-to-typescript'
import { generateGraphQL, isIdentifierField, sanitizeName } from './graphqlGenerator'
import { defaultOptions } from './graphqlOptions'

const defaultTestOptions: Options = {
  ...defaultOptions,
  bannerComment: '',
}

function compileSchema(schema: JSONSchema, options: Partial<Options> = defaultTestOptions) {
  return compile(schema, 'test', options)
}

describe('generateGraphQL', () => {
  it('should render only banner for empty schema', () => {
    expect(generateGraphQL({ type: 'NULL' }, { bannerComment: '# I was generated' })).toEqual('# I was generated')
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
    expect(await compileSchema(schema, { ...defaultTestOptions, bannerComment: '# I was generated' }))
      .toMatchInlineSnapshot(`
      "# I was generated

      type Hello {
        world: String
      }
      "
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
        year: { type: 'integer' },
        electric: { type: 'boolean' },
        weight: { type: 'number' },
      },
    })

    expect(graphql).toMatchInlineSnapshot(`
      "type CarModel {
        model: String
        year: Int
        electric: Boolean
        weight: Float
      }
      "
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
        year: { type: 'integer' },
        electric: { type: 'boolean' },
        weight: { type: 'number' },
      },
      required: ['model', 'year', 'electric', 'weight'],
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type CarModel {
        model: String!
        year: Int!
        electric: Boolean!
        weight: Float!
      }
      "
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
      }
      "
    `)
  })

  it('should compile descriptions as comments', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Owned things',
      additionalProperties: false,
      properties: {
        car: {
          type: 'object',
          title: 'Car',
          description: 'Wheeled motor vehicle used for transportation.',
          additionalProperties: false,
          properties: {
            model: { type: 'string', description: 'Name of the car model given by manufacturer' },
            power: {
              title: 'Power',
              type: 'string',
              enum: ['gasoline', 'diesel', 'electric', 'hybrid'],
              description: 'What car uses for primary power to move',
            },
          },
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type OwnedThings {
        \\"\\"\\"
        Wheeled motor vehicle used for transportation.
        \\"\\"\\"
        car: Car
      }

      \\"\\"\\"
      Wheeled motor vehicle used for transportation.
      \\"\\"\\"
      type Car {
        \\"\\"\\"
        Name of the car model given by manufacturer
        \\"\\"\\"
        model: String

        \\"\\"\\"
        What car uses for primary power to move
        \\"\\"\\"
        power: Power
      }

      \\"\\"\\"
      What car uses for primary power to move
      \\"\\"\\"
      enum Power {
        gasoline
        diesel
        electric
        hybrid
      }
      "
    `)
  })

  it('should compile when multiple fields reference same type', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Family',
      additionalProperties: false,
      properties: {
        dailyDriver: { $ref: '#/$defs/car' },
        inService: { type: 'array', items: { $ref: '#/$defs/car' } },
      },
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
      "type Family {
        dailyDriver: Car
        inService: [Car!]
      }

      type Car {
        model: String
      }
      "
    `)
  })

  it('should introduce separate type definition for duplicate named types', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Family',
      additionalProperties: false,
      properties: {
        dailyDriver: { $ref: '#/$defs/car' },
        inService: { type: 'array', items: { $ref: '#/$defs/duplicateCar' } },
      },
      $defs: {
        car: {
          type: 'object',
          title: 'Car',
          additionalProperties: false,
          properties: {
            model: { type: 'string' },
          },
        },
        duplicateCar: {
          type: 'object',
          title: 'Car',
          additionalProperties: false,
          properties: {
            modelName: { type: 'string' },
          },
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Family {
        dailyDriver: Car
        inService: [Car1!]
      }

      type Car {
        model: String
      }

      type Car1 {
        modelName: String
      }
      "
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
      }
      "
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
      }
      "
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
      }
      "
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
      }
      "
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
      }
      "
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
            numberOfWheels: { type: 'integer' },
          },
          required: ['numberOfWheels'],
        },
        airplane: {
          type: 'object',
          title: 'Airplane',
          additionalProperties: false,
          properties: {
            numberOfPassengers: { type: 'integer' },
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
        numberOfWheels: Int!
      }

      type Airplane {
        numberOfPassengers: Int
      }
      "
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
            numberOfWheels: { type: 'integer' },
          },
          required: ['numberOfWheels'],
        },
        airplane: {
          type: 'object',
          title: 'Airplane',
          additionalProperties: false,
          properties: {
            numberOfPassengers: { type: 'integer' },
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
        numberOfWheels: Int!
      }

      type Airplane {
        numberOfPassengers: Int
      }
      "
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
      }
      "
    `)
  })

  it('should compile tuples with single type as lists', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car',
      additionalProperties: false,
      properties: {
        comparedModels: { type: 'array', items: { type: 'string' }, minItems: 2, maxItems: 2 },
        comparePower: { type: 'array', items: { $ref: '#/$defs/Power' }, minItems: 2, maxItems: 2 },
      },
      $defs: {
        Power: { title: 'Power', type: 'string', enum: ['gasoline', 'diesel', 'electric', 'hybrid'] },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Car {
        comparedModels: [String!]
        comparePower: [Power!]
      }

      enum Power {
        gasoline
        diesel
        electric
        hybrid
      }
      "
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
      }
      "
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
      }
      "
    `)
  })

  it('should use ID for identifier fields', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car',
      additionalProperties: false,
      properties: {
        carID: { type: 'string' },
      },
      required: ['carID'],
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Car {
        carID: ID!
      }
      "
    `)
  })

  it('should drop enums that are used only for literal type', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car',
      additionalProperties: false,
      properties: {
        carID: { type: 'string' },
        type: { $ref: '#/$defs/CarType' },
      },
      required: ['carID'],
      $defs: {
        CarType: {
          type: 'string',
          enum: ['CAR'],
          title: 'CarType',
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Car {
        carID: ID!
      }
      "
    `)
  })

  it('should create named type for unnamed union property', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car',
      additionalProperties: false,
      properties: {
        category: {
          type: 'string',
          enum: ['POWER_GASOLINE', 'POWER_DIESEL', 'POWER_ELECTRIC', 'POWER_HYBRID'],
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Car {
        category: CarCategory
      }

      enum CarCategory {
        POWER_GASOLINE
        POWER_DIESEL
        POWER_ELECTRIC
        POWER_HYBRID
      }
      "
    `)
  })

  it('should create named type for unnamed array item', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'Car',
      additionalProperties: false,
      properties: {
        selectedCategories: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['POWER_GASOLINE', 'POWER_DIESEL', 'POWER_ELECTRIC', 'POWER_HYBRID'],
          },
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type Car {
        selectedCategories: [CarSelectedCategoriesItem!]
      }

      enum CarSelectedCategoriesItem {
        POWER_GASOLINE
        POWER_DIESEL
        POWER_ELECTRIC
        POWER_HYBRID
      }
      "
    `)
  })

  it('should compute allOf to flattened named types', async () => {
    const graphql = await compileSchema({
      $schema: 'http://json-schema.org/draft-07/schema#',
      type: 'object',
      title: 'ElectricCar',
      additionalProperties: false,
      allOf: [
        { $ref: '#/$defs/Car' },
        {
          properties: {
            canDriveToLapland: { type: 'boolean' },
          },
        },
      ],
      $defs: {
        Car: {
          type: 'object',
          title: 'Car',
          additionalProperties: false,
          properties: {
            model: { type: 'string' },
          },
          required: ['model'],
        },
      },
    })
    expect(graphql).toMatchInlineSnapshot(`
      "type ElectricCar {
        model: String!
        canDriveToLapland: Boolean
      }
      "
    `)
  })
})

describe('isIdentifierField', () => {
  it.each(['id', 'carID', 'carId', 'ID'])('Should detect "%s" as identifier field', (keyName) => {
    expect(isIdentifierField(keyName)).toEqual(true)
  })
  it.each(['idiot', 'bestIDE', 'morbid'])('Should NOT detect "%s" as identifier field', (keyName) => {
    expect(isIdentifierField(keyName)).toEqual(false)
  })
})

describe('sanitizeName', () => {
  it.each([
    ['FOO-8_X', 'FOO_8_X'],
    ['PIU$#59', 'PIU_59'],
    ['PAU$$$', 'PAU'],
    ['$POU', 'POU'],
    ['###bar###', 'bar'],
    ['#$%#', ''],
  ])('Should sanitize name "%s" to "%s', (name, expected) => {
    expect(sanitizeName(name)).toEqual(expected)
  })
})
