using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;
using Possing.Models;

namespace Possing.Services;

public class CategoryService(AppDbContext db)
{
    public async Task<IReadOnlyList<CategoryDto>> GetAllAsync()
    {
        return await db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Name)
            .Select(c => new CategoryDto(c.Id, c.Name, c.SubCategories.Count))
            .ToListAsync();
    }

    public async Task<CategoryDto> CreateAsync(CreateCategoryRequest request)
    {
        var entity = new Category { Name = request.Name.Trim() };
        db.Categories.Add(entity);
        await db.SaveChangesAsync();
        return new CategoryDto(entity.Id, entity.Name, 0);
    }

    public async Task<CategoryDto?> UpdateAsync(Guid id, UpdateCategoryRequest request)
    {
        var entity = await db.Categories.Include(c => c.SubCategories).FirstOrDefaultAsync(c => c.Id == id);
        if (entity is null) return null;

        entity.Name = request.Name.Trim();
        await db.SaveChangesAsync();
        return new CategoryDto(entity.Id, entity.Name, entity.SubCategories.Count);
    }

    public async Task<bool> DeleteAsync(Guid id)
    {
        var entity = await db.Categories.FindAsync(id);
        if (entity is null) return false;
        db.Categories.Remove(entity);
        await db.SaveChangesAsync();
        return true;
    }

    public async Task<IReadOnlyList<SubCategoryDto>> GetSubCategoriesAsync(Guid? categoryId = null)
    {
        var query = db.SubCategories.AsNoTracking().Include(s => s.Category).AsQueryable();
        if (categoryId.HasValue)
            query = query.Where(s => s.CategoryId == categoryId.Value);

        return await query
            .OrderBy(s => s.Name)
            .Select(s => new SubCategoryDto(s.Id, s.CategoryId, s.Category.Name, s.Name, s.Products.Count))
            .ToListAsync();
    }

    public async Task<SubCategoryDto?> CreateSubCategoryAsync(CreateSubCategoryRequest request)
    {
        var category = await db.Categories.FindAsync(request.CategoryId);
        if (category is null) return null;

        var entity = new SubCategory
        {
            CategoryId = request.CategoryId,
            Name = request.Name.Trim()
        };
        db.SubCategories.Add(entity);
        await db.SaveChangesAsync();
        return new SubCategoryDto(entity.Id, entity.CategoryId, category.Name, entity.Name, 0);
    }

    public async Task<SubCategoryDto?> UpdateSubCategoryAsync(Guid id, UpdateSubCategoryRequest request)
    {
        var entity = await db.SubCategories.Include(s => s.Products).FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null) return null;

        var category = await db.Categories.FindAsync(request.CategoryId);
        if (category is null) return null;

        entity.CategoryId = request.CategoryId;
        entity.Name = request.Name.Trim();
        await db.SaveChangesAsync();
        return new SubCategoryDto(entity.Id, entity.CategoryId, category.Name, entity.Name, entity.Products.Count);
    }

    public async Task<bool> DeleteSubCategoryAsync(Guid id)
    {
        var entity = await db.SubCategories.Include(s => s.Products).FirstOrDefaultAsync(s => s.Id == id);
        if (entity is null) return false;
        if (entity.Products.Count > 0)
            throw new InvalidOperationException("Cannot delete subcategory with products.");

        db.SubCategories.Remove(entity);
        await db.SaveChangesAsync();
        return true;
    }
}
