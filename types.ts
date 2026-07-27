export type DateRange = {
  startDate: Date;
  endDate: Date;
};

export type SpreadsheetRow = {
  row: number;
  date: string | number; // Column 0: date
  client: string; // Column 1: client
  project: string; // Column 2: project
  description: string; // Column 3: description
  hours: number; // Column 4: hours
  pricePerHour: number; // Column 5: price per hour
  total: number; // Column 6: total (ignored)
  billed: boolean; // Column 7: billed
};

export type SpreadsheetTable = SpreadsheetRow[];

