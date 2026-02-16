import type {
  CashCtrlAccount,
  CashCtrlAccountCategory,
  CashCtrlTax,
  DateRange,
  SpreadsheetTable,
} from "./types.ts";
import inquirer from "npm:inquirer";
import { CashCtrlApi } from "./api-cash-ctrl.ts";
import { checkbox, select } from "npm:@inquirer/prompts";

export class CliHelpers {
  public static async selectMonth(): Promise<DateRange> {
    const answers = await inquirer.prompt([
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
    ]);
    return {
      startDate: new Date(answers.startDate),
      endDate: new Date(answers.endDate),
    };
  }

  public static async selectClients(
    sheetData: SpreadsheetTable,
  ): Promise<string[]> {
    const uniqueClients = [...new Set(sheetData.map((row) => row.client))];

    if (uniqueClients.length === 0) {
      console.log("%cNo order positions found with the supplied date and billed=false. Exiting...", "color: red");
      Deno.exit();
    }

    return await checkbox(
      {
        message: "Select clients",
        pageSize: 20,
        choices: uniqueClients.map((client) => ({
          name: client,
          value: client,
          checked: true,
        })),
        validate: function (choices) {
          if (choices.length < 1) {
            return "You must choose at least one client.";
          }
          return true;
        },
      },
    );
  }

  public static async selectAccount(message: string): Promise<number> {
    const accounts = await CashCtrlApi.request<CashCtrlAccount[]>(
      "/account/list.json",
    );
    const accountCategories = await CashCtrlApi.request<
      CashCtrlAccountCategory[]
    >(
      "/account/category/list.json",
    );
    const accountCategoryMap: Record<number, string> = accountCategories.data
      .reduce((acc, c) => {
        acc[c.id] = CashCtrlApi.getTranslation(c.name);
        return acc;
      }, {} as Record<number, string>);

    const formatAccount = (account: CashCtrlAccount): string =>
      `${accountCategoryMap[account.categoryId]} | ${account.number}: ${
        CashCtrlApi.getTranslation(account.name)
      }`;

    // Handle case where default isn't set yet (during initialization)
    const defaultAccountIdStr = Deno.env.get("CASHCTRL_DEFAULT_ACCOUNT");
    const defaultAccountId = defaultAccountIdStr ? Number(defaultAccountIdStr) : undefined;

    const selectedAccountId = await select({
      message: message,
      choices: accounts.data.map((a) => ({
        name: formatAccount(a),
        value: a.id,
      })),
      default: defaultAccountId,
      pageSize: 20,
    });

    const selectedAccount = accounts.data.find((a) => a.id === selectedAccountId);
    if (!selectedAccount) {
      throw new Error(`Selected account (ID: ${selectedAccountId}) not found. It may have been deleted.`);
    }
    return selectedAccount.id;
  }

  public static async selectTax(message: string): Promise<CashCtrlTax> {
    const taxes = await CashCtrlApi.request<CashCtrlTax[]>(
      "/tax/list.json",
    );

    const formatTax = (tax: CashCtrlTax): string =>
      `${CashCtrlApi.getTranslation(tax.name)} (${tax.percentage}% ${tax.calcType})`;

    // Handle case where default isn't set yet (during initialization)
    const defaultTaxIdStr = Deno.env.get("CASHCTRL_DEFAULT_TAX");
    const defaultTaxId = defaultTaxIdStr ? Number(defaultTaxIdStr) : undefined;

    const selectedTaxId = await select({
      message: message,
      choices: taxes.data.map((t) => ({
        name: formatTax(t),
        value: t.id,
      })),
      default: defaultTaxId,
      pageSize: 20,
    });

    const selectedTax = taxes.data.find((t) => t.id === selectedTaxId);
    if (!selectedTax) {
      throw new Error(`Selected tax (ID: ${selectedTaxId}) not found. It may have been deleted.`);
    }
    return selectedTax;
  }

  public static async promptForEnvInput(
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
      await CliHelpers.updateEnvFile(key, answer);
      return answer;
    }
    if (key === "CASHCTRL_DEFAULT_ACCOUNT") {
      const selectedAccount = await CliHelpers.selectAccount(
        "Select default account",
      );
      await CliHelpers.updateEnvFile(key, selectedAccount.toString());
      return selectedAccount.toString();
    }
    if (key === "CASHCTRL_DEFAULT_TAX") {
      const selectedTax = await CliHelpers.selectTax(
        "Select default tax",
      );
      await CliHelpers.updateEnvFile(key, selectedTax.id.toString());
      return selectedTax.id.toString();
    }
    const answer = await inquirer.prompt([
      {
        type: "input",
        name: "value",
        message: message,
      },
    ]);

    const value = answer.value;
    await CliHelpers.updateEnvFile(key, value);
    return value;
  }

  public static async updateEnvFile(key: string, value: string): Promise<void> {
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

    const newEnvContent = lines.join("\n") + "\n"; // Add trailing newline
    await Deno.writeTextFile(envFilePath, newEnvContent);
    Deno.env.set(key, value);
  }
}
