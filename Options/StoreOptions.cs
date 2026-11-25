namespace Possing.Options;

public class StoreOptions
{
    public const string SectionName = "Store";

    public string Name { get; set; } = "Possing Store";
    public string Address { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    /// <summary>Default VAT % seeded into AppSettings.</summary>
    public decimal VatPercent { get; set; } = 5m;
    public string Currency { get; set; } = "BDT";
    /// <summary>Exclusive or Inclusive — seed default only.</summary>
    public string TaxMode { get; set; } = "Exclusive";
}
