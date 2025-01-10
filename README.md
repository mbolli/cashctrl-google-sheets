# Google Sheets to CashCtrl Orders

[![deno version](https://img.shields.io/badge/deno-^2.0-lightgrey?logo=deno)](https://deno.land)
[![GitHub license](https://img.shields.io/github/license/mbolli/cashctrl-google-sheets)](https://github.com/mbolli/cashctrl-google-sheets/blob/main/LICENSE)
[![Made with TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org)

Track your time in Google Sheets and automatically generate
[CashCtrl](https://cashctrl.com) orders with a single command! This project
bridges the gap between your time tracking and invoicing workflows. Simply log
your hours in a Google Sheet, and with one command, create professional CashCtrl
orders - no manual data entry required. Perfect for freelancers and small
businesses who want to streamline their billing process while keeping time
tracking simple and flexible.

## Demo

TBD

## Configuration

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

1. Run the project with `deno run start`. The needed information will be
   collected during this process.
2. Follow the instructions in the console to authorize the app.
3. Paste the authorization code received after authorization.
4. Prepare your Google Sheet with the necessary order details.
5. The order will be created in CashCtrl with positions taken from the Google
   Sheet.

## Google Sheet Structure

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

## Dependencies

This project depends on Deno version 2.0.0 or higher.
