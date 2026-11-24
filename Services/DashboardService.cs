using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;

namespace Possing.Services;

public class DashboardService(AppDbContext db)
{
    public async Task<DashboardSummaryDto> GetSummaryAsync()
    {
        var todayStart = DateTime.UtcNow.Date;
        var todayEnd = todayStart.AddDays(1);
        var weekStart = todayStart.AddDays(-6);

        var recentSales = await db.Sales
            .AsNoTracking()
            .Where(s => s.CreatedAt >= weekStart && s.CreatedAt < todayEnd)
            .ToListAsync();

        var todaySales = recentSales.Where(s => s.CreatedAt >= todayStart).ToList();
        var weekSales = recentSales;

        var lowStock = await db.Products
            .AsNoTracking()
            .Where(p => p.IsActive && p.Quantity <= p.MinStockLevel)
            .OrderBy(p => p.Quantity)
            .Select(p => new LowStockProductDto(
                p.Id, p.Name, p.Sku, p.SequenceNumber, p.Quantity, p.MinStockLevel))
            .ToListAsync();

        var last7 = Enumerable.Range(0, 7)
            .Select(i => weekStart.AddDays(i))
            .Select(day => new ChartPointDto(
                day.ToString("ddd"),
                recentSales.Where(s => s.CreatedAt.Date == day).Sum(s => s.Total)))
            .ToList();

        var payments = todaySales
            .GroupBy(s => s.PaymentMethod)
            .Select(g => new NamedCountDto(g.Key, g.Count(), g.Sum(x => x.Total)))
            .OrderByDescending(x => x.Amount)
            .ToList();

        return new DashboardSummaryDto(
            todaySales.Sum(s => s.Total),
            todaySales.Count,
            weekSales.Sum(s => s.Total),
            lowStock.Count,
            lowStock,
            last7,
            payments);
    }
}
