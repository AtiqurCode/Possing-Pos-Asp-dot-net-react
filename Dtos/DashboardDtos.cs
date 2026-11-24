namespace Possing.Dtos;

public record LowStockProductDto(
    Guid Id,
    string Name,
    string Sku,
    int SequenceNumber,
    int Quantity,
    int MinStockLevel);

public record DashboardSummaryDto(
    decimal TodaySalesTotal,
    int TodaySalesCount,
    decimal WeekSalesTotal,
    int LowStockCount,
    IReadOnlyList<LowStockProductDto> LowStockProducts,
    IReadOnlyList<ChartPointDto> Last7DaysSales,
    IReadOnlyList<NamedCountDto> TodayPaymentBreakdown);
