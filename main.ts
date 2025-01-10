import { select } from "npm:@inquirer/prompts";
import { GoogleSheetsApi } from "./api-google-sheets.ts";
import { CashCtrlApi } from "./api-cash-ctrl.ts";
import { CliHelpers } from "./cli-helpers.ts";
import type {
  CashCtrlCategory,
  CashCtrlItem,
  CashCtrlOrder,
  CashCtrlPerson,
  CashCtrlTax,
  CashCtrlUnit,
  SpreadsheetTable,
} from "./types.ts";

// set up environment variables
Deno.env.get("SPREADSHEET_ID") ||
  await CliHelpers.promptForEnvInput(
    "SPREADSHEET_ID",
    "Please enter your Google Sheets SPREADSHEET_ID:",
  );
Deno.env.get("CASHCTRL_DOMAINID") ||
  await CliHelpers.promptForEnvInput(
    "CASHCTRL_DOMAINID",
    "Please enter your CashCtrl subdomain (e.g. 'mycompanyltd'):",
  );
Deno.env.get("CASHCTRL_APIKEY") ||
  await CliHelpers.promptForEnvInput(
    "CASHCTRL_APIKEY",
    "Please enter your CashCtrl API key:",
  );
Deno.env.get("CASHCTRL_ITEMS_ORDER") || await CliHelpers.promptForEnvInput(
  "CASHCTRL_ITEMS_ORDER",
  "Please enter the default order for items ('none' or field name, e.g. 'client' or 'project'):",
);
Deno.env.get("CASHCTRL_DEFAULT_ACCOUNT") ||
  await CliHelpers.promptForEnvInput(
    "CASHCTRL_DEFAULT_ACCOUNT",
    "Please select your default CashCtrl account:",
  );
Deno.env.get("LANGUAGE") ||
  await CliHelpers.promptForEnvInput(
    "LANGUAGE",
    "Please enter the default LANGUAGE code (e.g., 'de' for German):",
  );

// gracefully exit on SIGINT
Deno.addSignalListener("SIGINT", () => {
  console.log("\n👋 until next time!");
  Deno.exit();
});

async function createOrder(sheetData: SpreadsheetTable): Promise<void> {
  const associates = await CashCtrlApi.request<CashCtrlPerson>(
    "/person/list.json",
  );
  const selectedAssociate = await select({
    message: "Select client",
    choices: associates.data.map((a) => ({ name: a.name, value: a.id })),
  });

  const categories = await CashCtrlApi.request<CashCtrlCategory>(
    "/order/category/list.json",
  );
  const selectedCategory = await select({
    message: "Select category",
    choices: categories.data.map((c) => ({
      name: CashCtrlApi.getTranslation(c.nameSingular),
      value: c.id,
    })),
  });

  const selectedAccount = await CliHelpers.selectAccount("Select account");

  const units =
    (await CashCtrlApi.request<CashCtrlUnit>("/inventory/unit/list.json"))
      ?.data;
  const unit = units.filter((u) => u.name.includes("Std"))[0];
  const taxes = (await CashCtrlApi.request<CashCtrlTax>("/tax/list.json"))
    ?.data;
  const tax = taxes.filter((t) => t.name.includes("MwSt. 8.1%"))[0];
  const categoryInfo = categories.data.find((c) => c.id === selectedCategory);
  const categoryName = CashCtrlApi.getTranslation(
    categoryInfo?.nameSingular ?? "",
  );
  const localizedDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString("de-DE", options);
  };
  const orderData: Partial<CashCtrlOrder> = {
    associateId: selectedAssociate,
    categoryId: selectedCategory,
    date: (new Date()).toISOString().split("T")[0],
    description: `${categoryName} ${localizedDate(dateRange.startDate)}-${
      localizedDate(dateRange.endDate)
    }`,
    dueDays: 10,
    items: JSON.stringify(sheetData.map((row) => ({
      accountId: selectedAccount,
      name: `${row.client}: ${row.project}`,
      description: row.description,
      quantity: row.hours,
      type: "ARTICLE",
      unitPrice: row.pricePerHour * 1.081, // apply tax
      unitId: unit.id,
      taxId: tax.id,
    } as Partial<CashCtrlItem>))),
    language: "DE",
    notes: "created by cashctrl-google-sheets",
  };

  const orderResponse = await CashCtrlApi.request<Partial<CashCtrlOrder>>(
    "/order/create.json",
    "POST",
    orderData,
  );
  console.log("Order created:", orderResponse);
}

const dateRange = await CliHelpers.selectMonth();
const sheetData = await GoogleSheetsApi.getSheetData(dateRange);
const clients = await CliHelpers.selectClients(sheetData);
const groupedSheetData = GoogleSheetsApi.groupPositions(sheetData, clients);
await createOrder(groupedSheetData);
Deno.exit();
