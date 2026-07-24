import {Openapi} from '@automatons/tools';
import {rm} from "node:fs/promises";
import {join} from "path";
import {expectFormat} from "../expects/expectFormat";
import {generate} from "../../generator";
import paths from "../../paths";

const outDir = join(paths.tmp, 'petstore');

it('should generate nextjs route handlers, services and models', async () => {
  await generate(openapi, {path: '', openapiPath: '', outDir});

  await expectFormat();
});

beforeEach(async () => {
  await rm(outDir, {recursive: true, force: true});
});

const openapi: Openapi = {
  openapi: '3.0.3',
  info: {
    title: 'pet store',
    version: '0.0.0'
  },
  paths: {
    '/pets': {
      get: {
        operationId: 'listPets',
        tags: ['pets'],
        parameters: [
          {name: 'limit', in: 'query', schema: {type: 'integer'}},
          {name: 'status', in: 'query', required: true, schema: {type: 'string', enum: ['available', 'pending', 'sold']}},
          {name: 'tags', in: 'query', schema: {type: 'array', items: {type: 'string'}}},
          {name: 'deep', in: 'query', schema: {type: 'boolean'}}
        ],
        responses: {
          '200': {
            description: 'ok',
            content: {'application/json': {schema: {type: 'array', items: {$ref: '#/components/schemas/Pet'}}}}
          }
        }
      },
      post: {
        operationId: 'createPet',
        tags: ['pets'],
        requestBody: {
          required: true,
          content: {'application/json': {schema: {$ref: '#/components/schemas/NewPet'}}}
        },
        responses: {
          '201': {
            description: 'created',
            content: {'application/json': {schema: {$ref: '#/components/schemas/Pet'}}}
          }
        }
      }
    },
    '/pets/{petId}': {
      get: {
        operationId: 'showPetById',
        tags: ['pets'],
        parameters: [{name: 'petId', in: 'path', required: true, schema: {type: 'string'}}],
        responses: {
          '200': {
            description: 'ok',
            content: {'application/json': {schema: {$ref: '#/components/schemas/Pet'}}}
          }
        }
      },
      delete: {
        operationId: 'deletePet',
        tags: ['pets'],
        parameters: [{name: 'petId', in: 'path', required: true, schema: {type: 'string'}}],
        responses: {'204': {description: 'no content'}}
      }
    }
  },
  components: {
    schemas: {
      Category: {
        type: 'object',
        required: ['id'],
        properties: {
          id: {type: 'integer', format: 'int64'},
          name: {type: 'string'}
        }
      },
      Pet: {
        type: 'object',
        required: ['id', 'name'],
        properties: {
          id: {type: 'integer', format: 'int64'},
          name: {type: 'string'},
          category: {$ref: '#/components/schemas/Category'},
          tags: {type: 'array', items: {type: 'string'}},
          status: {type: 'string', enum: ['available', 'pending', 'sold']},
          createdAt: {type: 'string', format: 'date-time'}
        }
      },
      NewPet: {
        type: 'object',
        required: ['name'],
        properties: {
          name: {type: 'string'},
          status: {type: 'string', enum: ['available', 'pending', 'sold']}
        }
      }
    }
  }
} as Openapi;
