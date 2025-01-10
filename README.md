# Google Sheets to CashCtrl Orders

This project demonstrates how to create [CashCtrl](https://cashctrl.com) orders
directly from a Google Sheet using the Google Sheets API and OAuth2 in Deno. It
allows you to automatically generate CashCtrl orders from time tracking data
stored in Google Sheets.

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
