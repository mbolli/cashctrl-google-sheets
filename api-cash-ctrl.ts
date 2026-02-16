import { CashCtrlAnswer, CashCtrlWriteResponse } from "./types.ts";
import { Config } from "./config.ts";

/**
 * CashCtrl API class
 */
export class CashCtrlApi {
  /**
   * Make a GET request to the CashCtrl API
   */
  public static async request<T>(
    endpoint: string,
    method?: "GET",
    body?: null,
  ): Promise<CashCtrlAnswer<T>>;
  
  /**
   * Make a POST request to the CashCtrl API
   */
  public static async request<T>(
    endpoint: string,
    method: "POST",
    body: T,
  ): Promise<CashCtrlWriteResponse>;

  /**
   * Implementation
   */
  public static async request<T>(
    endpoint: string,
    method: "POST" | "GET" = "GET",
    body?: T | null,
  ): Promise<CashCtrlAnswer<T> | CashCtrlWriteResponse> {
    const url = `https://${
      Config.get("CASHCTRL_DOMAINID")
    }.cashctrl.com/api/v1/${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Basic ${btoa(Config.get("CASHCTRL_APIKEY") + ":")}`,
      },
    };

    if (method === "POST" && body) {
      const formData = new FormData();
      for (const [key, value] of Object.entries(body)) {
        formData.append(key, String(value));
      }
      options.body = formData;
    }

    try {
      const response = await fetch(url, options);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `CashCtrl API error (${response.status}): ${errorText}`,
        );
      }

      const data = await response.json();
      
      // Validate response structure for GET requests
      if (method === "GET") {
        if (!data || typeof data !== "object") {
          throw new Error("Invalid API response: expected object");
        }
        if (!('data' in data)) {
          throw new Error("Invalid API response: missing 'data' field");
        }
        if ('data' in data && data.data === null) {
          throw new Error("API returned null data");
        }
      }
      
      // Validate response structure for POST requests
      if (method === "POST") {
        if (!data || typeof data !== "object") {
          throw new Error("Invalid API response: expected object");
        }
        if (!('success' in data)) {
          throw new Error("Invalid API response: missing 'success' field");
        }
      }

      return data;
    } catch (error) {
      console.error("CashCtrl API request failed:", error);
      throw error;
    }
  }

  /**
   * Check if the given data is XML-like
   */
  public static isXmlLike(data: string): boolean {
    return data.includes("<values>");
  }

  /**
   * Parse XML-like string to object
   * Resolves `<values><de>Übersetzung</de></values>` to `{ de: "Übersetzung" }`
   */
  public static parseXmlLike(data: string): Record<string, string> {
    const result: Record<string, string> = {};

    // Return original data if no tags found
    if (!data.includes("<")) {
      return { value: data };
    }

    // Extract content between <values> tags
    const valuesMatch = data.match(/<values>(.*?)<\/values>/);
    if (!valuesMatch) return result;

    const valuesContent = valuesMatch[1];

    // Match all tags and their content
    const tagMatches = valuesContent.matchAll(/<(\w+)>(.*?)<\/\1>/g);

    for (const match of tagMatches) {
      const [, key, value] = match;
      result[key] = value;
    }

    return result;
  }

  /**
   * Get the translation for the given data using the current language
   */
  public static getTranslation(data: string): string {
    if (!CashCtrlApi.isXmlLike(data)) return data;
    return CashCtrlApi.parseXmlLike(data)[Config.get("LANGUAGE")] ??
      data;
  }

  /**
   * For custom fields, we need to encode the data as XML-like string
   */
  public static encodeCustomField(data: Record<string, string>): string {
    const xmlParts = ["<values>"];

    for (const [key, value] of Object.entries(data)) {
      xmlParts.push(`<${key}>${value}</${key}>`);
    }

    xmlParts.push("</values>");
    return xmlParts.join("");
  }
}
