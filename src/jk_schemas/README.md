# jk_schemas

A robust schema definition and validation library for JopiJS applications. It allows defining data structures in TypeScript, validating data against these structures, and exporting them to standard JSON Schemas with JopiJS-specific extensions (`x-jopi`).

## Features

- **Fluent API**: Define schemas easily using helper functions (`string`, `number`, `boolean`, etc.).
- **Strong Typing**: leveraged TypeScript inference to provide typed data parsers.
- **Validation**: Built-in validation logic with customizable error messages.
- **UI Metadata**: Attach metadata for UI rendering (tables, forms) directly in the schema.
- **JSON Schema Export**: Convert your programmatic schemas into standard JSON Schemas for interoperability.

## Installation

This library is part of the `jopi-toolkit`.

```typescript
import * as jk_schema from "jopi-toolkit/jk_schema";
```

## Usage

### Defining a Schema

Use the `schema` function combined with type helpers to define your data structure.

```typescript
import * as jk_schema from "jopi-toolkit/jk_schema";

const UserSchema = jk_schema.schema({
    id: jk_schema.string("id", false, {
        minLength: 5,
        // UI Metadata for tables
        onTableRendering: {
            alwaysHidden: true
        }
    }),

    username: jk_schema.string("username", false, {
        title: "User Name",
        minLength: 3,
        maxLength: 20
    }),

    email: jk_schema.string("email", false, {
        title: "Email Address"
    }),

    age: jk_schema.number("age", true, {
        minValue: 18,
        displayType: "decimal"
    }),

    balance: jk_schema.currency("balance", false, {
        currency: "USD",
        localFormat: "en-US",
        onTableRendering: {
            textAlign: "right"
        }
    })
});
```

### Validating Data

You can validate any object against your defined schema.

```typescript
import { validateSchema } from "jopi-toolkit/jk_schema";

const data = {
    username: "johan",
    email: "test@example.com",
    age: 15 // Invalid!
};

const errors = validateSchema(data, UserSchema);

if (errors) {
    console.error("Validation failed:", errors);
    // Output: { fields: { age: { message: "Value must be at least 18", ... } } }
}
```

### Exporting to JSON Schema

You can export your `jk_schema` definition to a JSON Schema format.

It automatically handles JopiJS specific extensions under the `x-jopi` key and preserves field order via `x-jopi-order`.

```typescript
const jsonSchema = UserSchema.toJsonValidationSchema();

console.log(JSON.stringify(jsonSchema, null, 2));
```

**Output Example:**

```json
{
  "type": "object",
  "x-jopi-order": ["id", "username", "email", "age", "balance"],
  "properties": {
    "id": {
      "type": "string",
      "x-jopi": { "alwaysHidden": true }
    },
    "balance": {
      "type": "number",
      "x-jopi": {
        "displayType": "currency",
        "currency": "USD",
        "textAlign": "right"
      }
    }
    // ...
  },
  "required": ["id", "username", "email", "balance"]
}
```

## API Reference

### Types

- `string(id, optional, options)`: Define a string string. Options: `minLength`, `maxLength`, `placeholder`.
- `number(id, optional, options)`: Define a number. Options: `minValue`, `maxValue`, `displayType`.
- `boolean(id, optional, options)`: Define a boolean. Options: `requireTrue`, `requireFalse`.
- `currency(id, optional, options)`: Shortcut for number with `displayType: 'currency'`.
- `percent(id, optional, options)`: Shortcut for number with `displayType: 'percent'`.
- `file(id, optional, options)`: Define a file attachment.

### UI Extensions (`x-jopi`)

When exporting to JSON Schema or defining rendering options, JopiJS uses specific keys to control UI behavior:

- **`alwaysHidden`**: The field is never shown in tables.
- **`defaultHidden`**: The field is hidden by default but can be toggled.
- **`textAlign`**: `"left"`, `"center"`, `"right"`.
- **`columnGrow`**: `"takeAllPlace"` (flex string) or `"takeMinPlace"`.
- **`displayType`**: How to format numbers (`"decimal"`, `"currency"`, `"percent"`).
