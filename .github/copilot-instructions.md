# Copilot Instructions

This Deno TypeScript CLI bridges Google Sheets time tracking with CashCtrl invoicing. It reads unbilled hours from a Google Sheet, prompts for invoice details, creates/updates CashCtrl orders, and marks sheet rows as billed.

## Architecture

Four static utility classes handle distinct concerns:
- **GoogleSheetsApi** ([api-google-sheets.ts](../api-google-sheets.ts)): OAuth2 flow, sheet reading/writing, data filtering/grouping
- **CashCtrlApi** ([api-cash-ctrl.ts](../api-cash-ctrl.ts)): REST API calls, XML-like multilingual field parsing, response validation
- **CliHelpers** ([cli-helpers.ts](../cli-helpers.ts)): Interactive prompts, .env management, account/tax selection
- **Config** ([config.ts](../config.ts)): Centralized configuration management, validation, and environment variable handling

Main flow in [main.ts](../main.ts): Initialize config → Select date range → Fetch sheet data → Filter by clients → Group positions → Create order → Update billed flags.

## Critical Patterns

**Configuration Management**: All environment variables managed via Config class:
```typescript
Config.initialize();  // Prompts for missing config
Config.get("KEY");    // Required config
Config.getOrDefault("KEY", "default");  // Optional config
Config.getNumber("KEY");  // Numeric config
Config.validate();    // Validates format/structure
```

**Google Sheets Structure**: Configurable sheet name (default "Rechnungen") with columns A-H:
```typescript
// Column mapping (0-indexed in code, 1-indexed in sheet)
date | client | project | description | hours | pricePerHour | total | billed
```
Row numbers start at 1 due to `++i` in map operation. Always filter `billed === false`.

**CashCtrl Multilingual Fields**: Parse XML-like strings for translated content:
```typescript
"<values><de>Rechnung</de><en>Invoice</en></values>" 
// Use CashCtrlApi.getTranslation() to extract by LANGUAGE env var
```

**Tax Application**: Dynamic tax handling based on `calcType`:
- **NET** (default): `unitPrice` is net, CashCtrl adds tax automatically
- **GROSS**: `unitPrice = netPrice * (1 + percentage/100)`, CashCtrl extracts tax

**API Response Validation**: CashCtrlApi.request() validates all responses:
- GET responses must have `data` field
- POST responses must have `success` field
- Throws descriptive errors on malformed responses

**Environment Variables**: Auto-prompts on first run, writes to `.env`:
- `SPREADSHEET_ID` - Google Sheets document ID
- `GOOGLE_SHEET_NAME` - Sheet name (default: "Rechnungen")
- `CASHCTRL_DOMAINID` - CashCtrl subdomain
- `CASHCTRL_APIKEY` - CashCtrl API key
- `CASHCTRL_ITEMS_ORDER` - Sort field for order items
- `CASHCTRL_DEFAULT_ACCOUNT` - Default account ID
- `CASHCTRL_DEFAULT_TAX` - Default tax ID
- `CASHCTRL_DEFAULT_CATEGORY` - Default category ID (default: 4)
- `CASHCTRL_UNIT_FILTER` - Unit name filter (default: "Std")
- `DATE_LOCALE` - Date formatting locale (default: "de-DE")
- `LANGUAGE` - Locale code (default: 'de')

**OAuth Persistence**: Google API tokens cached in `token.json` with expiry check.

## Development Workflows

**Running**: Single command handles all permissions:
```bash
deno run start  # Defined in deno.json tasks
```

**Pre-commit validation**:
```bash
deno lint
deno check main.ts
```

**Dependencies**: Uses npm: specifier for Node packages (`npm:inquirer`, `npm:googleapis`, `npm:google-auth-library`). Deno auto-manages via `nodeModulesDir: "auto"`.

## Type System

All types in [types.ts](../types.ts). Key patterns:
- `SpreadsheetTable` is `SpreadsheetRow[]`
- `CashCtrlAnswer<T>` wraps GET responses: `{ total: number, data: T }`
- `CashCtrlWriteResponse` wraps POST responses: `{ success: boolean, message?: string, insertId?: number, errors?: Record<string, string[]> }`
- Use `Partial<>` for create/update payloads (see `orderData` in [main.ts](../main.ts))

## Common Gotchas

- **No parallelism**: Sequential execution in main.ts. Await each step.
- **Date conversion**: Google Sheets serial dates converted via `(dateVal - 25569) * 86400 * 1000`
- **Order items JSON**: When reading existing orders, items come as JSON string - must parse before merging
- **Form encoding**: CashCtrlApi POST bodies use FormData, not JSON
- **Locale defaults**: Date formatting uses configurable DATE_LOCALE (default: de-DE)
- **Error handling**: All API responses validated; throws clear errors on missing/invalid data
- **Token expiry**: Cached OAuth2 tokens checked for validity before reuse

## Extending Functionality

**Adding sheet columns**: Update `SpreadsheetRow` type and mapping in `GoogleSheetsApi.getSheetData()`.

**Custom order fields**: CashCtrl custom fields need XML encoding via `CashCtrlApi.encodeCustomField()`.

**New prompt flows**: Use `@inquirer/prompts` for consistency (select/checkbox/input/confirm/search).

**New configuration**: Add to `Config.initialize()` with appropriate defaults and validation.

## API References

- [CashCtrl API Documentation](https://app.cashctrl.com/static/help/en/api/index.html) - Complete REST API reference for orders, persons, accounts, and custom fields
- [Google Sheets API v4](https://googleapis.dev/nodejs/googleapis/latest/sheets/index.html) - Node.js client library documentation
- [Google OAuth2 Authentication](https://developers.google.com/identity/protocols/oauth2) - OAuth2 flow implementation details
