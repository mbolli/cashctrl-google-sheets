import { google } from "npm:googleapis";
import { OAuth2Client } from "npm:google-auth-library";
import { DateRange, SpreadsheetRow, SpreadsheetTable } from "./types.ts";
import { Config } from "./config.ts";

export class GoogleSheetsApi {
  private static SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];
  private static client: OAuth2Client;

  /**
   * Authenticates with Google API using OAuth2.0.
   */
  private static async googleAuthenticate(): Promise<OAuth2Client> {
    // Check if cached client is still valid
    if (this.client !== undefined) {
      const credentials = this.client.credentials;
      if (credentials.expiry_date && new Date(credentials.expiry_date*1000) > new Date()) {
        return this.client;
      }
      // Token expired, clear cache and re-authenticate
      console.log("Cached token has expired. Re-authenticating...");
    }

    const credentials = JSON.parse(
      await Deno.readTextFile("credentials.json") as string,
    );
    const { client_id, client_secret } = credentials.web;

    const oAuth2Client = new google.auth.OAuth2(
      client_id,
      client_secret,
      "http://localhost",
    );

    try {
      const existingToken = await Deno.readTextFile("token.json");
      const tokenData = JSON.parse(existingToken);
      // Google tokens use milliseconds, not seconds
      if (tokenData.expiry_date && new Date(tokenData.expiry_date*1000) < new Date()) {
        console.log("Token has expired. Please re-authorize.");
        throw new Error("Token has expired");
      }
      oAuth2Client.setCredentials(tokenData);
      console.log("Credentials loaded from token.json");
      this.client = oAuth2Client;
      return oAuth2Client;
    } catch (_error) {
      // Generate a URL for the user to authorize the app
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: GoogleSheetsApi.SCOPES,
        prompt: "consent",
      });

      console.log("Authorize this app by visiting this URL:", authUrl);

      // Paste the authorization code from the user
      const authCode = prompt("Enter the authorization code:")!;

      const token = await oAuth2Client.getToken(authCode);
      oAuth2Client.setCredentials(token.tokens);
      await Deno.writeFile(
        "token.json",
        new TextEncoder().encode(JSON.stringify(token.tokens)),
      );

      console.log("Token obtained and stored!");
      this.client = oAuth2Client;
      return oAuth2Client;
    }
  }

  /**
   * Fetches data from Google Sheets API and returns it as a SpreadsheetTable object.
   */
  public static async getSheetData(
    dateRange: DateRange,
  ): Promise<SpreadsheetTable> {
    const authClient = await GoogleSheetsApi.googleAuthenticate();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const sheetName = Config.get("GOOGLE_SHEET_NAME");
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: Config.get("SPREADSHEET_ID"),
      range: `${sheetName}!A1:J`,
      valueRenderOption: "UNFORMATTED_VALUE",
    });
    
    const convertDate = (dateVal: number | string): string => {
      if (typeof dateVal === 'string') return dateVal;
      const date = new Date((dateVal - 25569) * 86400 * 1000);
      if (isNaN(date.getTime())) {
        throw new Error(`Invalid date value in sheet: ${dateVal}`);
      }
      return date.toISOString().split("T")[0];
    }

    // convert to typed object SpreadsheetRow
    const data: SpreadsheetTable = response.data.values?.map((d, i) => ({
      row: ++i,
      date: convertDate(d[0]), // convert date from Excel to JS
      client: d[1],
      project: d[2],
      description: d[3],
      hours: d[4],
      pricePerHour: d[5],
      total: d[6],
      billed: d[7],
    })) ?? [];

    // filter by dateRange
    const filteredData = data.filter((row) => {
      const rowDate = new Date(row.date);
      return rowDate >= dateRange.startDate && rowDate <= dateRange.endDate && row.billed === false;
    });

    console.log(
      "Data:",
      filteredData.map((r) =>
        `#${r.row} ${r.date} ${r.client} ${r.project} ${r.description}`
      ),
    );
    return filteredData;
  }

  public static async flagBilledPositions(positions: number[]): Promise<void> {
    const authClient = await GoogleSheetsApi.googleAuthenticate();
    const sheets = google.sheets({ version: "v4", auth: authClient });

    const sheetName = Config.get("GOOGLE_SHEET_NAME");
    try {
      const response = await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: Config.get("SPREADSHEET_ID"),
        requestBody: {
          data: positions.map(rowNumber => ({
            range: `${sheetName}!H${rowNumber}`,
            values: [[true]]
          })),
          valueInputOption: 'USER_ENTERED' // Or 'RAW' if preferred.
        }
      });
      console.log(`Updated ${response.data.totalUpdatedCells} cells.`);
    } catch (error) {
      console.error('Error updating sheet:', error);
    }
  }

  public static filterPositions(sheetData: SpreadsheetTable, clients: string[]): SpreadsheetTable {
    return sheetData.filter(row => clients.includes(row.client));
  }

  public static groupPositions(sheetData: SpreadsheetTable): SpreadsheetTable {
    const groupedPositions: Record<string, SpreadsheetRow> = sheetData.reduce(
      (acc, row) => {
        const group = `${row.client}${row.project}`;
        if (!acc[group]) {
          acc[group] = { ...row, description: `- ${row.description}\n` };
        } else {
          acc[group].description += `- ${row.description}\n`;
          acc[group].hours += row.hours;
          acc[group].total += row.total;
        }
        return acc;
      },
      {} as Record<string, SpreadsheetRow>,
    );

    // order items
    const orderBy = (Config.getOrDefault("CASHCTRL_ITEMS_ORDER", "client")) as keyof SpreadsheetRow;
    const values = Object.values(groupedPositions);

    return values.sort((a: SpreadsheetRow, b: SpreadsheetRow) =>
      String(a[orderBy]).localeCompare(
        String(b[orderBy]),
        Config.get("LANGUAGE"),
        { numeric: true },
      )
    );
  }
}
