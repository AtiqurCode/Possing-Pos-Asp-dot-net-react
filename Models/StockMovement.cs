namespace Possing.Models;

public class StockMovement
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid ProductId { get; set; }
    /// <summary>Received | Sold | Missing | Adjustment</summary>
    public string Type { get; set; } = StockMovementTypes.Adjustment;
    /// <summary>Absolute units moved (always &gt; 0).</summary>
    public int Quantity { get; set; }
    public int QuantityBefore { get; set; }
    public int QuantityAfter { get; set; }
    public string? Note { get; set; }
    public Guid? ReferenceId { get; set; }
    public string? ReferenceType { get; set; }
    public Guid? UserId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Product Product { get; set; } = null!;
    public User? User { get; set; }
}

public static class StockMovementTypes
{
    public const string Received = "Received";
    public const string Sold = "Sold";
    public const string Missing = "Missing";
    public const string Adjustment = "Adjustment";
}
