export class CashCtrlApi {
  public static async request<T>(
    endpoint: string,
    method: "POST" | "GET" = "GET",
    body: T | null = null,
  ): Promise<CashCtrlAnswer<T>> {
    const url = `https://${
      Deno.env.get("CASHCTRL_DOMAINID")
    }.cashctrl.com/api/v1/${endpoint}`;
    const options: RequestInit = {
      method,
      headers: {
        "Authorization": `Basic ${btoa(Deno.env.get("CASHCTRL_APIKEY") + ":")}`,
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
        throw new Error(
          `HTTP error! status: ${response.status} ${await response.text()}`,
        );
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error("Error fetching data:", error);
      throw error;
    }
  }

  public static isXmlLike(data: string): boolean {
    return data.includes("<values>") && data.includes("</values>");
  }

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

  public static getTranslation(data: string): string {
    if (!CashCtrlApi.isXmlLike(data)) return data;
    return CashCtrlApi.parseXmlLike(data)[Deno.env.get("LANGUAGE")] ?? data;
  }

  public static encodeCustomField(data: Record<string, string>): string {
    const xmlParts = ["<values>"];

    for (const [key, value] of Object.entries(data)) {
      xmlParts.push(`<${key}>${value}</${key}>`);
    }

    xmlParts.push("</values>");
    return xmlParts.join("");
  }
}
