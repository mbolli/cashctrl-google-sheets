import { select, confirm, input } from "npm:@inquirer/prompts";
import { GoogleSheetsApi } from "./api-google-sheets.ts";
import { CliHelpers } from "./cli-helpers.ts";
import { Config } from "./config.ts";
import { cc, currentTaxPercentage, effectiveTaxCalcType, t } from "./cash-ctrl.ts";
import { CashCtrlValidationError } from "@zweiundeins/cashctrl-ts-sdk";
import type {
  Order,
  OrderCreateParams,
} from "@zweiundeins/cashctrl-ts-sdk";
import type { DateRange, SpreadsheetTable } from "./types.ts";

/** One entry of the `items` array accepted by order create/update. */
type OrderItem = NonNullable<OrderCreateParams["items"]>[number];

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
  const associates = await cc().person.list();
  const selectedAssociate = await select({
    message: "Select associate",
    choices: associates.map((a) => ({ name: a.name, value: a.id })),
  });

  const categories = await cc().order.category.list();
  const selectedCategory = await select({
    message: "Select document category",
    choices: categories.map((c) => ({
      name: t(c.nameSingular),
      value: c.id,
    })),
    default: Config.getNumber("CASHCTRL_DEFAULT_CATEGORY"),
  });

  const selectedAccount = await CliHelpers.selectAccount("Select account");
  const selectedTax = await CliHelpers.selectTax("Select tax");
  // Sheet rates are net. For a GROSS calcType tax (e.g. Saldosteuersatz),
  // CashCtrl reads unitPrice as gross, so gross it up by the tax rate to keep
  // each position's net total equal to the sheet amount. For a NET tax,
  // CashCtrl adds the tax on top, so the net rate is sent unchanged.
  const taxMultiplier = effectiveTaxCalcType(selectedTax) === "GROSS"
    ? 1 + (currentTaxPercentage(selectedTax) / 100)
    : 1;

  const units = await cc().inventory.unit.list();
  const unitFilter = Config.get("CASHCTRL_UNIT_FILTER");
  const unit = units.find((u) => u.name.includes(unitFilter));
  if (!unit) {
    throw new Error(
      `No unit found matching filter '${unitFilter}'. Available units: ${
        units.map((u) => t(u.name)).join(", ")
      }`,
    );
  }
  const categoryInfo = categories.find((c) => c.id === selectedCategory);
  const categoryName = t(categoryInfo?.nameSingular ?? "");

  let overrideOrder: Order | null = null;
  let replaceItems = false;
  if (
    await confirm({
      message:
        `Update an existing ${categoryName}? This will only touch the order items/positions.`,
      default: false,
    })
  ) {
    // The SDK serializes `filter` to JSON and builds the query string.
    const orders = await cc().order.list({
      categoryId: categoryInfo?.id,
      onlyOpen: true,
      filter: [{
        comparison: "eq",
        field: "associateId",
        value: selectedAssociate,
      }],
    });
    const overrideOrderId = await select({
      message: "Select order to update",
      choices: orders.map((o) => ({
        name: `${o.nr}: ${o.description ?? ""}`,
        value: o.id,
      })),
    });
    overrideOrder = await cc().order.read({ id: overrideOrderId });

    replaceItems = await confirm({
      message:
        `Replace ${overrideOrder.nr} order items with selected Google sheet rows? Default is to append them.`,
      default: false,
    });
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

  const items: OrderItem[] = sheetData.map((row) => ({
    accountId: selectedAccount,
    name: `${row.client}: ${row.project}`,
    description: row.description,
    quantity: row.hours,
    type: "ARTICLE",
    unitPrice: row.pricePerHour * taxMultiplier,
    unitId: unit.id,
    taxId: selectedTax.id,
  }));

  if (overrideOrder && !replaceItems) {
    // Appending: keep the order's current positions in front of the new ones.
    // Read results carry computed fields (netTotal, taxAmount, pos, ...) that
    // update does not accept, so project each one down to its writable parts.
    const existingItems: OrderItem[] = (overrideOrder.items ?? []).map((i) => ({
      accountId: i.accountId,
      name: i.name,
      unitPrice: i.unitPrice,
      articleNr: i.articleNr ?? undefined,
      description: i.description ?? undefined,
      discountPercentage: i.discountPercentage ?? undefined,
      inventoryId: i.inventoryId ?? undefined,
      quantity: i.quantity ?? undefined,
      taxId: i.taxId ?? undefined,
      type: i.type as OrderItem["type"],
      unitId: i.unitId ?? undefined,
    }));
    items.unshift(...existingItems);
  }

  const orderFields = {
    associateId: selectedAssociate,
    categoryId: selectedCategory,
    date: new Date(), // set explicitly to book into an earlier period
    description: `${categoryName} ${localizedDate(dateRange.startDate)}-${
      localizedDate(dateRange.endDate)
    }`,
    dueDays: 10,
    items,
    language: "DE" as const,
    ...(notes === null ? {} : { notes }),
  };

  const action = overrideOrder === null ? "created" : "updated";
  try {
    // `update` replaces the whole record, so `updatePreserving` resends the
    // order's current values for everything this function does not set.
    const response = overrideOrder === null
      ? await cc().order.create(orderFields)
      : await cc().order.updatePreserving(overrideOrder, {
        ...orderFields,
        id: overrideOrder.id,
      });

    console.log(`\u2713 Order ${action} successfully:`, {
      insertId: response.insertId,
      message: response.message,
    });
  } catch (error) {
    if (error instanceof CashCtrlValidationError) {
      console.error(`\u2717 Order ${action === "created" ? "creation" : "update"} failed:`);
      for (const [field, messages] of Object.entries(error.byField())) {
        console.error(`  ${field}: ${messages.join(", ")}`);
      }
    }
    throw error;
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
