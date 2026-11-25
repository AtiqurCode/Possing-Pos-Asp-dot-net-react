namespace Possing.Dtos;

public record StockChangeRequest(Guid ProductId, int Quantity, string? Note);

public record StockMovementDto(
    Guid Id,
    Guid ProductId,
    string ProductName,
    string Sku,
    int SequenceNumber,
    string Type,
    int Quantity,
    int QuantityBefore,
    int QuantityAfter,
    string? Note,
    Guid? ReferenceId,
    string? ReferenceType,
    string? UserName,
    DateTime CreatedAt);

public record InventorySummaryDto(
    Guid? ProductId,
    string? ProductName,
    int Received,
    int Sold,
    int Missing,
    int AdjustmentIn,
    int AdjustmentOut,
    int OnHand,
    int NetChange);
