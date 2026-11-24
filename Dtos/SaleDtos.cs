namespace Possing.Dtos;

public record SaleItemRequest(Guid ProductId, int Qty);

public record CreateSaleRequest(
    IReadOnlyList<SaleItemRequest> Items,
    string DiscountType,
    decimal DiscountValue,
    string PaymentMethod,
    string? CustomerName,
    string? CustomerMobile);

public record SaleItemDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string Sku,
    int SequenceNumber,
    int Qty,
    decimal UnitPrice,
    decimal LineTotal);

public record SaleDto(
    Guid Id,
    string InvoiceNo,
    string Cashier,
    Guid? CustomerId,
    string? CustomerName,
    string? CustomerMobile,
    decimal SubTotal,
    string DiscountType,
    decimal DiscountValue,
    decimal Discount,
    decimal Total,
    string PaymentMethod,
    DateTime CreatedAt,
    IReadOnlyList<SaleItemDto> Items);

public record SaleListItemDto(
    Guid Id,
    string InvoiceNo,
    string Cashier,
    string? CustomerName,
    string? CustomerMobile,
    decimal Total,
    decimal Discount,
    string PaymentMethod,
    DateTime CreatedAt,
    int ItemCount);
