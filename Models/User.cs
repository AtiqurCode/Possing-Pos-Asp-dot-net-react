namespace Possing.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = Roles.Cashier;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<Sale> Sales { get; set; } = new List<Sale>();
}

public static class Roles
{
    public const string Admin = "Admin";
    public const string Cashier = "Cashier";
}
