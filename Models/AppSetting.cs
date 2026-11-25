namespace Possing.Models;

public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string Value { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public static class SettingKeys
{
    public const string StoreName = "Store.Name";
    public const string StoreAddress = "Store.Address";
    public const string StorePhone = "Store.Phone";
    public const string Currency = "Store.Currency";
    public const string VatPercent = "Store.VatPercent";
    /// <summary>Exclusive = add VAT on sale; Inclusive = prices already include VAT.</summary>
    public const string TaxMode = "Store.TaxMode";
}

public static class TaxModes
{
    public const string Exclusive = "Exclusive";
    public const string Inclusive = "Inclusive";
}
