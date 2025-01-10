import inquirer from "npm:inquirer";
import { select } from "npm:@inquirer/prompts";
import { Choice, search } from "npm:@inquirer/prompts";
import { getSheetData, googleAuthenticate } from "./api-google-sheets.ts";
import { CashCtrlApi } from "./api-cash-ctrl.ts";

Deno.env.get("SPREADSHEET_ID") ||
  await promptForEnvInput(
    "SPREADSHEET_ID",
    "Please enter your Google Sheets SPREADSHEET_ID:",
  );
Deno.env.get("CASHCTRL_DOMAINID") ||
  await promptForEnvInput(
    "CASHCTRL_DOMAINID",
    "Please enter your CashCtrl subdomain (e.g. 'mycompanyltd'):",
  );
Deno.env.get("CASHCTRL_APIKEY") ||
  await promptForEnvInput(
    "CASHCTRL_APIKEY",
    "Please enter your CashCtrl API key:",
  );
Deno.env.get("CASHCTRL_ITEMS_ORDER") || await promptForEnvInput(
  "CASHCTRL_ITEMS_ORDER",
  "Please enter the default order for items ('none' or field name, e.g. 'client' or 'project'):",
);
Deno.env.get("CASHCTRL_DEFAULT_ACCOUNT") ||
  await promptForEnvInput(
    "CASHCTRL_DEFAULT_ACCOUNT",
    "Please select your default CashCtrl account:",
  );
Deno.env.get("LANGUAGE") ||
  await promptForEnvInput(
    "LANGUAGE",
    "Please enter the default LANGUAGE code (e.g., 'de' for German):",
  );

Deno.addSignalListener("SIGINT", () => {
  console.log("\n👋 until next time!");
  Deno.exit();
});

async function promptForEnvInput(
  key: string,
  message: string,
): Promise<string> {
  if (key === "CASHCTRL_ITEMS_ORDER") {
    const choicesWithLabels = [
      { value: "none", label: "No sorting" },
      { value: "date", label: "Sort by date" },
      { value: "client", label: "Sort by client name" },
      { value: "hours", label: "Sort by hours" },
      { value: "pricePerHour", label: "Sort by price per hour" },
      { value: "total", label: "Sort by total amount" },
    ];
    const answer = await select({
      message: "Select the order for items:",
      choices: choicesWithLabels.map((c) => ({
        name: c.label,
        value: c.value,
      })),
    });
    await updateEnvFile(key, answer);
    return answer;
  }
  if (key === "CASHCTRL_DEFAULT_ACCOUNT") {
    const selectedAccount = await selectAccount("Select default account");
    await updateEnvFile(key, selectedAccount.toString());
    return selectedAccount.toString();
  }
  const answer = await inquirer.prompt([
    {
      type: "input",
      name: "value",
      message: message,
    },
  ]);

  const value = answer.value;
  await updateEnvFile(key, value);
  return value;
}

async function updateEnvFile(key: string, value: string): Promise<void> {
  const envFilePath = ".env";
  let envContent: string;

  try {
    envContent = await Deno.readTextFile(envFilePath);
  } catch {
    envContent = "";
  }

  const lines = envContent.trim().split("\n").filter(Boolean);
  const keyIndex = lines.findIndex((line) => line.startsWith(`${key}=`));

  if (keyIndex >= 0) {
    lines[keyIndex] = `${key}=${value}`;
  } else {
    lines.push(`${key}=${value}`);
  }

  const newEnvContent = lines.join("\n");
  await Deno.writeTextFile(envFilePath, newEnvContent);
  Deno.env.set(key, value);
}

async function selectMonth(): Promise<DateRange> {
  const questions = [
    {
      type: "input",
      name: "startDate",
      message: "Enter the start date (YYYY-MM-DD):",
      default: "2025-01-01",
    },
    {
      type: "input",
      name: "endDate",
      message: "Enter the end date (YYYY-MM-DD):",
      default: (new Date()).toISOString().split("T")[0],
    },
  ];

  const answers = await inquirer.prompt(questions);
  return {
    startDate: new Date(answers.startDate),
    endDate: new Date(answers.endDate),
  };
}

async function selectClients(sheetData: SpreadsheetTable): Promise<string[]> {
  const uniqueClients = [...new Set(sheetData.map((row) => row.client))];
  const questions = [
    {
      type: "checkbox",
      name: "selectedClients",
      message: "Select clients",
      pageSize: 20,
      choices: uniqueClients.map((client) => ({
        name: client,
        value: client,
        checked: true,
      })),
      validate: function (answer: string) {
        if (answer.length < 1) {
          return "You must choose at least one client.";
        }
        return true;
      },
    },
  ];

  // todo match this client with cashCtrl client?

  const answers = await inquirer.prompt(questions);
  return answers.selectedClients;
}

async function selectAccount(message: string): Promise<number> {
  let accounts = await CashCtrlApi.request<CashCtrlAccount>(
    "/account/list.json",
  );
  const accountCategories = await CashCtrlApi.request<CashCtrlAccountCategory>(
    "/account/category/list.json",
  );
  const accountCategoryMap: Record<number, string> = accountCategories.data
    .reduce((acc, c) => {
      acc[c.id] = CashCtrlApi.getTranslation(c.name);
      return acc;
    }, {});

  const formatAccount = (account: CashCtrlAccount): string =>
    `${accountCategoryMap[account.categoryId]} | ${account.number}: ${
      CashCtrlApi.getTranslation(account.name)
    }`;

  const defaultAccountId = Number(Deno.env.get("CASHCTRL_DEFAULT_ACCOUNT"));
  const defaultAccount = accounts.data.find((a) => a.id === defaultAccountId);
  if (defaultAccount) {
    message += ` (default: ${formatAccount(defaultAccount)})`;
  }

  const selectedAccount = await search({
    message: message,
    source: (input: string | void): ReadonlyArray<Choice<number>> => {
      if (!input || input.length === 0) {
        return [
          defaultAccount
            ? { name: formatAccount(defaultAccount), value: defaultAccountId }
            : undefined,
        ];
      }
      const foundAccounts = accounts.data.filter((account) =>
        account.name.toLowerCase().includes(input.toLowerCase()) ||
        account.number.toLowerCase().includes(input.toLowerCase()) ||
        accountCategoryMap[account.categoryId].toLowerCase().includes(
          input.toLowerCase(),
        )
      );
      return foundAccounts.map((a) => ({
        name: formatAccount(a),
        value: a.id,
      }));
    },
    pageSize: 20,
  });

  return selectedAccount;
}

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

  const selectedAccount = await selectAccount("Select account");

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
    notes: "created by google-sheets-cashctrl",
  };

  const orderResponse = await CashCtrlApi.request<Partial<CashCtrlOrder>>(
    "/order/create.json",
    "POST",
    orderData,
  );
  console.log("Order created:", orderResponse);
}

function cleanPositions(
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
    {},
  );

  // order items
  const orderBy = Deno.env.get("CASHCTRL_ITEMS_ORDER") || "client";
  const values = Object.values(groupedPositions);

  return values.sort((a, b) =>
    String(a[orderBy]).localeCompare(
      String(b[orderBy]),
      Deno.env.get("LANGUAGE"),
      { numeric: true },
    )
  );
}

const authClient = await googleAuthenticate();
const dateRange = await selectMonth();
const sheetData = await getSheetData(authClient, dateRange);
const clients = await selectClients(sheetData);
await createOrder(cleanPositions(sheetData, clients), clients);
Deno.exit();
