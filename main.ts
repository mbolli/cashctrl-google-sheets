import { select, confirm, input } from "npm:@inquirer/prompts";
import { GoogleSheetsApi } from "./api-google-sheets.ts";
import { CashCtrlApi } from "./api-cash-ctrl.ts";
import { CliHelpers } from "./cli-helpers.ts";
import type {
  CashCtrlCategory,
  CashCtrlItem,
  CashCtrlOrder,
  CashCtrlPerson,
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
Deno.env.get("CASHCTRL_DEFAULT_TAX") ||
  await CliHelpers.promptForEnvInput(
    "CASHCTRL_DEFAULT_TAX",
    "Please select your default CashCtrl tax:",
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
  const associates = await CashCtrlApi.request<CashCtrlPerson[]>(
    "/person/list.json",
  );
  const selectedAssociate = await select({
    message: "Select associate",
    choices: associates.data.map((a) => ({ name: a.name, value: a.id })),
  });

  const categories = await CashCtrlApi.request<CashCtrlCategory[]>(
    "/order/category/list.json",
  );
  const selectedCategory = await select({
    message: "Select document category",
    choices: categories.data.map((c) => ({
      name: CashCtrlApi.getTranslation(c.nameSingular),
      value: c.id,
    })),
    default: 4, // default to rechnung
  });

  const selectedAccount = await CliHelpers.selectAccount("Select account");
  const selectedTax = await CliHelpers.selectTax("Select tax");
  // For GROSS calcType: unitPrice must include tax (gross price)
  // For NET calcType: unitPrice is net, CashCtrl adds tax on top
  const taxMultiplier = selectedTax.calcType === "GROSS" 
    ? 1 + (selectedTax.percentage / 100)
    : 1;

  const units =
    (await CashCtrlApi.request<CashCtrlUnit[]>("/inventory/unit/list.json"))
      ?.data;
  const unit = units.filter((u) => u.name.includes("Std"))[0];
  const categoryInfo = categories.data.find((c) => c.id === selectedCategory);
  const categoryName = CashCtrlApi.getTranslation(
    categoryInfo?.nameSingular ?? "",
  );

  let overrideOrder: CashCtrlOrder|null = null;
  let replaceItems = false;
  if (await confirm({message: `Update an existing ${categoryName}? This will only touch the order items/positions.`, default: false})) {
    const queryParams = new URLSearchParams({
      categoryId: categoryInfo?.id?.toString() ?? '',
      onlyOpen: 'true',
      filter: JSON.stringify([{
        comparison: 'eq',
        field: 'associateId',
        value: selectedAssociate.toString()
      }])
    });
    const orders = await CashCtrlApi.request<CashCtrlOrder[]>(`/order/list.json?${queryParams.toString()}`);
    const overrideOrderId = await select({
      message: "Select order to update",
      choices: orders.data.map(o => ({ name: `${o.nr}: ${o.description ?? ''}`, value: o.id}))
    });
    const overrideOrderRequest = await CashCtrlApi.request<CashCtrlOrder>(`/order/read.json?id=${overrideOrderId}`);
    overrideOrder = overrideOrderRequest.data;

    replaceItems = await confirm({message: `Replace ${overrideOrder.nr} order items with selected Google sheet rows? Default is to append them.`, default: false});
  }

  let notes = null;
  if (await confirm({message: `Do you want to add (internal) notes to your order?`, default: false})) {
    notes = await input({message: `Internal note`});
  }

  const localizedDate = (date: Date) => {
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "long",
      day: "numeric",
    };
    return date.toLocaleDateString("de-DE", options);
  };

  let orderData: Partial<CashCtrlOrder> = {
    associateId: selectedAssociate,
    categoryId: selectedCategory,
    date: (new Date()).toISOString().split("T")[0], // set to 2025-12-31 to save in old year
    description: `${categoryName} ${localizedDate(dateRange.startDate)}-${
      localizedDate(dateRange.endDate)
    }`,
    dueDays: 10,
    items: sheetData.map((row) => ({
      accountId: selectedAccount,
      name: `${row.client}: ${row.project}`,
      description: row.description,
      quantity: row.hours,
      type: "ARTICLE",
      unitPrice: row.pricePerHour * taxMultiplier,
      unitId: unit.id,
      taxId: selectedTax.id,
    } as Partial<CashCtrlItem>)),
    language: "DE",
    notes,
  };
  if (overrideOrder !== null && replaceItems === false && Array.isArray(overrideOrder.items) && Array.isArray(orderData.items)) {
    overrideOrder.items = [...overrideOrder.items, ...orderData.items];
    orderData = overrideOrder;
  }
  orderData.items = JSON.stringify(orderData.items);

  const orderResponse = await CashCtrlApi.request(
    overrideOrder === null ? "/order/create.json" : "/order/update.json",
    "POST",
    orderData,
  );
  if (orderResponse.success) console.log("Order created:", orderResponse);
  else {
      console.log("Order creation failed:", orderResponse);
  }
}

async function updateSheet(sheetData: SpreadsheetTable): Promise<void> {
  if (await confirm({message: 'Update billed flag in Google sheet?', default: false})) {
    await GoogleSheetsApi.flagBilledPositions(sheetData.map(row => row.row));
  }
}

const dateRange = await CliHelpers.selectMonth();
const sheetData = await GoogleSheetsApi.getSheetData(dateRange);
const clients = await CliHelpers.selectClients(sheetData);
const filteredSheetData = GoogleSheetsApi.filterPositions(sheetData, clients);
const groupedSheetData = GoogleSheetsApi.groupPositions(filteredSheetData);
await createOrder(groupedSheetData);
await updateSheet(filteredSheetData);
Deno.exit();
