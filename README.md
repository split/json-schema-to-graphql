# JSON Schema to GraphQL

This is a tool that compiles `JSON Schema` to `GraphQL` schema output types. It uses awesome [json-schema-to-typescript](https://www.npmjs.com/package/json-schema-to-typescript) under the hood and it's basically custom generator for it, that instead of `TypeScript` outputs `GraphQL` using same `AST`.

## Example

Input:

```json
{
  "title": "Example Schema",
  "type": "object",
  "properties": {
    "firstName": {
      "type": "string"
    },
    "lastName": {
      "type": "string"
    },
    "age": {
      "description": "Age in years",
      "type": "integer",
      "minimum": 0
    },
    "hairColor": {
      "title": "Hair color",
      "enum": ["black", "brown", "blue"],
      "type": "string"
    }
  },
  "additionalProperties": false,
  "required": ["firstName", "lastName"]
}
```

Output:

```graphql
type ExampleSchema {
  firstName: String!
  lastName: String!
  age: Int
  hairColor: HairColor
}

enum HairColor {
  black
  brown
  blue
}
```

## Usage

```
json-schema-to-graphql example.json example.graphql
```

Where `example.json` is your `JSON schema` file and `example.graphql` is the output schema is being exported.

## Known limitations and missing features

- There is no unions of scalar values in GraphQL
  - Those would be needed to be wrapped to objects
- There is no string or number literals in the GraphQL
  - Unions of string literals are transformed to enums
- GraphQL doesn't support intersections meaning `allOf` definitions need to be merged
  - Currently has on quite limited support for objects
  - Available merge tools don't seem to maintain object reference equality causing duplicate types.
- There is no support for tuples in GraphQL
  - Currently no handling for those types and are just dropped
- There is no support for generating input types for now

## Development

This library uses [dts-cli](https://github.com/weiran-zsd/dts-cli) as zero configuration development tool.

Start development watcher with:

```sh
yarn start
```

Run tests with:

```
yarn test
```
