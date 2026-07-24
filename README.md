# @automatons/typescript-server-nextjs

[![CI/CD](https://github.com/openapi-automatons/typescript-server-nextjs/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/openapi-automatons/typescript-server-nextjs/actions/workflows/ci-cd.yml)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release)
[![npm](https://img.shields.io/npm/dm/@automatons/typescript-server-nextjs)](https://www.npmjs.com/package/@automatons/typescript-server-nextjs)

## What is @automatons/typescript-server-nextjs

A contract-first Next.js (App Router) server generator for [openapi-automatons](https://github.com/openapi-automatons/openapi-automatons).

From an OpenAPI document it generates:

- `models/` — plain TypeScript types for every schema
- `services/` — one interface per tag: the contract you implement (your logic lives outside the generated code, so regenerating is always safe)
- `handlers/` — one factory per OpenAPI path building the [Route Handlers](https://nextjs.org/docs/app/building-your-application/routing/route-handlers) object (`{GET, POST, ...}`). Handlers await `context.params`, read and coerce query parameters (answering `400` when a required one is missing), parse the JSON body, delegate to your service, and answer with the right status (`200`, `201` for `POST`, `204` without a response schema)

This package is **ESM-only** and requires **Node.js >= 22**. Peer dependency: `next` **15 or 16**.

## Generated server

```ts
// your code — implement the generated contract
import { PetsService } from "@/generated/services";
import { Pet } from "@/generated/models";

export const petsService: PetsService = {
  async listPets(status, limit, tags, deep): Promise<Pet[]> {
    // ...your logic
  },
  // ...
};

// app/pets/[petId]/route.ts — mount the generated handlers
import { createPetsPetIdHandlers } from "@/generated/handlers";
import { petsService } from "@/services/pets";

export const { GET, DELETE } = createPetsPetIdHandlers(petsService);
```

Every handler file documents the `app/.../route.ts` location it belongs to.

Not covered (yet): header/cookie parameters and non-JSON request bodies.

## How can I use @automatons/typescript-server-nextjs?

Only use openapi-automatons.

This library is designed to be used by [openapi-automatons](https://github.com/openapi-automatons/openapi-automatons).
Please read the [readme](https://github.com/openapi-automatons/openapi-automatons#readme) of openapi-automatons for how to use it.
