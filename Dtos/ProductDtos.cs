namespace Possing.Dtos;

public record ProductDto(
    Guid Id,
    string Sku,
    int SequenceNumber,
    string Name,
    string Description,
    decimal Price,
    int Quantity,
    int MinStockLevel,
    string? ImageUrl,
    Guid SubCategoryId,
    string SubCategoryName,
    Guid CategoryId,
    string CategoryName,
    bool IsActive,
    bool IsLowStock);

public record CreateProductRequest(
    string? Sku,
    string Name,
    string? Description,
    decimal Price,
    int Quantity,
    int MinStockLevel,
    Guid SubCategoryId,
    bool IsActive = true);

public record UpdateProductRequest(
    string Sku,
    string Name,
    string? Description,
    decimal Price,
    int Quantity,
    int MinStockLevel,
    Guid SubCategoryId,
    bool IsActive);

public record PatchProductStockRequest(decimal Price, int Quantity);
