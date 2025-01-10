import { google } from "npm:googleapis";
import { OAuth2Client } from "npm:google-auth-library";
import { DateRange, SpreadsheetRow, SpreadsheetTable } from "./types.ts";

export class GoogleSheetsApi {
  private static SCOPES = ["https://www.googleapis.com/auth/spreadsheets"];

  /**
   * Authenticates with Google API using OAuth2.0.
   */
  private static async googleAuthenticate(): Promise<OAuth2Client> {
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
      if (new Date(tokenData.expiry_date * 1000) < new Date()) {
        console.log("Token has expired. Please re-authorize.");
        throw new Error("Token has expired");
      }
      oAuth2Client.setCredentials(tokenData);
      console.log("Credentials loaded from token.json");
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

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: Deno.env.get("SPREADSHEET_ID"),
      range: "Rechnungen!A1:J",
      valueRenderOption: "UNFORMATTED_VALUE",
    });

    // convert date from Excel to JS
    const cleanData = response.data.values?.map((row) => {
      const date = new Date((row[0] - 25569) * 86400 * 1000);
      return isNaN(date.getDate())
        ? row
        : [date.toISOString().split("T")[0], ...row.slice(1)];
    }) ?? [];

    // filter by dateRange
    const filteredData = cleanData.filter((row) => {
      const rowDate = new Date(row[0]);
      return rowDate >= dateRange.startDate && rowDate <= dateRange.endDate;
    });

    // convert to typed object SpreadsheetRow
    const typedData: SpreadsheetTable = filteredData.map((d) => ({
      date: d[0],
      client: d[1],
      project: d[2],
      description: d[3],
      hours: d[4],
      pricePerHour: d[5],
      total: d[6],
      billed: d[7],
    }));

    console.log(
      "Data:",
      typedData.map((r) =>
        `${r.date} ${r.client} ${r.project} ${r.description}`
      ),
    );
    return typedData;
  }

  public static groupPositions(
    sheetData: SpreadsheetTable,
    clients: string[],
  ): SpreadsheetTable {
    const groupedPositions: Record<string, SpreadsheetRow> = sheetData.reduce(
      (acc, row) => {
        if (!clients.includes(row.client)) return acc;
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
    const orderBy = (Deno.env.get("CASHCTRL_ITEMS_ORDER") ||
      "client") as keyof SpreadsheetRow;
    const values = Object.values(groupedPositions);

    return values.sort((a: SpreadsheetRow, b: SpreadsheetRow) =>
      String(a[orderBy]).localeCompare(
        String(b[orderBy]),
        Deno.env.get("LANGUAGE"),
        { numeric: true },
      )
    );
  }
}
