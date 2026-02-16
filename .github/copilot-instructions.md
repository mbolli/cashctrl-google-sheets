# Copilot Instructions

This Deno TypeScript CLI bridges Google Sheets time tracking with CashCtrl invoicing. It reads unbilled hours from a Google Sheet, prompts for invoice details, creates/updates CashCtrl orders, and marks sheet rows as billed.

## Architecture

Three static utility classes handle distinct concerns:
- **GoogleSheetsApi** ([api-google-sheets.ts](../api-google-sheets.ts)): OAuth2 flow, sheet reading/writing, data filtering/grouping
- **CashCtrlApi** ([api-cash-ctrl.ts](../api-cash-ctrl.ts)): REST API calls, XML-like multilingual field parsing
- **CliHelpers** ([cli-helpers.ts](../cli-helpers.ts)): Interactive prompts, .env management, account selection

Main flow in [main.ts](../main.ts): Select date range → Fetch sheet data → Filter by clients → Group positions → Create order → Update billed flags.

## Critical Patterns

**Google Sheets Structure**: Hardcoded sheet name `"Rechnungen"` with columns A-H:
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

**Tax Application**: Hardcoded 8.1% tax applied to unit prices (`row.pricePerHour * 1.081`).

**Environment Variables**: Auto-prompts on first run via `CliHelpers.promptForEnvInput()`, writes to `.env`:
- `SPREADSHEET_ID` - Google Sheets document ID
- `CASHCTRL_DOMAINID` - CashCtrl subdomain
- `CASHCTRL_APIKEY` - CashCtrl API key
- `CASHCTRL_ITEMS_ORDER` - Sort field for order items (client/date/hours/none)
- `CASHCTRL_DEFAULT_ACCOUNT` - Default account ID
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
- `CashCtrlAnswer<T>` wraps API responses: `{ total: number, data: T }`
- Use `Partial<>` for create/update payloads (see `orderData` in [main.ts](../main.ts#L124))

## Common Gotchas

- **No parallelism**: Sequential execution in main.ts. Await each step.
- **Date conversion**: Google Sheets serial dates converted via `(dateVal - 25569) * 86400 * 1000`
- **Order items JSON**: Must stringify items array before POST: `orderData.items = JSON.stringify(orderData.items)`
- **Form encoding**: CashCtrlApi POST bodies use FormData, not JSON
- **German defaults**: Date formatting and sorting use `de-DE` locale

## Extending Functionality

**Adding sheet columns**: Update `SpreadsheetRow` type and mapping in `GoogleSheetsApi.getSheetData()`.

**Custom order fields**: CashCtrl custom fields need XML encoding via `CashCtrlApi.encodeCustomField()`.

**New prompt flows**: Use `@inquirer/prompts` for consistency (select/checkbox/input/confirm/search).

## API References

- [CashCtrl API Documentation](https://app.cashctrl.com/static/help/en/api/index.html) - Complete REST API reference for orders, persons, accounts, and custom fields
- [Google Sheets API v4](https://googleapis.dev/nodejs/googleapis/latest/sheets/index.html) - Node.js client library documentation
- [Google OAuth2 Authentication](https://developers.google.com/identity/protocols/oauth2) - OAuth2 flow implementation details
