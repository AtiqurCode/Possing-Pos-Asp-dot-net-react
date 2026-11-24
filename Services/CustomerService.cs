using Microsoft.EntityFrameworkCore;
using Possing.Data;
using Possing.Dtos;
using Possing.Models;

namespace Possing.Services;

public class CustomerService(AppDbContext db)
{
    public async Task<IReadOnlyList<CustomerDto>> GetAllAsync(string? search = null)
    {
        var query = db.Customers.AsNoTracking().AsQueryable();
        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(c =>
                c.Name.ToLower().Contains(term) ||
                c.Mobile.Contains(term) ||
                c.MembershipCode.ToLower().Contains(term));
        }

        return await query
            .OrderByDescending(c => c.UpdatedAt)
            .Select(c => new CustomerDto(
                c.Id, c.Name, c.Mobile, c.MembershipCode, c.VisitCount, c.TotalSpent, c.CreatedAt))
            .ToListAsync();
    }

    public async Task<CustomerLookupDto?> LookupByMobileAsync(string mobile)
    {
        var normalized = NormalizeMobile(mobile);
        if (string.IsNullOrEmpty(normalized)) return null;

        var c = await db.Customers.AsNoTracking()
            .FirstOrDefaultAsync(x => x.Mobile == normalized);
        return c is null
            ? null
            : new CustomerLookupDto(c.Id, c.Name, c.Mobile, c.MembershipCode, c.VisitCount, c.TotalSpent);
    }

    public async Task<CustomerDto> UpsertAsync(UpsertCustomerRequest request)
    {
        var mobile = NormalizeMobile(request.Mobile);
        if (string.IsNullOrEmpty(mobile))
            throw new InvalidOperationException("Mobile number is required.");

        var name = request.Name?.Trim() ?? string.Empty;
        var existing = await db.Customers.FirstOrDefaultAsync(c => c.Mobile == mobile);
        if (existing is null)
        {
            existing = new Customer
            {
                Name = string.IsNullOrWhiteSpace(name) ? "Member" : name,
                Mobile = mobile,
                MembershipCode = await NextMembershipCodeAsync()
            };
            db.Customers.Add(existing);
        }
        else if (!string.IsNullOrWhiteSpace(name))
        {
            existing.Name = name.Trim();
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync();
        return new CustomerDto(
            existing.Id, existing.Name, existing.Mobile, existing.MembershipCode,
            existing.VisitCount, existing.TotalSpent, existing.CreatedAt);
    }

    public async Task<Customer?> ResolveForSaleAsync(string? name, string? mobile)
    {
        var normalized = NormalizeMobile(mobile ?? string.Empty);
        if (string.IsNullOrEmpty(normalized) && string.IsNullOrWhiteSpace(name))
            return null;

        if (string.IsNullOrEmpty(normalized))
            throw new InvalidOperationException("Customer mobile is required when name is provided.");

        var customer = await db.Customers.FirstOrDefaultAsync(c => c.Mobile == normalized);
        if (customer is null)
        {
            customer = new Customer
            {
                Name = string.IsNullOrWhiteSpace(name) ? "Walk-in Member" : name.Trim(),
                Mobile = normalized,
                MembershipCode = await NextMembershipCodeAsync()
            };
            db.Customers.Add(customer);
            await db.SaveChangesAsync();
        }
        else if (!string.IsNullOrWhiteSpace(name) && customer.Name != name.Trim())
        {
            customer.Name = name.Trim();
            customer.UpdatedAt = DateTime.UtcNow;
        }

        return customer;
    }

    public static string NormalizeMobile(string mobile)
    {
        var digits = new string((mobile ?? string.Empty).Where(char.IsDigit).ToArray());
        return digits;
    }

    private async Task<string> NextMembershipCodeAsync()
    {
        var count = await db.Customers.CountAsync() + 1;
        return $"MBR-{count:D5}";
    }
}
