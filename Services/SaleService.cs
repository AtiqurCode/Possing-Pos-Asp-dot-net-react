using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;
using Possing.Models;

namespace Possing.Services;

public class SaleService(AppDbContext db, CustomerService customers)
{
    public async Task<IReadOnlyList<SaleListItemDto>> GetAllAsync(DateTime? from = null, DateTime? to = null)
    {
        var query = db.Sales.AsNoTracking().Include(s => s.User).Include(s => s.Items).AsQueryable();

        if (from.HasValue)
            query = query.Where(s => s.CreatedAt >= from.Value.ToUniversalTime());
        if (to.HasValue)
            query = query.Where(s => s.CreatedAt < to.Value.ToUniversalTime().AddDays(1));

        return await query
            .OrderByDescending(s => s.CreatedAt)
            .Select(s => new SaleListItemDto(
                s.Id,
                s.InvoiceNo,
                s.User.Username,
                s.CustomerName,
                s.CustomerMobile,
                s.Total,
                s.Discount,
                s.PaymentMethod,
                s.CreatedAt,
                s.Items.Count))
            .ToListAsync();
    }

    public async Task<SaleDto?> GetByIdAsync(Guid id)
    {
        var sale = await db.Sales
            .AsNoTracking()
            .Include(s => s.User)
            .Include(s => s.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(s => s.Id == id);

        return sale is null ? null : Map(sale);
    }

    public async Task<SaleDto> CreateAsync(Guid userId, CreateSaleRequest request)
    {
        if (request.Items is null || request.Items.Count == 0)
            throw new InvalidOperationException("Sale must have at least one item.");

        if (request.DiscountValue < 0)
            throw new InvalidOperationException("Discount cannot be negative.");

        var discountType = string.IsNullOrWhiteSpace(request.DiscountType)
            ? DiscountTypes.Amount
            : request.DiscountType.Trim();
        if (discountType is not (DiscountTypes.Amount or DiscountTypes.Percent))
            throw new InvalidOperationException("Discount type must be Amount or Percent.");

        var payment = request.PaymentMethod?.Trim();
        if (payment is not (PaymentMethods.Cash or PaymentMethods.Card))
            throw new InvalidOperationException("Payment method must be Cash or Card.");

        await using var tx = await db.Database.BeginTransactionAsync();

        var customer = await customers.ResolveForSaleAsync(request.CustomerName, request.CustomerMobile);

        var productIds = request.Items.Select(i => i.ProductId).Distinct().ToList();
        var products = await db.Products.Where(p => productIds.Contains(p.Id) && p.IsActive).ToListAsync();
        if (products.Count != productIds.Count)
            throw new InvalidOperationException("One or more products were not found or inactive.");

        var saleItems = new List<SaleItem>();
        decimal subTotal = 0;

        foreach (var group in request.Items.GroupBy(i => i.ProductId))
        {
            var qty = group.Sum(i => i.Qty);
            if (qty <= 0)
                throw new InvalidOperationException("Quantity must be greater than zero.");

            var product = products.First(p => p.Id == group.Key);
            if (product.Quantity < qty)
                throw new InvalidOperationException($"Insufficient stock for {product.Name}. Available: {product.Quantity}.");

            product.Quantity -= qty;
            product.UpdatedAt = DateTime.UtcNow;

            var lineTotal = product.Price * qty;
            subTotal += lineTotal;
            saleItems.Add(new SaleItem
            {
                ProductId = product.Id,
                Qty = qty,
                UnitPrice = product.Price,
                LineTotal = lineTotal
            });
        }

        var discountAmount = discountType == DiscountTypes.Percent
            ? Math.Round(subTotal * (request.DiscountValue / 100m), 2)
            : request.DiscountValue;

        if (discountAmount > subTotal)
            throw new InvalidOperationException("Discount cannot exceed subtotal.");

        var invoiceNo = await NextInvoiceNoAsync();
        var sale = new Sale
        {
            InvoiceNo = invoiceNo,
            UserId = userId,
            CustomerId = customer?.Id,
            CustomerName = customer?.Name ?? (string.IsNullOrWhiteSpace(request.CustomerName) ? null : request.CustomerName.Trim()),
            CustomerMobile = customer?.Mobile ?? CustomerService.NormalizeMobile(request.CustomerMobile ?? string.Empty),
            SubTotal = subTotal,
            DiscountType = discountType,
            DiscountValue = request.DiscountValue,
            Discount = discountAmount,
            Total = subTotal - discountAmount,
            PaymentMethod = payment,
            Items = saleItems
        };

        if (string.IsNullOrEmpty(sale.CustomerMobile))
            sale.CustomerMobile = null;

        db.Sales.Add(sale);

        if (customer is not null)
        {
            customer.VisitCount += 1;
            customer.TotalSpent += sale.Total;
            customer.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        await tx.CommitAsync();

        return (await GetByIdAsync(sale.Id))!;
    }

    private async Task<string> NextInvoiceNoAsync()
    {
        var today = DateTime.UtcNow.ToString("yyyyMMdd");
        var prefix = $"INV-{today}-";
        var last = await db.Sales
            .Where(s => s.InvoiceNo.StartsWith(prefix))
            .OrderByDescending(s => s.InvoiceNo)
            .Select(s => s.InvoiceNo)
            .FirstOrDefaultAsync();

        var next = 1;
        if (last is not null)
        {
            var parts = last.Split('-');
            if (int.TryParse(parts[^1], out var n))
                next = n + 1;
        }

        return $"{prefix}{next:D4}";
    }

    private static SaleDto Map(Sale s) => new(
        s.Id,
        s.InvoiceNo,
        s.User.Username,
        s.CustomerId,
        s.CustomerName,
        s.CustomerMobile,
        s.SubTotal,
        s.DiscountType,
        s.DiscountValue,
        s.Discount,
        s.Total,
        s.PaymentMethod,
        s.CreatedAt,
        s.Items.Select(i => new SaleItemDto(
            i.Id,
            i.ProductId,
            i.Product.Name,
            i.Product.Sku,
            i.Product.SequenceNumber,
            i.Qty,
            i.UnitPrice,
            i.LineTotal)).ToList());
}
