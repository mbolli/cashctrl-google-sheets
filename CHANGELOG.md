# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-02-16

### Added
- **Configuration Management System**: Centralized `Config` class for environment variable management
  - Automatic prompts for missing configuration on first run
  - Type-safe accessors (`get()`, `getNumber()`, `getOrDefault()`)
  - Validation of configuration format and structure
  - All settings saved to `.env` file
  
- **Dynamic Tax Selection**: Select tax rate for order items with calcType awareness
  - NET calcType (default): tax added automatically by CashCtrl
  - GROSS calcType: unit price includes tax, multiplied by (1 + tax rate)
  - Shows tax percentage and calcType during selection
  
- **Enhanced Account Selection**: Improved account picker with formatted display
  - Shows account category, number, and name
  - Pre-selects default account when configured
  - Displays all available accounts during first-time setup
  
- **Configurable Settings**: New environment variables for customization
  - `GOOGLE_SHEET_NAME`: Sheet tab name (default: "Rechnungen")
  - `DATE_LOCALE`: Date formatting locale (default: "de-DE")
  - `LANGUAGE`: CashCtrl UI language (default: "de")
  - `CASHCTRL_ITEMS_ORDER`: Sort field for order items
  - `CASHCTRL_UNIT_FILTER`: Unit name filter (default: "Std")
  - `CASHCTRL_DEFAULT_CATEGORY`: Default category ID (default: 4)
  
- **API Response Validation**: CashCtrl API client now validates all responses
  - Function overloads for type-safe GET/POST operations
  - Validates `.data` field for GET responses
  - Validates `.success` field for POST responses
  - Throws descriptive errors on malformed responses
  
- **Graceful Error Handling**: Enhanced user experience on errors
  - Main flow wrapped in try-catch with error categorization
  - Detects Ctrl-C interruptions (`Deno.errors.Interrupted`)
  - Shows friendly goodbye message on graceful exit
  - Descriptive error messages with actionable feedback

### Fixed
- **OAuth Token Expiry Bug**: Token expiry check was incorrectly multiplying milliseconds by 1000
  - Now correctly compares `expiry_date` timestamps directly
  - Prevents unnecessary re-authentication flows
  
- **Type Safety**: Removed unsafe non-null assertions throughout codebase
  - Added proper validation after `find()` operations
  - Throws descriptive errors when selections are missing
  
- **Order Items Parsing**: Fixed type handling when reading existing orders
  - Order items returned as JSON string from API, now properly parsed
  - Prevents runtime errors when merging new items with existing orders

### Changed
- **Import Structure**: Removed circular dependencies
  - `selectTax()` and `selectAccount()` use `Deno.env.get()` directly during initialization
  - Config class initialization happens before other module dependencies
  
- **Hardcoded Values**: Moved all magic strings to environment variables
  - Better configurability across different environments
  - Easier customization without code changes

### Improved
- Documentation updates across README and copilot instructions
- Comprehensive environment variable documentation
- Better error messages throughout the application
- More consistent API response handling

## [0.x] - Pre-1.0.0 Releases

Previous versions focused on core functionality:
- Google Sheets OAuth integration
- CashCtrl API integration
- Basic order creation workflow
- Time tracking position management

[1.0.0]: https://github.com/mbolli/cashctrl-google-sheets/releases/tag/v1.0.0
