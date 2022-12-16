# Mangrove Offchain Server

Creates offchain index of [mangrove.exchange](https://mangrove.exchange/) and provides GraphQL endpoint.

It uses [Prisma](https://www.prisma.io/) ORM framework to work with Postgresql. [Apollo](https://www.apollographql.com/) is used as GraphQL server.
GraphQL schema and resolvers are generated with [TypeGraphQL](https://typegraphql.com/) and its [Prisma Integration](https://typegraphql.com/docs/prisma.html)

## Development

### Requirements

- node.js v16
- yarn 
- postgresql instance (can be started with docker-compose)

### Start postgresql

`yarn docker:env`

### Prisma Schema

Prisma schema is located at `prisma/schema.prisma`. 

#### Change Schema

Manually adjust schema file and run `yarn prisma:migrate {migrationname}` create SQL migration and generate client code.

#### Deploy Schema

Run `yarn prisma:deploy` to apply all migrations to selected database (connection string is taken from `DATABASE_URL` env var).

(!) Check out `.env.development` and `.env.test` file

### Useful commands

- `yarn start:consumer` to start event stream consumer
- `yarn start:server` to start graphql server
- `yarn test` to run all tests
- `yarn test:integration` to run all integration tests
- `yarn test:unit` to run all unit tests
- `yarn start:test:server` to run Apollo on test database. (useful when debugging tests)
- `yarn debug:integration` to run all integrations tests in debug mode
- `yarn debug:unit` to run all unit tests in debug mode
- `yarn lint` to run linter

### Versioning of entities

Events should not overwrite/delete data, as the data might have to be restored if the event is undone.
Instead of overwrites/deletes of entities, the following versioning pattern is applied:

- `prisma.Entity` is the base entity with immutable data (such as id, mangrove id, ...)
  - `currentVersionId` is the id of the current version of the entity
  - `deleted = true` means the entity has been deleted

- `prisma.EntityVersion` contains the data that can change when the entity is updated
  - `versionNumber` is an incremental version number, starting at zero
  - `prevVersionId` is the id of an older version that this version replaces, if any

On undo of an event that created a version, that version is deleted and the previous version set as the current. If there was no previous version, the entity itself is deleted (not just marked as deleted, as the undo can never be undone).
