import { CliHelpers } from "./cli-helpers.ts";

/**
 * Configuration management class
 * Handles environment variables, defaults, and validation
 */
export class Config {
  private static initialized = false;

  /**
   * Initialize and validate all required configuration
   */
  public static async initialize(): Promise<void> {
    if (this.initialized) return;

    // Required configuration
    await this.ensureEnv("SPREADSHEET_ID", "Please enter your Google Sheets SPREADSHEET_ID:");
    await this.ensureEnv("CASHCTRL_DOMAINID", "Please enter your CashCtrl subdomain (e.g. 'mycompanyltd'):");
    await this.ensureEnv("CASHCTRL_APIKEY", "Please enter your CashCtrl API key:");
    
    // Optional configuration with defaults
    await this.ensureEnv("CASHCTRL_ITEMS_ORDER", "Please enter the default order for items ('none' or field name, e.g. 'client' or 'project'):");
    await this.ensureEnv("CASHCTRL_DEFAULT_ACCOUNT", "Please select your default CashCtrl account:");
    await this.ensureEnv("CASHCTRL_DEFAULT_TAX", "Please select your default CashCtrl tax:");
    await this.ensureEnv("LANGUAGE", "Please enter the default LANGUAGE code (e.g., 'de' for German):", "de");
    
    // New configuration for previously hardcoded values
    await this.ensureEnv("GOOGLE_SHEET_NAME", "Please enter the Google Sheet name to read from:", "Rechnungen");
    await this.ensureEnv("CASHCTRL_DEFAULT_CATEGORY", "Please enter the default CashCtrl category ID:", "4");
    await this.ensureEnv("CASHCTRL_UNIT_FILTER", "Please enter the unit name filter (e.g. 'Std' for hours):", "Std");
    await this.ensureEnv("DATE_LOCALE", "Please enter the date locale (e.g., 'de-DE'):", "de-DE");

    this.initialized = true;
  }

  /**
   * Ensure an environment variable is set, prompt if missing
   */
  private static async ensureEnv(key: string, message: string, defaultValue?: string): Promise<void> {
    if (!Deno.env.get(key)) {
      if (defaultValue) {
        await CliHelpers.updateEnvFile(key, defaultValue);
        Deno.env.set(key, defaultValue);
      } else {
        await CliHelpers.promptForEnvInput(key, message);
      }
    }
  }

  /**
   * Get a required configuration value
   */
  public static get(key: string): string {
    const value = Deno.env.get(key);
    if (!value) {
      throw new Error(`Configuration '${key}' is required but not set. Please run the application to initialize configuration.`);
    }
    return value;
  }

  /**
   * Get an optional configuration value with default
   */
  public static getOrDefault(key: string, defaultValue: string): string {
    return Deno.env.get(key) ?? defaultValue;
  }

  /**
   * Get a numeric configuration value
   */
  public static getNumber(key: string): number {
    const value = this.get(key);
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`Configuration '${key}' must be a number, got: ${value}`);
    }
    return num;
  }

  /**
   * Validate all configuration
   */
  public static validate(): void {
    // Validate SPREADSHEET_ID format (should be alphanumeric with some special chars)
    const spreadsheetId = this.get("SPREADSHEET_ID");
    if (!/^[a-zA-Z0-9_-]{20,}$/.test(spreadsheetId)) {
      console.warn("⚠️  SPREADSHEET_ID format looks unusual. Expected an ID like '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms'");
    }

    // Validate CASHCTRL_DOMAINID (should be alphanumeric, no dots or special chars)
    const domainId = this.get("CASHCTRL_DOMAINID");
    if (!/^[a-zA-Z0-9]+$/.test(domainId)) {
      throw new Error("CASHCTRL_DOMAINID should only contain letters and numbers");
    }

    // Validate LANGUAGE is a valid locale code
    const language = this.get("LANGUAGE");
    if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(language)) {
      console.warn(`⚠️  LANGUAGE '${language}' doesn't look like a standard locale code (e.g., 'de', 'en', 'de-DE')`);
    }
  }
}
