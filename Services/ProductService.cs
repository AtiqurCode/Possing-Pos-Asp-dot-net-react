using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;
using Possing.Models;

namespace Possing.Services;

public class ProductService(AppDbContext db, ProductImageService images, InventoryService inventory)
{
    public async Task<IReadOnlyList<ProductDto>> GetAllAsync(string? search = null, Guid? categoryId = null, bool? lowStockOnly = null)
    {
        var query = db.Products
            .AsNoTracking()
            .Include(p => p.SubCategory)
            .ThenInclude(s => s.Category)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p =>
                p.Name.ToLower().Contains(term) ||
                p.Sku.ToLower().Contains(term) ||
                p.SequenceNumber.ToString().Contains(term));
        }

        if (categoryId.HasValue)
            query = query.Where(p => p.SubCategory.CategoryId == categoryId.Value);

        if (lowStockOnly == true)
            query = query.Where(p => p.Quantity <= p.MinStockLevel);

        var list = await query.OrderBy(p => p.SequenceNumber).ToListAsync();
        return list.Select(Map).ToList();
    }

    public async Task<ProductDto?> GetByIdAsync(Guid id)
    {
        var product = await db.Products
            .AsNoTracking()
            .Include(p => p.SubCategory)
            .ThenInclude(s => s.Category)
            .FirstOrDefaultAsync(p => p.Id == id);
        return product is null ? null : Map(product);
    }

    public async Task<ProductDto?> GetByCodeAsync(string code)
    {
        code = code.Trim();
        var query = db.Products
            .AsNoTracking()
            .Include(p => p.SubCategory)
            .ThenInclude(s => s.Category)
            .Where(p => p.IsActive);

        Product? product;
        if (int.TryParse(code, out var seq))
        {
            product = await query.FirstOrDefaultAsync(p => p.SequenceNumber == seq || p.Sku == code);
        }
        else
        {
            product = await query.FirstOrDefaultAsync(p => p.Sku.ToLower() == code.ToLower());
        }

        return product is null ? null : Map(product);
    }

    public async Task<ProductDto?> CreateAsync(CreateProductRequest request)
    {
        var sub = await db.SubCategories.Include(s => s.Category).FirstOrDefaultAsync(s => s.Id == request.SubCategoryId);
        if (sub is null) return null;

        var nextSeq = await db.Products.AnyAsync()
            ? await db.Products.MaxAsync(p => p.SequenceNumber) + 1
            : 1001;

        var sku = string.IsNullOrWhiteSpace(request.Sku)
            ? $"SKU-{nextSeq}"
            : request.Sku.Trim().ToUpperInvariant();

        if (await db.Products.AnyAsync(p => p.Sku == sku))
            throw new InvalidOperationException("SKU already exists.");

        var entity = new Product
        {
            Sku = sku,
            SequenceNumber = nextSeq,
            Name = request.Name.Trim(),
            Description = request.Description?.Trim() ?? string.Empty,
            Price = request.Price,
            Quantity = request.Quantity,
            MinStockLevel = request.MinStockLevel,
            SubCategoryId = request.SubCategoryId,
            IsActive = request.IsActive
        };

        db.Products.Add(entity);
        if (entity.Quantity > 0)
        {
            inventory.AddMovement(
                entity.Id,
                StockMovementTypes.Received,
                entity.Quantity,
                0,
                entity.Quantity,
                null,
                "Opening stock");
        }

        await db.SaveChangesAsync();
        entity.SubCategory = sub;
        return Map(entity);
    }

    public async Task<ProductDto?> UpdateAsync(Guid id, UpdateProductRequest request)
    {
        var entity = await db.Products
            .Include(p => p.SubCategory)
            .ThenInclude(s => s.Category)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;

        var sub = await db.SubCategories.Include(s => s.Category).FirstOrDefaultAsync(s => s.Id == request.SubCategoryId);
        if (sub is null) return null;

        var sku = request.Sku.Trim().ToUpperInvariant();
        if (await db.Products.AnyAsync(p => p.Sku == sku && p.Id != id))
            throw new InvalidOperationException("SKU already exists.");

        entity.Sku = sku;
        entity.Name = request.Name.Trim();
        entity.Description = request.Description?.Trim() ?? string.Empty;
        entity.Price = request.Price;
        entity.MinStockLevel = request.MinStockLevel;
        entity.SubCategoryId = request.SubCategoryId;
        entity.IsActive = request.IsActive;
        entity.UpdatedAt = DateTime.UtcNow;
        entity.SubCategory = sub;

        if (entity.Quantity != request.Quantity)
        {
            await inventory.RecordAbsoluteSetAsync(
                entity,
                request.Quantity,
                null,
                "Product edit");
        }

        await db.SaveChangesAsync();
        return Map(entity);
    }

    public async Task<ProductDto?> PatchStockAsync(Guid id, PatchProductStockRequest request)
    {
        if (request.Price < 0 || request.Quantity < 0)
            throw new InvalidOperationException("Price and quantity must be >= 0.");

        var entity = await db.Products
            .Include(p => p.SubCategory)
            .ThenInclude(s => s.Category)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;

        entity.Price = request.Price;
        if (entity.Quantity != request.Quantity)
        {
            await inventory.RecordAbsoluteSetAsync(
                entity,
                request.Quantity,
                null,
                "Inline stock adjust");
        }

        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(entity);
    }

    public async Task<ProductDto?> UploadImageAsync(Guid id, IFormFile file)
    {
        var entity = await db.Products
            .Include(p => p.SubCategory)
            .ThenInclude(s => s.Category)
            .FirstOrDefaultAsync(p => p.Id == id);
        if (entity is null) return null;

        images.DeleteIfExists(entity.ImagePath);
        entity.ImagePath = await images.SaveAsync(id, file);
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return Map(entity);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await db.Products.FindAsync(id);
        if (entity is null) return false;
        entity.IsActive = false;
        entity.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync();
        return true;
    }

    private static ProductDto Map(Product p) => new(
        p.Id,
        p.Sku,
        p.SequenceNumber,
        p.Name,
        p.Description,
        p.Price,
        p.Quantity,
        p.MinStockLevel,
        p.ImagePath,
        p.SubCategoryId,
        p.SubCategory.Name,
        p.SubCategory.CategoryId,
        p.SubCategory.Category.Name,
        p.IsActive,
        p.Quantity <= p.MinStockLevel);
}
