namespace Possing.Models;

public class Sale
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string InvoiceNo { get; set; } = string.Empty;
    public Guid UserId { get; set; }
    public Guid? CustomerId { get; set; }
    public string? CustomerName { get; set; }
    public string? CustomerMobile { get; set; }
    public decimal SubTotal { get; set; }
    /// <summary>Amount or Percent</summary>
    public string DiscountType { get; set; } = DiscountTypes.Amount;
    /// <summary>Raw discount input (BDT amount or percent value)</summary>
    public decimal DiscountValue { get; set; }
    /// <summary>Resolved discount in currency</summary>
    public decimal Discount { get; set; }
    /// <summary>VAT percent from store settings at sale time</summary>
    public decimal TaxRate { get; set; }
    public decimal TaxAmount { get; set; }
    /// <summary>Exclusive = VAT added; Inclusive = prices already include VAT</summary>
    public string TaxMode { get; set; } = TaxModes.Exclusive;
    public decimal Total { get; set; }
    public string PaymentMethod { get; set; } = PaymentMethods.Cash;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public User User { get; set; } = null!;
    public Customer? Customer { get; set; }
    public ICollection<SaleItem> Items { get; set; } = new List<SaleItem>();
}

public static class PaymentMethods
{
    public const string Cash = "Cash";
    public const string Card = "Card";
}

public static class DiscountTypes
{
    public const string Amount = "Amount";
    public const string Percent = "Percent";
}
