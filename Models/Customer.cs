namespace Possing.Models;

public class Customer
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = string.Empty;
    public string Mobile { get; set; } = string.Empty;
    public string MembershipCode { get; set; } = string.Empty;
    public int VisitCount { get; set; }
    public decimal TotalSpent { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}
