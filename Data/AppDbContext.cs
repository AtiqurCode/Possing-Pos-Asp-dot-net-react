using Microsoft.EntityFrameworkCore;
using Possing.Models;

namespace Possing.Data;

public class AppDbContext(DbContextOptions<AppDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Customer> Customers => Set<Customer>();
    public DbSet<Category> Categories => Set<Category>();
    public DbSet<SubCategory> SubCategories => Set<SubCategory>();
    public DbSet<Product> Products => Set<Product>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<SaleItem> SaleItems => Set<SaleItem>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<AppSetting>(e =>
        {
            e.HasKey(x => x.Key);
            e.Property(x => x.Key).HasMaxLength(64);
            e.Property(x => x.Value).HasMaxLength(512);
        });

        modelBuilder.Entity<User>(e =>
        {
            e.HasIndex(x => x.Username).IsUnique();
            e.Property(x => x.Username).HasMaxLength(64);
            e.Property(x => x.Role).HasMaxLength(32);
        });

        modelBuilder.Entity<Customer>(e =>
        {
            e.HasIndex(x => x.Mobile).IsUnique();
            e.HasIndex(x => x.MembershipCode).IsUnique();
            e.Property(x => x.Name).HasMaxLength(128);
            e.Property(x => x.Mobile).HasMaxLength(20);
            e.Property(x => x.MembershipCode).HasMaxLength(32);
            e.Property(x => x.TotalSpent).HasPrecision(18, 2);
        });

        modelBuilder.Entity<Category>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(128);
        });

        modelBuilder.Entity<SubCategory>(e =>
        {
            e.Property(x => x.Name).HasMaxLength(128);
            e.HasOne(x => x.Category)
                .WithMany(x => x.SubCategories)
                .HasForeignKey(x => x.CategoryId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<Product>(e =>
        {
            e.HasIndex(x => x.Sku).IsUnique();
            e.HasIndex(x => x.SequenceNumber).IsUnique();
            e.Property(x => x.Sku).HasMaxLength(64);
            e.Property(x => x.Name).HasMaxLength(256);
            e.Property(x => x.Description).HasMaxLength(2000);
            e.Property(x => x.ImagePath).HasMaxLength(512);
            e.Property(x => x.Price).HasPrecision(18, 2);
            e.HasOne(x => x.SubCategory)
                .WithMany(x => x.Products)
                .HasForeignKey(x => x.SubCategoryId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<Sale>(e =>
        {
            e.HasIndex(x => x.InvoiceNo).IsUnique();
            e.Property(x => x.InvoiceNo).HasMaxLength(32);
            e.Property(x => x.PaymentMethod).HasMaxLength(16);
            e.Property(x => x.DiscountType).HasMaxLength(16);
            e.Property(x => x.CustomerName).HasMaxLength(128);
            e.Property(x => x.CustomerMobile).HasMaxLength(20);
            e.Property(x => x.SubTotal).HasPrecision(18, 2);
            e.Property(x => x.DiscountValue).HasPrecision(18, 2);
            e.Property(x => x.Discount).HasPrecision(18, 2);
            e.Property(x => x.TaxRate).HasPrecision(18, 2);
            e.Property(x => x.TaxAmount).HasPrecision(18, 2);
            e.Property(x => x.TaxMode).HasMaxLength(16);
            e.Property(x => x.Total).HasPrecision(18, 2);
            e.HasOne(x => x.User)
                .WithMany(x => x.Sales)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.Customer)
                .WithMany(x => x.Sales)
                .HasForeignKey(x => x.CustomerId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<SaleItem>(e =>
        {
            e.Property(x => x.UnitPrice).HasPrecision(18, 2);
            e.Property(x => x.LineTotal).HasPrecision(18, 2);
            e.HasOne(x => x.Sale)
                .WithMany(x => x.Items)
                .HasForeignKey(x => x.SaleId)
                .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(x => x.Product)
                .WithMany(x => x.SaleItems)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<StockMovement>(e =>
        {
            e.HasIndex(x => x.CreatedAt);
            e.HasIndex(x => new { x.ProductId, x.CreatedAt });
            e.Property(x => x.Type).HasMaxLength(16);
            e.Property(x => x.Note).HasMaxLength(256);
            e.Property(x => x.ReferenceType).HasMaxLength(32);
            e.HasOne(x => x.Product)
                .WithMany(x => x.StockMovements)
                .HasForeignKey(x => x.ProductId)
                .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(x => x.User)
                .WithMany()
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
