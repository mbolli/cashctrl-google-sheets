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

export type CashCtrlAnswer<T> = {
  total: number;
  data: T;
};

export type CashCtrlPerson = {
  id: number; // Unique identifier for the person
  created: string; // Creation date and time
  createdBy: string; // Email of the creator
  lastUpdated: string; // Last updated date and time
  lastUpdatedBy: string; // Email of the last updater
  categoryId: number; // ID of the category
  thumbnailFileId: null; // Thumbnail file ID or null
  categoryDisplay: string; // Display name for the category
  title: string; // Title of the person
  titleId: number; // ID of the title
  titleSentence: string; // Formal address
  gender: string; // Gender of the person
  nr: string; // Unique number for the person
  name: string; // Full name of the person
  firstName: string; // First name
  lastName: string; // Last name
  company: string; // Company name
  position: string | null; // Position in the company or null
  industry: string; // Industry of the company
  department: string | null; // Department or null
  language: string | null; // Preferred language or null
  bankData: string | null; // Bank data or null
  iban: string | null; // IBAN or null
  bic: string | null; // BIC or null
  vatUid: string | null; // VAT UID or null
  dateBirth: string | null; // Date of birth or null
  discountPercentage: number | null; // Discount percentage or null
  discountInherited: number | null; // Inherited discount or null
  discountEffective: number | null; // Effective discount or null
  notes: string | null; // Additional notes or null
  emailWork: string; // Work email
  emailPrivate: string | null; // Private email or null
  phoneWork: string | null; // Work phone or null
  phonePrivate: string | null; // Private phone or null
  mobileWork: string | null; // Work mobile or null
  mobilePrivate: string | null; // Private mobile or null
  url: string; // Website URL
  address: string; // Address
  zip: string; // ZIP code
  city: string; // City
  country: string; // Country code
  superiorId: number | null; // ID of the superior or null
  superiorName: string | null; // Name of the superior or null
  color: string | null; // Color or null
  altName: string | null; // Alternative name or null
  custom: string; // Custom field
  attachmentCount: number; // Number of attachments
  isInactive: boolean; // Indicates if the person is inactive
};

export type CashCtrlStatus = {
  id: number;
  created: string | null;
  createdBy: string;
  lastUpdated: string;
  lastUpdatedBy: string;
  categoryId: number;
  actionId: string;
  name: string; // Assuming this is a string representation of a localized value
  icon: string;
  pos: number;
  text: string | null;
  value: string | null;
  iconCls: string | null;
  isBook: boolean;
  isRemoveStock: boolean;
  isAddStock: boolean;
  isClosed: boolean;
};

export type CashCtrlBookTemplate = {
  id: number;
  created: string;
  createdBy: string;
  lastUpdated: string;
  lastUpdatedBy: string;
  categoryId: number;
  accountId: number;
  taxId: number | null;
  name: string; // Assuming this is a string representation of a localized value
  pos: number;
  text: string | null;
  value: string | null;
  isAllowTax: boolean;
};

export type CashCtrlCategory = {
  id: number;
  created: string;
  createdBy: string;
  lastUpdated: string;
  lastUpdatedBy: string;
  accountId: number;
  currencyId: number | null;
  status: CashCtrlStatus[];
  bookTemplates: CashCtrlBookTemplate[];
  sequenceNrId: number;
  templateId: number | null;
  sentStatusId: number | null;
  responsiblePersonId: number | null;
  roundingId: number | null;
  fileId: number | null;
  attachments: { file: string }[]; // Adjust export type as necessary
  nameSingular: string; // Assuming this is a string representation of a localized value
  namePlural: string; // Assuming this is a string representation of a localized value
  type: string;
  bookType: string;
  addressType: string;
  dueDays: number | null;
  header: string | null;
  footer: string | null;
  mail: string | null;
  pos: number;
  text: string | null;
  typeName: string | null;
  defaultStatusId: number;
  responsiblePersonName: string | null;
  value: string;
  sequenceNrIdInherited: number;
  isFree: boolean;
  isInactive: boolean;
  hasDueDays: boolean;
  isDisplayPrices: boolean;
  isDisplayItemGross: boolean;
  isSwitchRecipient: boolean;
};

// types.ts
export type CashCtrlOrder = {
  id: number; // Unique identifier for the invoice
  created: string; // Creation date and time
  createdBy: string; // Email of the creator
  lastUpdated: string; // Last updated date and time
  lastUpdatedBy: string; // Email of the last updater
  associateId: number; // ID of the associated person
  items: string|Partial<CashCtrlItem>[]; // JSON encoded Partial<CashCtrlItem>[]
  associateName: string; // Name of the associated person
  responsiblePersonId: number | null; // ID of the responsible person or null
  responsiblePersonName: string | null; // Name of the responsible person or null
  accountId: number; // ID of the account
  account: string; // Account details in multiple languages
  categoryId: number; // ID of the category
  actionId: string; // Action ID (if applicable)
  groupId: number; // Group ID
  previousId: number | null; // ID of the previous invoice or null
  statusId: number; // Status ID
  type: string; // export type of the invoice (e.g., SALES)
  bookType: string; // export type of booking (e.g., DEBIT)
  statusName: string; // Status name in multiple languages
  sentStatusId: number; // Sent status ID
  roundingId: number | null; // Rounding ID or null
  icon: string; // Icon representation
  nameSingular: string; // Singular name in multiple languages
  namePlural: string; // Plural name in multiple languages
  date: string; // Invoice date
  dateDue: string; // Due date
  nr: string; // Invoice number
  description: string; // Description of the invoice
  notes: string | null; // Additional notes or null
  dueDays: number; // Number of days until due
  currencyId: number | null; // Currency ID or null
  currencyRate: number; // Currency exchange rate
  discountPercentage: number | null; // Discount percentage or null
  currencyCode: string; // Currency code (e.g., CHF)
  subTotal: number; // Subtotal amount
  tax: number; // Tax amount
  total: number; // Total amount
  open: boolean | null; // Open status or null
  groupOpen: boolean | null; // Group open status or null
  dateDeliveryStart: string | null; // Delivery start date or null
  dateDeliveryEnd: string | null; // Delivery end date or null
  dateLastBooked: string; // Last booked date
  language: "DE" | "EN" | "FR" | "IT" | null; // Language preference or null
  recurrence: string | null; // Recurrence information or null
  startDate: string | null; // Start date or null
  endDate: string | null; // End date or null
  daysBefore: number | null; // Days before notification or null
  notifyType: string | null; // Notification export type or null
  notifyPersonId: number | null; // ID of the notified person or null
  notifyUserId: number | null; // ID of the notified user or null
  notifyEmail: string | null; // Email for notifications or null
  attachmentCount: number; // Number of attachments
  allocationCount: number | null; // Allocation count or null
  costCenterIds: number[] | null; // Array of cost center IDs or null
  custom: string; // Custom field
  sent: boolean | null; // Sent status or null
  sentBy: string | null; // Email of the sender or null
  downloaded: boolean | null; // Downloaded status or null
  downloadedBy: string | null; // Email of the downloader or null
  costCenterNumbers: string | null; // Cost center numbers or null
  isBook: boolean; // Indicates if it is booked
  isRemoveStock: boolean; // Indicates if stock is removed
  isAddStock: boolean; // Indicates if stock is added
  isClosed: boolean; // Indicates if the invoice is closed
  hasDueDays: boolean; // Indicates if there are due days
  isDisplayItemGross: boolean; // Indicates if gross items are displayed
  isRecurring: boolean; // Indicates if it is a recurring invoice
  isCreditNote: boolean; // Indicates if it is a credit note
};
export type CashCtrlItem = {
  id: number;
  created: string; // ISO 8601 date string
  createdBy: string;
  lastUpdated: string; // ISO 8601 date string
  lastUpdatedBy: string;
  orderId: number;
  inventoryId: number;
  accountId: number;
  taxId: number;
  unitId: number;
  unitName: string; // XML-like string
  attachments: { file: string }[]; // Adjust export type as necessary
  allocations: { id: number }[]; // Adjust export type as necessary
  type: "ARTICLE" | "TEXT" | "PAGEBREAK" | "SUBTOTAL" | "TITLE" | "OPTIONTOTAL";
  articleNr: string;
  quantity: number;
  name: string;
  description: string;
  unitPrice: number;
  discountPercentage: number | null; // Can be null
  pos: number;
  taxName: string; // XML-like string
  taxAmount: number;
  defaultCurrencyUnitPrice: number;
  netUnitPrice: number;
  defaultCurrencyNetUnitPrice: number;
  taxRate: number;
  taxCalcType: "NET" | "GROSS"; // Fixed string type
  grossTotal: number;
  taxTotal: number;
  netTotal: number;
  defaultCurrencyNetTotal: number;
  defaultCurrencyGrossTotal: number;
  discountEffective: number | null; // Can be null
  discountInherited: number | null; // Can be null
  isOptional: boolean;
  isInventoryArticle: boolean;
};

export type CashCtrlAccount = {
  id: number;
  created: string; // ISO 8601 date string
  createdBy: string;
  lastUpdated: string; // ISO 8601 date string
  lastUpdatedBy: string;
  categoryId: number;
  categoryDisplay: string; // XML-like string
  accountClass: string;
  taxId: number | null;
  taxName: string | null;
  currencyId: number | null;
  currencyCode: string;
  number: string;
  name: string; // XML-like string
  custom: string | null; // Adjust export type as necessary
  notes: string | null;
  attachmentCount: number;
  allocationCount: number;
  costCenterIds: number[] | null;
  costCenterNumbers: string[] | null;
  openingAmount: number;
  endAmount: number;
  targetMin: number | null;
  targetMax: number | null;
  targetDisplay: string | null;
  defaultCurrencyOpeningAmount: number;
  defaultCurrencyEndAmount: number;
  isInactive: boolean;
};

export type CashCtrlAccountCategory = {
  id: number;
  created: string; // ISO 8601 date string
  createdBy: string;
  lastUpdated: string; // ISO 8601 date string
  lastUpdatedBy: string;
  parentId: number;
  accountClass: string;
  number: string;
  name: string; // XML-like string
  fullName: string; // XML-like string
  isSystem: boolean;
};

export type CashCtrlUnit = {
  id: number;
  name: string; // XML-like string
};

export type CashCtrlTax = {
  id: number;
  created: string; // ISO 8601 date string
  createdBy: string;
  lastUpdated: string; // ISO 8601 date string
  lastUpdatedBy: string;
  accountId: number;
  name: string; // XML-like string
  documentName: string; // XML-like string
  calcType: "NET" | "GROSS"; // Assuming these are the only possible values
  percentage: number;
  percentageFlat: number | null;
  text: string;
  accountDisplay: string; // XML-like string
  listCls: string;
  value: string;
  isInactive: boolean;
  isPreTax: boolean;
  isFlat: boolean;
  isGrossCalcType: boolean;
};
