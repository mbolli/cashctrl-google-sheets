import { select, confirm, input } from "npm:@inquirer/prompts";
import { GoogleSheetsApi } from "./api-google-sheets.ts";
import { CashCtrlApi } from "./api-cash-ctrl.ts";
import { CliHelpers } from "./cli-helpers.ts";
import { Config } from "./config.ts";
import type {
  CashCtrlCategory,
  CashCtrlItem,
  CashCtrlOrder,
  CashCtrlPerson,
  CashCtrlUnit,
  DateRange,
  SpreadsheetTable,
} from "./types.ts";

// Gracefully handle Ctrl-C (SIGINT)
Deno.addSignalListener("SIGINT", () => {
  console.log("\n\n👋 Interrupted. Goodbye!");
  Deno.exit(0);
});

// Initialize and validate configuration
try {
  await Config.initialize();
  Config.validate();
} catch (error) {
  if (error instanceof Error && (
    error.message.includes("User force closed") ||
    error.message.includes("canceled") ||
    error.message.includes("cancelled") ||
    error.name === "ExitPromptError"
  )) {
    console.log("\n👋 Cancelled during setup. Run again when ready!");
    Deno.exit(0);
  }
  throw error;
}

async function createOrder(sheetData: SpreadsheetTable, dateRange: DateRange): Promise<void> {
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
    default: Config.getNumber("CASHCTRL_DEFAULT_CATEGORY"),
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
  const unitFilter = Config.get("CASHCTRL_UNIT_FILTER");
  const unit = units.find((u) => u.name.includes(unitFilter));
  if (!unit) {
    throw new Error(`No unit found matching filter '${unitFilter}'. Available units: ${units.map(u => CashCtrlApi.getTranslation(u.name)).join(", ")}`);
  }
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
    return date.toLocaleDateString(Config.get("DATE_LOCALE"), options);
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
  if (overrideOrder !== null && replaceItems === false) {
    // Parse items from API response (comes as JSON string)
    const existingItems = typeof overrideOrder.items === 'string' 
      ? JSON.parse(overrideOrder.items) as Partial<CashCtrlItem>[]
      : overrideOrder.items;
    
    if (Array.isArray(existingItems) && Array.isArray(orderData.items)) {
      orderData.items = [...existingItems, ...orderData.items];
    }
    // Preserve other order fields when updating
    orderData = { ...overrideOrder, ...orderData };
  }
  orderData.items = JSON.stringify(orderData.items);

  const orderResponse = await CashCtrlApi.request(
    overrideOrder === null ? "/order/create.json" : "/order/update.json",
    "POST",
    orderData,
  );
  
  if (orderResponse.success) {
    const action = overrideOrder === null ? "created" : "updated";
    console.log(`✓ Order ${action} successfully:`, {
      insertId: orderResponse.insertId,
      message: orderResponse.message,
    });
  } else {
    const action = overrideOrder === null ? "creation" : "update";
    console.error(`✗ Order ${action} failed:`, {
      message: orderResponse.message,
      errors: orderResponse.errors,
    });
    throw new Error(`Order ${action} failed: ${orderResponse.message}`);
  }
}

async function updateSheet(sheetData: SpreadsheetTable): Promise<void> {
  if (await confirm({message: 'Update billed flag in Google sheet?', default: false})) {
    await GoogleSheetsApi.flagBilledPositions(sheetData.map(row => row.row));
  }
}

// Main execution with graceful error handling
async function main() {
  try {
    const dateRange = await CliHelpers.selectMonth();
    const sheetData = await GoogleSheetsApi.getSheetData(dateRange);
    const clients = await CliHelpers.selectClients(sheetData);
    const filteredSheetData = GoogleSheetsApi.filterPositions(sheetData, clients);
    const groupedSheetData = GoogleSheetsApi.groupPositions(filteredSheetData);
    await createOrder(groupedSheetData, dateRange);
    await updateSheet(filteredSheetData);
    console.log("\n✓ Done!");
    Deno.exit(0);
  } catch (error) {
    // Handle user cancellation (Ctrl-C)
    if (error instanceof Error && (
      error.message.includes("User force closed") ||
      error.message.includes("canceled") ||
      error.message.includes("cancelled") ||
      error.name === "ExitPromptError"
    )) {
      console.log("\n👋 Cancelled. See you next time!");
      Deno.exit(0);
    }
    // Handle other errors
    console.error("\n✗ Error:", error instanceof Error ? error.message : error);
    Deno.exit(1);
  }
}

main();
