using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;
using Possing.Models;

namespace Possing.Services;

public class InventoryService(AppDbContext db)
{
    public async Task<IReadOnlyList<StockMovementDto>> GetMovementsAsync(
        Guid? productId = null,
        string? type = null,
        DateTime? from = null,
        DateTime? to = null,
        int take = 200)
    {
        var query = db.StockMovements
            .AsNoTracking()
            .Include(m => m.Product)
            .Include(m => m.User)
            .AsQueryable();

        if (productId.HasValue)
            query = query.Where(m => m.ProductId == productId.Value);

        if (!string.IsNullOrWhiteSpace(type))
            query = query.Where(m => m.Type == type.Trim());

        if (from.HasValue)
            query = query.Where(m => m.CreatedAt >= from.Value.ToUniversalTime());

        if (to.HasValue)
            query = query.Where(m => m.CreatedAt < to.Value.ToUniversalTime().AddDays(1));

        take = Math.Clamp(take, 1, 500);

        var list = await query
            .OrderByDescending(m => m.CreatedAt)
            .Take(take)
            .ToListAsync();

        return list.Select(Map).ToList();
    }

    public async Task<InventorySummaryDto> GetSummaryAsync(Guid? productId = null)
    {
        var query = db.StockMovements.AsNoTracking().AsQueryable();
        string? productName = null;
        int onHand = 0;

        if (productId.HasValue)
        {
            query = query.Where(m => m.ProductId == productId.Value);
            var product = await db.Products.AsNoTracking().FirstOrDefaultAsync(p => p.Id == productId.Value);
            if (product is null)
                throw new InvalidOperationException("Product not found.");
            productName = product.Name;
            onHand = product.Quantity;
        }
        else
        {
            onHand = await db.Products.AsNoTracking().Where(p => p.IsActive).SumAsync(p => (int?)p.Quantity) ?? 0;
        }

        var rows = await query
            .GroupBy(m => m.Type)
            .Select(g => new { Type = g.Key, Total = g.Sum(x => x.Quantity) })
            .ToListAsync();

        int Sum(string t) => rows.FirstOrDefault(r => r.Type == t)?.Total ?? 0;

        // Adjustment signed totals from before/after
        var adjustments = await query
            .Where(m => m.Type == StockMovementTypes.Adjustment)
            .Select(m => m.QuantityAfter - m.QuantityBefore)
            .ToListAsync();

        var adjIn = adjustments.Where(d => d > 0).Sum();
        var adjOut = adjustments.Where(d => d < 0).Sum(d => -d);

        var received = Sum(StockMovementTypes.Received);
        var sold = Sum(StockMovementTypes.Sold);
        var missing = Sum(StockMovementTypes.Missing);
        var net = received + adjIn - sold - missing - adjOut;

        return new InventorySummaryDto(
            productId,
            productName,
            received,
            sold,
            missing,
            adjIn,
            adjOut,
            onHand,
            net);
    }

    public async Task<ProductDto> ReceiveAsync(Guid userId, StockChangeRequest request)
        => await ApplyDeltaAsync(
            userId,
            request.ProductId,
            +Math.Abs(request.Quantity),
            StockMovementTypes.Received,
            request.Note,
            null,
            null);

    public async Task<ProductDto> MissingAsync(Guid userId, StockChangeRequest request)
        => await ApplyDeltaAsync(
            userId,
            request.ProductId,
            -Math.Abs(request.Quantity),
            StockMovementTypes.Missing,
            request.Note,
            null,
            null);

    /// <summary>Record a sale deduction (caller already mutated product qty inside a transaction).</summary>
    public void AddSoldMovement(
        Product product,
        int qtySold,
        int quantityBefore,
        Guid saleId,
        Guid userId)
    {
        if (qtySold <= 0) return;
        db.StockMovements.Add(new StockMovement
        {
            ProductId = product.Id,
            Type = StockMovementTypes.Sold,
            Quantity = qtySold,
            QuantityBefore = quantityBefore,
            QuantityAfter = product.Quantity,
            Note = "Sale",
            ReferenceId = saleId,
            ReferenceType = "Sale",
            UserId = userId
        });
    }

    /// <summary>Record opening / absolute set as Received or Adjustment.</summary>
    public void AddMovement(
        Guid productId,
        string type,
        int quantity,
        int before,
        int after,
        Guid? userId,
        string? note,
        Guid? referenceId = null,
        string? referenceType = null)
    {
        if (quantity <= 0 && before == after) return;
        var qty = quantity > 0 ? quantity : Math.Abs(after - before);
        if (qty <= 0) return;

        db.StockMovements.Add(new StockMovement
        {
            ProductId = productId,
            Type = type,
            Quantity = qty,
            QuantityBefore = before,
            QuantityAfter = after,
            Note = note,
            ReferenceId = referenceId,
            ReferenceType = referenceType,
            UserId = userId
        });
    }

    public async Task RecordAbsoluteSetAsync(
        Product product,
        int newQuantity,
        Guid? userId,
        string note)
    {
        var before = product.Quantity;
        if (before == newQuantity) return;

        var delta = newQuantity - before;
        product.Quantity = newQuantity;
        product.UpdatedAt = DateTime.UtcNow;

        // Absolute set from product form / inline edit = Adjustment (use Receive/Missing APIs for those)
        AddMovement(
            product.Id,
            StockMovementTypes.Adjustment,
            Math.Abs(delta),
            before,
            newQuantity,
            userId,
            note);
        await Task.CompletedTask;
    }

    private async Task<ProductDto> ApplyDeltaAsync(
        Guid userId,
        Guid productId,
        int signedDelta,
        string type,
        string? note,
        Guid? referenceId,
        string? referenceType)
    {
        if (signedDelta == 0)
            throw new InvalidOperationException("Quantity must be greater than zero.");

        var product = await db.Products
            .Include(p => p.SubCategory)
            .ThenInclude(s => s.Category)
            .FirstOrDefaultAsync(p => p.Id == productId && p.IsActive);

        if (product is null)
            throw new InvalidOperationException("Product not found.");

        var before = product.Quantity;
        var after = before + signedDelta;
        if (after < 0)
            throw new InvalidOperationException($"Insufficient stock for {product.Name}. Available: {before}.");

        product.Quantity = after;
        product.UpdatedAt = DateTime.UtcNow;

        AddMovement(
            product.Id,
            type,
            Math.Abs(signedDelta),
            before,
            after,
            userId,
            string.IsNullOrWhiteSpace(note) ? type : note.Trim(),
            referenceId,
            referenceType);

        await db.SaveChangesAsync();

        return new ProductDto(
            product.Id,
            product.Sku,
            product.SequenceNumber,
            product.Name,
            product.Description,
            product.Price,
            product.Quantity,
            product.MinStockLevel,
            product.ImagePath,
            product.SubCategoryId,
            product.SubCategory.Name,
            product.SubCategory.CategoryId,
            product.SubCategory.Category.Name,
            product.IsActive,
            product.Quantity <= product.MinStockLevel);
    }

    private static StockMovementDto Map(StockMovement m) => new(
        m.Id,
        m.ProductId,
        m.Product.Name,
        m.Product.Sku,
        m.Product.SequenceNumber,
        m.Type,
        m.Quantity,
        m.QuantityBefore,
        m.QuantityAfter,
        m.Note,
        m.ReferenceId,
        m.ReferenceType,
        m.User?.Username,
        m.CreatedAt);
}
