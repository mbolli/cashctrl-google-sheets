# Google Sheets to CashCtrl Orders

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/mbolli/cashctrl-google-sheets/releases/tag/v1.0.0)
[![deno version](https://img.shields.io/badge/deno-^2.0-lightgrey?logo=deno)](https://deno.land)
[![GitHub license](https://img.shields.io/github/license/mbolli/cashctrl-google-sheets)](https://github.com/mbolli/cashctrl-google-sheets/blob/master/LICENSE)
[![Made with TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org)

Track your time in Google Sheets and automatically generate
[CashCtrl](https://cashctrl.com) orders with a single command! This project
bridges the gap between your time tracking and invoicing workflows. Simply log
your hours in a Google Sheet, and with one command, create professional CashCtrl
orders - no manual data entry required. Perfect for freelancers and small
businesses who want to streamline their billing process while keeping time
tracking simple and flexible.

## Features

- **Smart Configuration Management**
  - Automatic first-run setup with interactive prompts
  - Stores configuration in `.env` file
  - Validates and guides you through required settings
  
- **Flexible Order Position Selection**
  - Filter by date span (column A)
  - Filter by client name (column B)
  - Always filters by `billed` flag (column H), so only unbilled positions are processed
  
- **CashCtrl Integration**
  - Select client/associate
  - Choose document category
  - Pick account with formatted display
  - **Dynamic tax selection** with NET/GROSS calcType support
  - Create new orders or modify existing ones (replace or append items)
  
- **Automatic Updates**
  - Updates Google Sheet `billed` flag after order creation
  - Handles OAuth token refresh automatically
  
- **Enhanced User Experience**
  - Graceful Ctrl-C handling with friendly messages
  - Comprehensive error messages with actionable feedback
  - Pre-selected defaults for faster workflow

## Demo

![google-sheets-cashctrl](https://github.com/user-attachments/assets/34d775a1-4071-409f-a5c1-6423e41abeba)

## Configuration

### Environment Variables

On first run, the application will prompt you for all required configuration. Settings are stored in a `.env` file:

| Variable | Description | Required | Default |
|----------|-------------|----------|----------|
| `SPREADSHEET_ID` | Google Sheets document ID (from URL) | Yes | - |
| `GOOGLE_SHEET_NAME` | Name of the sheet tab | No | `Rechnungen` |
| `CASHCTRL_DOMAINID` | CashCtrl subdomain (e.g., `yourcompany`) | Yes | - |
| `CASHCTRL_APIKEY` | CashCtrl API key | Yes | - |
| `CASHCTRL_ITEMS_ORDER` | Sort field for order items | No | `position` |
| `CASHCTRL_DEFAULT_ACCOUNT` | Default account ID | Yes* | - |
| `CASHCTRL_DEFAULT_TAX` | Default tax ID | Yes* | - |
| `CASHCTRL_DEFAULT_CATEGORY` | Default category ID | No | `4` |
| `CASHCTRL_UNIT_FILTER` | Unit name filter | No | `Std` |
| `DATE_LOCALE` | Date formatting locale | No | `de-DE` |
| `LANGUAGE` | CashCtrl UI language | No | `de` |

*Set interactively on first run via selection prompts.

### Google API OAuth access

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project or select an existing one.
3. Navigate to the "APIs & Services" dashboard.
4. Click on "Enable APIs and Services."
5. Search for "Google Sheets API" and enable it.
6. Go to "Credentials" in the left sidebar.
7. Click on "Create Credentials" and select "OAuth client ID."
8. Configure the consent screen if prompted.
9. Choose "Web application" and set the redirect URI to `http://localhost:8080`.
10. Click "Create" and save the file as `credentials.json`.

## Usage

1. **First Run**: Execute `deno run start` and follow the interactive setup:
   - Configure environment variables (automatically saved to `.env`)
   - Authorize Google Sheets access via OAuth (token saved to `token.json`)
   - Select default account and tax settings
   
2. **Subsequent Runs**: Simply run `deno run start`:
   - Select date range for unbilled positions
   - Choose clients to include
   - Review and confirm order positions
   - Select or create CashCtrl order
   - Positions are created and Google Sheet is updated automatically

3. **Graceful Exit**: Press `Ctrl-C` at any time to exit cleanly

## Google Sheet Structure

Copy [this sheet](https://docs.google.com/spreadsheets/d/1-8gaZBwpIlRtElbI0ouJaIscDPKuDJvDFOugf0N5KdM/edit?usp=sharing) as a starting point!

Your Google Sheet should have the following columns corresponding to the
`SpreadsheetRow` type:

| Column | Header       | Description                      |
| ------ | ------------ | -------------------------------- |
| 0      | date         | Date of the order (in timestamp) |
| 1      | client       | Name of the client               |
| 2      | project      | Name of the project              |
| 3      | description  | Description of the order         |
| 4      | hours        | Number of hours                  |
| 5      | pricePerHour | Price per hour                   |
| 6      | total        | Total amount (ignored)           |
| 7      | billed       | Indicates if the order is billed |

## Useful Links

- [CashCtrl API Documentation](https://app.cashctrl.com/static/help/en/api/index.html)
- [Google APIs Node.js Client Documentation](https://googleapis.dev/nodejs/googleapis/latest/sheets/index.html)

## Development

This project depends on Deno version 2.0.0 or higher.

Before submitting a PR, please execute

```bash
deno lint
deno check main.ts
```

and fix the issues.