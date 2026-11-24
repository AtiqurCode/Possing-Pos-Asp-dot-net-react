using Microsoft.EntityFrameworkCore;
using Possing.Models;

namespace Possing.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        await db.Database.MigrateAsync();

        if (!await db.Users.AnyAsync())
        {
            db.Users.AddRange(
                new User
                {
                    Username = "admin",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("admin123"),
                    Role = Roles.Admin
                },
                new User
                {
                    Username = "cashier",
                    PasswordHash = BCrypt.Net.BCrypt.HashPassword("cashier123"),
                    Role = Roles.Cashier
                });
            await db.SaveChangesAsync();
        }

        if (await db.Categories.AnyAsync())
            return;

        var beverages = new Category { Name = "Beverages" };
        var snacks = new Category { Name = "Snacks" };
        db.Categories.AddRange(beverages, snacks);
        await db.SaveChangesAsync();

        var softDrinks = new SubCategory { Name = "Soft Drinks", CategoryId = beverages.Id };
        var teaCoffee = new SubCategory { Name = "Tea & Coffee", CategoryId = beverages.Id };
        var chips = new SubCategory { Name = "Chips", CategoryId = snacks.Id };
        db.SubCategories.AddRange(softDrinks, teaCoffee, chips);
        await db.SaveChangesAsync();

        db.Products.AddRange(
            new Product
            {
                Sku = "SKU-COLA-001",
                SequenceNumber = 1001,
                Name = "Cola 500ml",
                Description = "Chilled cola bottle",
                Price = 40m,
                Quantity = 50,
                MinStockLevel = 10,
                SubCategoryId = softDrinks.Id
            },
            new Product
            {
                Sku = "SKU-WATER-001",
                SequenceNumber = 1002,
                Name = "Mineral Water 500ml",
                Description = "Purified drinking water",
                Price = 20m,
                Quantity = 8,
                MinStockLevel = 15,
                SubCategoryId = softDrinks.Id
            },
            new Product
            {
                Sku = "SKU-TEA-001",
                SequenceNumber = 1003,
                Name = "Masala Tea",
                Description = "Hot masala tea cup",
                Price = 25m,
                Quantity = 100,
                MinStockLevel = 20,
                SubCategoryId = teaCoffee.Id
            },
            new Product
            {
                Sku = "SKU-CHIPS-001",
                SequenceNumber = 1004,
                Name = "Potato Chips",
                Description = "Salted potato chips pack",
                Price = 30m,
                Quantity = 3,
                MinStockLevel = 10,
                SubCategoryId = chips.Id
            });

        await db.SaveChangesAsync();
    }
}
