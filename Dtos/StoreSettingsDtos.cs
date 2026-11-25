namespace Possing.Dtos;

public record StoreSettingsDto(
    string Name,
    string Address,
    string Phone,
    decimal VatPercent,
    string Currency,
    string TaxMode);

public record UpdateStoreSettingsRequest(
    string Name,
    string Address,
    string Phone,
    decimal VatPercent,
    string Currency,
    string TaxMode);
