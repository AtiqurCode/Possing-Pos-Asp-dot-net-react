namespace Possing.Dtos;

public record ChartPointDto(string Label, decimal Value);

public record NamedCountDto(string Name, int Count, decimal Amount);

public record ReportAnalyticsDto(
    int Year,
    int Month,
    decimal TotalSales,
    int TransactionCount,
    decimal AverageTicket,
    decimal TotalDiscount,
    IReadOnlyList<ChartPointDto> DailySales,
    IReadOnlyList<NamedCountDto> PaymentBreakdown,
    IReadOnlyList<NamedCountDto> CategoryBreakdown,
    IReadOnlyList<NamedCountDto> TopProducts);
